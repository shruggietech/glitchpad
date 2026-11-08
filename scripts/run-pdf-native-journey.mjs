import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,copyFile,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
let binary=resolve(process.argv[2]||'');if(!process.argv[2])throw new Error('Native binary path required');
let packageProof=null;let packageArtifactPath=null;
if(process.argv.includes('--packaged')){
  const originalBinary=binary;const staging=await mkdtemp(join(tmpdir(),'glitchpad-pdf-package-'));const execute=promisify(execFile);let artifact;
  if(process.platform==='win32'){
    const directory=resolve('target/debug/bundle/nsis');const names=(await readdir(directory)).filter(name=>name.endsWith('.exe'));assert.equal(names.length,1);artifact=join(directory,names[0]);await execute(artifact,['/S','/D='+staging],{windowsHide:true,timeout:120000});binary=join(staging,'glitchpad-host.exe');
  }else if(process.platform==='darwin'){
    binary=resolve('target/debug/bundle/macos/Glitchpad.app/Contents/MacOS/glitchpad-host');artifact=join(staging,'Glitchpad.app.tar');await execute('tar',['-cf',artifact,'-C',resolve('target/debug/bundle/macos'),'Glitchpad.app'],{windowsHide:true,timeout:60000});
  }else{
    const directory=resolve('target/debug/bundle/deb');const names=(await readdir(directory)).filter(name=>name.endsWith('.deb'));assert.equal(names.length,1);artifact=join(directory,names[0]);await execute('dpkg-deb',['--extract',artifact,staging],{windowsHide:true,timeout:60000});binary=join(staging,'usr/bin/glitchpad-host');
  }
  const sourceBytes=await readFile(originalBinary),deliveredBytes=await readFile(binary);let comparison='exact_bytes';
  if(process.platform==='darwin'){
    const unsignedBuilt=join(staging,'unsigned-built'),unsignedDelivered=join(staging,'unsigned-delivered');await copyFile(originalBinary,unsignedBuilt);await copyFile(binary,unsignedDelivered);
    for(const path of [unsignedBuilt,unsignedDelivered]){try{await execute('codesign',['--remove-signature',path],{windowsHide:true,timeout:30000});}catch(error){if(!String(error.stderr).includes('not signed at all'))throw error;}}
    assert.deepEqual(await readFile(unsignedBuilt),await readFile(unsignedDelivered),'Signing-normalized packaged Mach-O must match the built candidate');comparison='signing_normalized_macho';
  }else assert.deepEqual(deliveredBytes,sourceBytes,'Packaged native executable must match the built candidate');
  packageArtifactPath=artifact;
  const packageBytes=await readFile(artifact);packageProof={form:process.platform==='win32'?'installed_nsis':process.platform==='darwin'?'app_bundle':'extracted_deb',package_sha256:createHash('sha256').update(packageBytes).digest('hex'),executable_sha256:createHash('sha256').update(deliveredBytes).digest('hex'),executable_bytes:deliveredBytes.length,matched_built_code:true,comparison:comparison,built_executable_sha256:createHash('sha256').update(sourceBytes).digest('hex')};
}
const output=resolve('artifacts/pdf-native');await mkdir(output,{recursive:true});if(packageArtifactPath)await copyFile(packageArtifactPath,join(output,process.platform==='win32'?'candidate.exe':process.platform==='darwin'?'candidate.app.tar':'candidate.deb'));const probe=await mkdtemp(join(tmpdir(),'glitchpad-pdf-'));
const fixture=resolve('fixtures/pdf/s049-compatibility.pdf');const original=await readFile(fixture);await copyFile(fixture,join(probe,'s049-compatibility.pdf'));await writeFile(join(probe,'enabled.marker'),'enabled\n');await writeFile(join(probe,'pdf-journey-request.marker'),'requested\n');
const child=spawn(binary,[join(probe,'s049-compatibility.pdf')],{env:{...process.env,GLITCHPAD_LIFECYCLE_PROBE_DIR:probe},windowsHide:true,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',bytes=>{stdout=(stdout+bytes).slice(-131072);});child.stderr.on('data',bytes=>{stderr=(stderr+bytes).slice(-131072);});child.on('error',error=>{stderr+=String(error);});
try{let result;const deadline=Date.now()+150000;while(Date.now()<deadline){let data=await readFile(join(probe,'pdf-journey-result.json'),'utf8').catch(()=>null);if(data){result=JSON.parse(data);break;}if(child.exitCode!==null)throw new Error('Native PDF process exited '+child.exitCode);await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(result,'Native PDF journey did not return evidence');result.package=packageProof;if(packageProof)result.evidence_class='actual_packaged_webview';await writeFile(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');assert.equal(result.source_commit,process.env.SOURCE_REF);assert.equal(result.source_unchanged,true);assert.equal(result.source_sha256,createHash('sha256').update(original).digest('hex'));assert.ok(!result.journey.error,result.journey.error);assert.equal(result.journey.worker,'true');for(const key of ['outline_named_destination','search','thumbnail','internal_link','external_link_disclosure','rotation','go_to_page','keyboard','metadata'])assert.equal(result.journey.checks[key],true,key);assert.ok(result.journey.checks.canvas_ink>500);assert.deepEqual(await readFile(join(probe,'s049-compatibility.pdf')),original);console.log('Actual native PDF reading journey passed on '+process.platform);}
finally{if(child.exitCode===null)child.kill();await writeFile(join(output,'stdout.log'),stdout);await writeFile(join(output,'stderr.log'),stderr);}
