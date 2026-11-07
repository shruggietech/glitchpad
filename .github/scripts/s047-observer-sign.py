import hashlib, json, os, re, subprocess, zipfile
from pathlib import Path
out=Path(os.environ['RUNNER_TEMP'])/'s047-observer-diagnostic'
original=Path(os.environ['S047_ORIGINAL_APK']); diagnostic=out/'application.apk'
def digest(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  for chunk in iter(lambda:stream.read(1024*1024),b''): h.update(chunk)
 return h.hexdigest()
def payload(path):
 rows=[]
 with zipfile.ZipFile(path) as archive:
  for info in sorted(archive.infolist(),key=lambda x:x.filename):
   if info.is_dir(): continue
   name=info.filename.upper()
   if name.startswith('META-INF/') and (name=='META-INF/MANIFEST.MF' or name.endswith(('.RSA','.DSA','.EC','.SF'))): continue
   h=hashlib.sha256()
   with archive.open(info) as stream:
    for chunk in iter(lambda:stream.read(1024*1024),b''): h.update(chunk)
   rows.append({'name':info.filename,'bytes':info.file_size,'sha256':h.hexdigest()})
 return rows
expected='939eee7b4ee3d211fb5bf82da140690248b3b5c12e6b07f40a76f91f6c9dc266'
if digest(original)!=expected: raise RuntimeError('original APK changed')
signer=Path(os.environ['ANDROID_SDK_ROOT'])/'build-tools/36.0.0/apksigner'
subprocess.run([str(signer),'sign','--ks',str(Path.home()/'.android/debug.keystore'),'--ks-key-alias','androiddebugkey','--ks-pass','pass:android','--key-pass','pass:android','--out',str(diagnostic),str(original)],check=True)
original_payload=payload(original)
if payload(diagnostic)!=original_payload or digest(original)!=expected: raise RuntimeError('diagnostic signing changed the application payload or original')
def certificate(path):
 text=subprocess.run([str(signer),'verify','--print-certs',str(path)],text=True,capture_output=True,check=True).stdout
 result=re.search(r'certificate SHA-256 digest: ([0-9a-fA-F]{64})',text)
 if not result: raise RuntimeError('signer digest unavailable')
 return result.group(1).lower()
test=out/'instrumentation.apk'
if certificate(diagnostic)!=certificate(test): raise RuntimeError('diagnostic app and instrumentation signer mismatch')
manifest=json.loads((out/'source-manifest.json').read_text())
manifest['original_product_sha256']=manifest.pop('product_sha256')
manifest['original_product_bytes']=manifest.pop('product_bytes')
manifest.update({'product_sha256':digest(diagnostic),'product_bytes':diagnostic.stat().st_size,'instrumentation_sha256':digest(test),'debug_certificate_sha256':certificate(diagnostic),'unmodified_payload_entries':len(original_payload),'payload_inventory_sha256':hashlib.sha256(json.dumps(original_payload,sort_keys=True).encode()).hexdigest(),'identity_boundary':'separate_debug_resigned_diagnostic_copy_not_original_installed_bytes'})
(out/'source-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
(out/'original-payload-inventory.json').write_text(json.dumps(original_payload,indent=2)+'\n',encoding='utf-8')
with open(os.environ['GITHUB_ENV'],'a',encoding='utf-8') as env: env.write('S047_DIAGNOSTIC_APK='+str(diagnostic)+'\n')
print(json.dumps(manifest))
