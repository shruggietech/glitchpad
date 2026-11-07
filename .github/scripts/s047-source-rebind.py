import difflib, hashlib, json, subprocess
from pathlib import Path
root=Path.cwd(); private=root/'.codex-tmp/s047'; private.mkdir(parents=True,exist_ok=True)
ledger_path=root/'specs/047-android-task-completion/contracts/control-ledger.json'
targets={p:None for p in ["packaging/android/THIRD_PARTY_NOTICES.txt","packaging/windows/THIRD_PARTY_NOTICES.txt","packaging/macos/THIRD_PARTY_NOTICES.txt","packaging/linux/THIRD_PARTY_NOTICES.txt","packaging/s047-dependency-notice-sources.json","Cargo.toml","Cargo.lock","crates/glitchpad-android-source/Cargo.toml","crates/glitchpad-android-source/src/models.rs","crates/glitchpad-android-source/src/mobile.rs","crates/glitchpad-host/src/android_range_response.rs","crates/glitchpad-host/tests/performance_conformance.rs","apps/glitchpad/src/components/TaskSurface.tsx","apps/glitchpad/src/components/TaskSurface.test.tsx","apps/glitchpad/src/domain/large-text-gateway.ts","apps/glitchpad/src/domain/large-text-gateway.test.ts","scripts/check-app-layout.mjs","crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/LegacyClipboardTextProvider.kt","crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/SharedFileProvider.kt","crates/glitchpad-host/src/lib.rs","scripts/run-android-connected-tests.sh",'crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidDeliveryInstrumentedTest.kt','scripts/run-android-instrumentation.sh','scripts/run-android-evidence.test.mjs','scripts/validate-android-recovery-evidence.mjs','scripts/test-android-recovery-evidence.mjs','scripts/check-android-package.mjs','scripts/check-android-package.test.mjs','packaging/android/package-contract.json','packaging/android/intent-map.json','crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/AndroidSourcePlugin.kt','crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/ClipboardTextStore.kt','crates/glitchpad-android-source/android/src/test/java/com/shruggietech/glitchpad/source/ClipboardTextStoreTest.kt','crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/ClipboardPasteReceiverActivity.java']}
sources={}
for path,before in targets.items():
 baseline=subprocess.run(['git','show','da96b0a4f96f3bcbaf9af3127ad96c064a371767:'+path],cwd=root,check=False,capture_output=True,text=True)
 if baseline.returncode and path not in ["crates/glitchpad-host/src/android_range_response.rs","crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/LegacyClipboardTextProvider.kt","crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/SharedFileProvider.kt"]: raise RuntimeError('baseline source unavailable: '+path)
 old=baseline.stdout if baseline.returncode==0 else ''; new=(root/path).read_text(encoding='utf-8')
 mapping={}
 for block in difflib.SequenceMatcher(None,old.splitlines(),new.splitlines(),autojunk=False).get_matching_blocks():
  mapping.update({block.a+i+1:block.b+i+1 for i in range(block.size)})
 sources[path]=(old,new,mapping,hashlib.sha256((root/path).read_bytes()).hexdigest())
ledger=json.loads(ledger_path.read_text(encoding='utf-8')); changes=[]; unresolved=[]
def hits(text,anchor):
 rows=[]; i=text.find(anchor)
 while i>=0:
  rows.append(text.count('\n',0,i)+1);i=text.find(anchor,i+1)
 return rows
def walk(node,pointer):
 if isinstance(node,dict):
  path=node.get('path',node.get('source'))
  if path in sources:
   old,new,mapping,digest=sources[path]
   already_current=node.get('source_sha256')==digest
   if 'source_sha256' in node and node['source_sha256']!=digest:
    changes.append({'pointer':pointer,'field':'source_sha256','before':node['source_sha256'],'after':digest});node['source_sha256']=digest
   anchor=node.get('anchor') or (node.get('source_line') if isinstance(node.get('source_line'),str) else None) or ('fun '+node['method']+'(' if node.get('method') else None)
   for field in ['line','source_line','test_line']:
    value=node.get(field)
    if not isinstance(value,int):continue
    next_line=value if already_current else mapping.get(value)
    if field!='test_line' and anchor:
     positions=hits(new,anchor)
     if next_line not in positions:next_line=positions[0] if len(positions)==1 else None
    if next_line is None:unresolved.append({'pointer':pointer,'path':path,'field':field,'line':value,'anchor':anchor});continue
    if next_line!=value:changes.append({'pointer':pointer,'field':field,'before':value,'after':next_line});node[field]=next_line
  for key,value in node.items():walk(value,pointer+'.'+key)
 elif isinstance(node,list):
  for i,value in enumerate(node):walk(value,pointer+'.'+str(i))
walk(ledger,'ledger')
report={'changes':changes,'unresolved':unresolved,'source_hashes':{p:s[3] for p,s in sources.items()},'candidate_qualified':False}
(private/'r28-hosted-source-rebind.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
if unresolved:
 print(json.dumps({'changes':len(changes),'unresolved':unresolved}));raise SystemExit(1)
ledger['local_candidate_note']='R42 source references only. All 459 cases remain pending current-candidate installed reconciliation.'
ledger_path.write_text(json.dumps(ledger,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({'changes':len(changes),'unresolved':0,'source_hashes':{p:s[3] for p,s in sources.items()}}))
