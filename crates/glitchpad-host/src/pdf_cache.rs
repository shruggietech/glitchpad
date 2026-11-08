//! One private, bounded, revision-owned seek cache for stream-only PDF input.
use std::collections::VecDeque;
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use glitchpad_core::contracts::{CoreError, CoreErrorCategory};
use glitchpad_core::source::{ExternalRevision, ReadRangeResult, SourceId};
#[cfg(target_os="android")]
use glitchpad_core::source::StreamId;
use serde::Serialize;
use sha2::{Digest, Sha256};

const SOURCE_LIMIT: u64 = 256 * 1024 * 1024;
const CHUNK_LIMIT: u64 = 256 * 1024;
fn failure(category: CoreErrorCategory, reason: &str) -> CoreError { CoreError::new(category, reason, true, true) }
fn unavailable() -> CoreError { failure(CoreErrorCategory::Unavailable, "The private PDF cache is unavailable") }
fn cancelled() -> CoreError { failure(CoreErrorCategory::StaleSession, "PDF source work was cancelled") }

#[derive(Clone, Serialize)]
pub(crate) struct CacheSnapshot {
    pub request_id: String,
    pub source_id: SourceId,
    pub state: &'static str,
    pub processed_bytes: u64,
    pub sha256: Option<String>,
}
struct Progress { snapshot: CacheSnapshot, hasher: Sha256 }
pub(crate) struct CacheEntry {
    id: String,
    source: SourceId,
    revision: ExternalRevision,
    declared: Option<u64>,
    path: PathBuf,
    file: Mutex<Option<File>>,
    progress: Mutex<Progress>,
    #[cfg(target_os="android")]
    stream: Mutex<Option<StreamId>>,
    cancelled: AtomicBool,
    busy: AtomicBool,
}
#[derive(Default)]
struct Registry { active: Option<Arc<CacheEntry>>, cancelled: VecDeque<String> }
pub(crate) struct PdfCacheStore { root: PathBuf, registry: Mutex<Registry> }
struct StepPermit<'a>(&'a AtomicBool);
impl Drop for StepPermit<'_> { fn drop(&mut self) { self.0.store(false, Ordering::Release); } }

impl PdfCacheStore {
    pub(crate) fn new(root: PathBuf) -> Result<Self, CoreError> {
        std::fs::create_dir_all(&root).map_err(|_| unavailable())?;
        #[cfg(unix)] {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&root, std::fs::Permissions::from_mode(0o700)).map_err(|_| unavailable())?;
        }
        // Only process-owned UUID cache files are disposable after process death.
        for (index, entry) in std::fs::read_dir(&root).map_err(|_| unavailable())?.enumerate() {
            if index >= 128 { return Err(unavailable()); }
            let entry = entry.map_err(|_| unavailable())?;
            let name = entry.file_name(); let name = name.to_string_lossy();
            let owned = name.strip_prefix("pdf-").and_then(|name| name.strip_suffix(".cache")).is_some_and(|id| uuid::Uuid::parse_str(id).is_ok());
            if owned && entry.file_type().map_err(|_| unavailable())?.is_file() { std::fs::remove_file(entry.path()).map_err(|_| unavailable())?; }
        }
        Ok(Self { root, registry: Mutex::new(Registry::default()) })
    }
    fn begin(&self, id: &str, source: &SourceId, revision: &ExternalRevision) -> Result<Arc<CacheEntry>, CoreError> {
        if uuid::Uuid::parse_str(id).is_err() { return Err(failure(CoreErrorCategory::InvalidInput, "Invalid PDF cache request")); }
        if revision.byte_length.is_some_and(|length| length > SOURCE_LIMIT) { return Err(failure(CoreErrorCategory::ResourceLimit, "The PDF source exceeds256MiB")); }
        let mut registry = self.registry.lock().map_err(|_| unavailable())?;
        if registry.cancelled.iter().any(|cancelled| cancelled == id) { return Err(cancelled()); }
        if registry.active.is_some() { return Err(failure(CoreErrorCategory::ResourceLimit, "A PDF source cache is still owned by another operation")); }
        let path = self.root.join(format!("pdf-{id}.cache"));
        let mut options = OpenOptions::new();options.read(true).write(true).create_new(true);
        #[cfg(unix)] { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
        let file = options.open(&path).map_err(|_| unavailable())?;
        let entry = Arc::new(CacheEntry { id:id.into(),source:source.clone(),revision:revision.clone(),declared:revision.byte_length,path,file:Mutex::new(Some(file)),progress:Mutex::new(Progress{snapshot:CacheSnapshot{request_id:id.into(),source_id:source.clone(),state:"spooling",processed_bytes:0,sha256:None},hasher:Sha256::new()}),#[cfg(target_os="android")] stream:Mutex::new(None),cancelled:AtomicBool::new(false),busy:AtomicBool::new(false) });
        registry.active = Some(entry.clone());Ok(entry)
    }
    fn get(&self, id: &str, source: &SourceId, revision: &ExternalRevision) -> Result<Arc<CacheEntry>, CoreError> {
        self.registry.lock().map_err(|_| unavailable())?.active.as_ref().filter(|entry| entry.id == id && &entry.source == source && &entry.revision == revision).cloned().ok_or_else(|| failure(CoreErrorCategory::NotFound, "The PDF cache owner or revision is not current"))
    }
    fn cancel(&self, id: &str) -> Result<Option<Arc<CacheEntry>>, CoreError> {
        if uuid::Uuid::parse_str(id).is_err() { return Err(failure(CoreErrorCategory::InvalidInput, "Invalid PDF cache cancellation")); }
        let mut registry=self.registry.lock().map_err(|_| unavailable())?;
        if !registry.cancelled.iter().any(|known|known==id) { if registry.cancelled.len()==64 {registry.cancelled.pop_front();}registry.cancelled.push_back(id.into()); }
        let entry=registry.active.as_ref().filter(|entry|entry.id==id).cloned();
        if let Some(entry)=&entry {entry.cancelled.store(true,Ordering::Release);}
        Ok(entry)
    }
    fn remove(&self, entry: &CacheEntry) -> Result<(), CoreError> {
        entry.cancelled.store(true,Ordering::Release);
        entry.file.lock().map_err(|_|unavailable())?.take();
        match std::fs::remove_file(&entry.path) { Ok(())=>{},Err(error) if error.kind()==std::io::ErrorKind::NotFound=>{},Err(_)=>return Err(unavailable()) }
        let mut registry=self.registry.lock().map_err(|_|unavailable())?;
        if registry.active.as_ref().is_some_and(|active|active.id==entry.id) {registry.active=None;}
        Ok(())
    }
}
impl CacheEntry {
    fn snapshot(&self)->Result<CacheSnapshot,CoreError>{Ok(self.progress.lock().map_err(|_|unavailable())?.snapshot.clone())}
    fn admit(&self)->Result<StepPermit<'_>,CoreError>{
        if self.cancelled.load(Ordering::Acquire){return Err(cancelled());}
        self.busy.compare_exchange(false,true,Ordering::AcqRel,Ordering::Acquire).map_err(|_|failure(CoreErrorCategory::ResourceLimit,"PDF cache work is already pending"))?;Ok(StepPermit(&self.busy))
    }
    fn append(&self, bytes:&[u8], end_of_source:bool)->Result<CacheSnapshot,CoreError>{
        if self.cancelled.load(Ordering::Acquire){return Err(cancelled());}
        if bytes.len() as u64>CHUNK_LIMIT || (bytes.is_empty() && !end_of_source){return Err(failure(CoreErrorCategory::InvalidInput,"Invalid bounded PDF source chunk"));}
        let mut file=self.file.lock().map_err(|_|unavailable())?;
        let mut progress=self.progress.lock().map_err(|_|unavailable())?;
        if self.cancelled.load(Ordering::Acquire){return Err(cancelled());}
        if progress.snapshot.state!="spooling" {return Err(failure(CoreErrorCategory::StaleSession,"PDF source spooling has already finished"));}
        let next=progress.snapshot.processed_bytes.checked_add(bytes.len() as u64).ok_or_else(unavailable)?;
        if next>SOURCE_LIMIT {return Err(failure(CoreErrorCategory::ResourceLimit,"The PDF source exceeds256MiB"));}
        file.as_mut().ok_or_else(cancelled)?.write_all(bytes).map_err(|_|failure(CoreErrorCategory::StorageFull,"The private PDF cache could not be written"))?;
        progress.hasher.update(bytes);progress.snapshot.processed_bytes=next;
        if end_of_source {
            if next==0 || self.declared.is_some_and(|length|length!=next){return Err(failure(CoreErrorCategory::Conflict,"The PDF source length changed while spooling"));}
            progress.snapshot.sha256=Some(format!("{:x}",progress.hasher.clone().finalize()));progress.snapshot.state="ready";
        }
        Ok(progress.snapshot.clone())
    }
    fn read(&self,offset:u64,length:u64)->Result<ReadRangeResult,CoreError>{
        if self.cancelled.load(Ordering::Acquire){return Err(cancelled());}
        let mut file=self.file.lock().map_err(|_|unavailable())?;
        let progress=self.progress.lock().map_err(|_|unavailable())?;
        if progress.snapshot.state!="ready" || length==0 || length>CHUNK_LIMIT || offset.checked_add(length).is_none_or(|end|end>progress.snapshot.processed_bytes){return Err(failure(CoreErrorCategory::InvalidInput,"PDF cache range is outside the sealed source"));}
        let file=file.as_mut().ok_or_else(cancelled)?;file.seek(SeekFrom::Start(offset)).map_err(|_|unavailable())?;
        let mut bytes=vec![0;usize::try_from(length).map_err(|_|unavailable())?];file.read_exact(&mut bytes).map_err(|_|unavailable())?;
        Ok(ReadRangeResult{source_id:self.source.clone(),offset,bytes,end_of_source:offset+length==progress.snapshot.processed_bytes})
    }
}

#[cfg(target_os="android")]
fn require_current(app:&tauri::AppHandle,source:&SourceId,revision:&ExternalRevision)->Result<(),CoreError>{
    use tauri::Manager;
    let observed=app.state::<crate::android_source::AndroidSourceHost>().revalidate(source,revision)?;
    if observed.status==glitchpad_core::source::RevalidationStatus::Match {Ok(())} else {Err(failure(if observed.status==glitchpad_core::source::RevalidationStatus::PermissionRevoked{CoreErrorCategory::PermissionRevoked}else{CoreErrorCategory::Conflict},"The PDF source is no longer current"))}
}

#[cfg(test)]
mod tests {
    use super::*;
    use glitchpad_core::contracts::{DocumentIdentity,IdentityAuthority,IdentityStrength};
    fn revision(length:Option<u64>)->ExternalRevision {ExternalRevision{identity:DocumentIdentity{authority:IdentityAuthority::Synthetic,scope:"pdf-test".into(),token:"opaque".into(),strength:IdentityStrength::Strong},byte_length:length,modified_unix_nanos:None,change_token:None}}
    fn store()->PdfCacheStore {PdfCacheStore::new(std::env::temp_dir().join(format!("glitchpad-pdf-cache-test-{}",uuid::Uuid::new_v4()))).unwrap()}
    #[test] fn sealed_cache_preserves_bytes_and_refuses_another_owner(){
        let store=store();let id=uuid::Uuid::new_v4().to_string();let source=SourceId("source".into());let rev=revision(Some(8));let entry=store.begin(&id,&source,&rev).unwrap();
        assert!(entry.read(0,1).is_err());assert!(store.get(&id,&SourceId("other".into()),&rev).is_err());assert!(store.begin(&uuid::Uuid::new_v4().to_string(),&source,&rev).is_err());
        assert_eq!(entry.append(b"0123",false).unwrap().processed_bytes,4);assert_eq!(entry.append(b"4567",true).unwrap().state,"ready");assert_eq!(entry.read(2,4).unwrap().bytes,b"2345");assert!(entry.read(7,2).is_err());
        assert_eq!(entry.snapshot().unwrap().sha256.unwrap(),format!("{:x}",Sha256::digest(b"01234567")));
        store.remove(&entry).unwrap();assert!(!entry.path.exists());std::fs::remove_dir(&store.root).unwrap();
    }
    #[test] fn cancellation_before_admission_and_during_spooling_cleans_only_owned_files(){
        let store=store();let source=SourceId("source".into());let rev=revision(None);let early=uuid::Uuid::new_v4().to_string();store.cancel(&early).unwrap();assert!(store.begin(&early,&source,&rev).is_err());
        let id=uuid::Uuid::new_v4().to_string();let entry=store.begin(&id,&source,&rev).unwrap();entry.append(b"partial",false).unwrap();store.cancel(&id).unwrap();assert!(entry.append(b"late",true).is_err());assert!(entry.read(0,1).is_err());store.remove(&entry).unwrap();assert!(!entry.path.exists());std::fs::remove_dir(&store.root).unwrap();
    }
    #[test] fn byte_limit_is_checked_before_an_oversized_chunk_reaches_disk(){
        let store=store();let entry=store.begin(&uuid::Uuid::new_v4().to_string(),&SourceId("source".into()),&revision(None)).unwrap();
        entry.progress.lock().unwrap().snapshot.processed_bytes=SOURCE_LIMIT-1;
        assert!(entry.append(b"12",false).is_err());assert_eq!(std::fs::metadata(&entry.path).unwrap().len(),0);
        store.remove(&entry).unwrap();std::fs::remove_dir(&store.root).unwrap();
    }
    #[test] fn process_restart_deletes_only_owned_disposable_cache_files(){
        let root=std::env::temp_dir().join(format!("glitchpad-pdf-cache-test-{}",uuid::Uuid::new_v4()));std::fs::create_dir(&root).unwrap();
        let owned=root.join(format!("pdf-{}.cache",uuid::Uuid::new_v4()));let foreign=root.join("keep.txt");std::fs::write(&owned,b"partial").unwrap();std::fs::write(&foreign,b"keep").unwrap();
        let store=PdfCacheStore::new(root.clone()).unwrap();assert!(!owned.exists());assert_eq!(std::fs::read(&foreign).unwrap(),b"keep");drop(store);std::fs::remove_file(foreign).unwrap();std::fs::remove_dir(root).unwrap();
    }
    #[test] fn source_quota_terminal_length_and_concurrent_admission_are_checked(){
        let store=store();let source=SourceId("source".into());assert!(store.begin(&uuid::Uuid::new_v4().to_string(),&source,&revision(Some(SOURCE_LIMIT+1))).is_err());
        let id=uuid::Uuid::new_v4().to_string();let entry=store.begin(&id,&source,&revision(Some(4))).unwrap();let permit=entry.admit().unwrap();assert!(entry.admit().is_err());drop(permit);assert!(entry.admit().is_ok());assert!(entry.append(b"123",true).is_err());store.remove(&entry).unwrap();std::fs::remove_dir(&store.root).unwrap();
    }
}

#[cfg(target_os="android")]
pub(crate) struct PdfCacheHost(Result<PdfCacheStore,CoreError>);
#[cfg(target_os="android")]
impl PdfCacheHost {
    pub(crate) fn for_app(app:&tauri::App)->Self {
        use tauri::Manager;
        Self(app.path().app_cache_dir().map_err(|_|unavailable()).and_then(|root|PdfCacheStore::new(root.join("pdf-source-v1"))))
    }
    fn store(&self)->Result<&PdfCacheStore,CoreError>{self.0.as_ref().map_err(Clone::clone)}
}
#[cfg(target_os="android")]
fn cleanup(app:&tauri::AppHandle,store:&PdfCacheStore,entry:&CacheEntry)->Result<(),CoreError>{
    use tauri::Manager;
    entry.cancelled.store(true,Ordering::Release);
    let stream=entry.stream.lock().map_err(|_|unavailable())?.take();
    let closed=stream.map(|stream|app.state::<crate::android_source::AndroidSourceHost>().close_stream_lease(&stream)).transpose();
    let removed=store.remove(entry);closed?;removed
}
#[cfg(target_os="android")]
#[tauri::command]
pub(crate) async fn begin_pdf_cache(app:tauri::AppHandle,source_id:SourceId,expected_revision:ExternalRevision,request_id:String)->Result<CacheSnapshot,CoreError>{
    crate::android_interactive::run(move||{
        use tauri::Manager;
        require_current(&app,&source_id,&expected_revision)?;
        let state=app.state::<PdfCacheHost>();let store=state.store()?;let entry=store.begin(&request_id,&source_id,&expected_revision)?;
        let result=(||{
            let opened=app.state::<crate::android_source::AndroidSourceHost>().open_stream(&source_id,0,SOURCE_LIMIT+1)?;
            *entry.stream.lock().map_err(|_|unavailable())?=Some(opened.stream_id);
            if entry.cancelled.load(Ordering::Acquire){return Err(cancelled());}
            entry.snapshot()
        })();
        if result.is_err(){let _=cleanup(&app,store,&entry);}result
    }).await
}
#[cfg(target_os="android")]
#[tauri::command]
pub(crate) async fn advance_pdf_cache(app:tauri::AppHandle,source_id:SourceId,expected_revision:ExternalRevision,request_id:String)->Result<CacheSnapshot,CoreError>{
    crate::android_interactive::run(move||{
        use tauri::Manager;
        let state=app.state::<PdfCacheHost>();let store=state.store()?;let entry=store.get(&request_id,&source_id,&expected_revision)?;let _permit=entry.admit()?;
        let result=(||{
            let snapshot=entry.snapshot()?;
            let stream=entry.stream.lock().map_err(|_|unavailable())?.clone().ok_or_else(cancelled)?;
            let count=CHUNK_LIMIT.min(SOURCE_LIMIT+1-snapshot.processed_bytes);
            let chunk=app.state::<crate::android_source::AndroidSourceHost>().read_stream(&stream,count)?;
            if chunk.source_id!=source_id || chunk.offset!=snapshot.processed_bytes {return Err(failure(CoreErrorCategory::InternalInvariant,"PDF stream reply does not match its owner"));}
            let updated=entry.append(&chunk.bytes,chunk.end_of_source)?;
            if updated.state=="ready" {require_current(&app,&source_id,&expected_revision)?;}
            Ok(updated)
        })();
        if result.is_err(){let _=cleanup(&app,store,&entry);}result
    }).await
}
#[cfg(target_os="android")]
#[tauri::command]
pub(crate) async fn read_pdf_cache(app:tauri::AppHandle,source_id:SourceId,expected_revision:ExternalRevision,request_id:String,offset:u64,length:u64)->Result<tauri::ipc::Response,CoreError>{
    let result=crate::android_interactive::run(move||{
        use tauri::Manager;
        require_current(&app,&source_id,&expected_revision)?;
        let state=app.state::<PdfCacheHost>();state.store()?.get(&request_id,&source_id,&expected_revision)?.read(offset,length)
    }).await?;
    crate::android_range_response::encode(result,true)
}
#[cfg(target_os="android")]
#[tauri::command]
pub(crate) async fn cancel_pdf_cache(app:tauri::AppHandle,request_id:String)->Result<(),CoreError>{
    crate::android_interactive::run(move||{
        use tauri::Manager;
        let state=app.state::<PdfCacheHost>();let store=state.store()?;
        if let Some(entry)=store.cancel(&request_id)? {cleanup(&app,store,&entry)?;}
        Ok(())
    }).await
}
