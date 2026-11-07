import hashlib, io, json, os, shutil, tarfile, tomllib, urllib.request
from pathlib import Path, PurePosixPath
root=Path(os.environ['GITHUB_WORKSPACE']); temp=Path(os.environ['RUNNER_TEMP'])
out=temp/'s047-observer-diagnostic'; out.mkdir(exist_ok=True)
candidates=list((temp/'original').rglob('application.apk'))
if len(candidates)!=1: raise RuntimeError('expected one original application APK')
app=candidates[0]
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  for chunk in iter(lambda:stream.read(1024*1024),b''): h.update(chunk)
 return h.hexdigest()
expected='939eee7b4ee3d211fb5bf82da140690248b3b5c12e6b07f40a76f91f6c9dc266'
if digest(app)!=expected or app.stat().st_size!=230309962: raise RuntimeError('original APK mismatch')
lock=tomllib.loads((root/'Cargo.lock').read_text())
pin=next(p for p in lock['package'] if p['name']=='tauri' and p['version']=='2.11.6')
with urllib.request.urlopen('https://static.crates.io/crates/tauri/tauri-2.11.6.crate',timeout=60) as response: data=response.read(64*1024*1024+1)
if len(data)>64*1024*1024 or hashlib.sha256(data).hexdigest()!=pin['checksum']: raise RuntimeError('pinned Tauri source mismatch')
android=temp/'pinned-tauri-android'; android.mkdir(exist_ok=True)
prefix='tauri-2.11.6/mobile/android/'
with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
 for member in archive.getmembers():
  if not member.name.startswith(prefix): continue
  relative=PurePosixPath(member.name[len(prefix):])
  if not relative.parts: continue
  if relative.is_absolute() or '..' in relative.parts or member.issym() or member.islnk(): raise RuntimeError('unexpected source path')
  target=android.joinpath(*relative.parts)
  if member.isdir(): target.mkdir(parents=True,exist_ok=True)
  elif member.isfile():
   target.parent.mkdir(parents=True,exist_ok=True)
   with archive.extractfile(member) as source, target.open('wb') as dest: shutil.copyfileobj(source,dest)
settings=['// Diagnostic SDK settings generated from exact pinned dependencies.']
for name,path in [('glitchpad-android-source',root/'crates/glitchpad-android-source/android'),('tauri-android',android),('tauri-plugin-opener',root/'vendor/tauri-plugin-opener-2.5.5/android')]:
 settings.extend(["include ':"+name+"'","project(':"+name+"').projectDir = new File("+json.dumps(str(path))+")"])
project=root/'crates/glitchpad-host/gen/android'
(project/'tauri.settings.gradle').write_text('\n'.join(settings)+'\n',encoding='utf-8')
(project/'app/tauri.properties').write_text('tauri.android.versionName=0.2.0\ntauri.android.versionCode=2000\n',encoding='utf-8')
(project/'app/tauri.build.gradle.kts').write_text('// Diagnostic settings from the pinned Tauri generated dependency contract.\nval implementation by configurations\ndependencies {\n  implementation("androidx.lifecycle:lifecycle-process:2.10.0")\n  implementation(project(":glitchpad-android-source"))\n  implementation(project(":tauri-android"))\n  implementation(project(":tauri-plugin-opener"))\n}\n',encoding='utf-8')
manifest={'diagnostic_only':True,'candidate_qualified':False,'product_source':'f572e0fbbd1d2978b6e4064a31817201834c8965','product_sha256':expected,'product_bytes':app.stat().st_size,'original_artifact':13555731908,'fixture_source':os.environ['GITHUB_SHA'],'native_fixture_sha256':digest(root/'crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidDeliveryInstrumentedTest.kt')}
(out/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
with open(os.environ['GITHUB_ENV'],'a',encoding='utf-8') as env: env.write('S047_ORIGINAL_APK='+str(app)+'\n')
print(json.dumps(manifest))
