import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateReleaseRow, validateReleaseAttempt, validateReleaseDirectory, releaseCaseGroups } from './validate-android-release-evidence.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const application = Buffer.from('independent canonical release bytes');
const instrumentation = Buffer.from('independent matching instrumentation bytes');
const source = 'a'.repeat(40);
const expected = {source,api:24,applicationSha:sha(application),instrumentationSha:sha(instrumentation)};
const readback = (kind) => ({kind,verified:true,expected_sha256:sha('expected document'),actual_sha256:sha('expected document')});
function row(caseId) {
  return {schema:1,status:'pass',case_id:caseId,evidence_class:'hosted_minified_release_instrumentation',
    identity:{source_commit:source,native_source_commit:source,frontend_source_commit:source,application_sha256:expected.applicationSha,instrumentation_sha256:expected.instrumentationSha,version:'0.2.1',version_code:2001,api_level:24,build_variant:'ordinary',channel:'release',application_debuggable:false,instrumentation_debuggable:true,package_identifier:'com.shruggietech.glitchpad',instrumentation_package:'com.shruggietech.glitchpad.test',signing_certificate_sha256:'b'.repeat(64),instrumentation_certificate_sha256:'b'.repeat(64),webview_package:'com.android.chrome',webview_version:'69.0.3497.100'},
    readbacks:[readback('utf8'),readback('utf8'),readback('utf8'),readback('json_save'),readback('json_receiver'),readback('png_pixels'),readback('back_retained_utf8')],
    observations:{exact_text_verified:true,recovery_phase:'verify',back_retained:true,about:{Build:source,Channel:'release'},offline_notices:{default_network_none:true,native_local_notices:true}}};
}
test('release rows require independent installed bytes, source, role and actual API', () => {
  validateReleaseRow(row('delivery'),{...expected,caseId:'delivery'});
  for(const [field,value] of Object.entries({source_commit:'c'.repeat(40),native_source_commit:'c'.repeat(40),frontend_source_commit:'c'.repeat(40),application_sha256:'c'.repeat(64),instrumentation_sha256:'c'.repeat(64),api_level:36,application_debuggable:true,build_variant:'fault_probe',channel:'debug',signing_certificate_sha256:'c'.repeat(64)})) {
    const changed=row('delivery');changed.identity[field]=value;
    assert.throws(()=>validateReleaseRow(changed,{...expected,caseId:'delivery'}),undefined,field);
  }
});
test('a marker or claimed pass cannot hide runner failure or wrong readback bytes', () => {
  const clean={pass:true,command_exit:0,logcat_exit:0,capture_exit:0};
  const marker={case_id:'delivery',file:'s048-delivery.json',sha256:'d'.repeat(64)};
  const output='OK (1 test)\nINSTRUMENTATION_CODE: -1\n';
  validateReleaseAttempt(clean,output,marker,'delivery',marker.sha256);
  assert.throws(()=>validateReleaseAttempt({...clean,command_exit:137},output,marker,'delivery',marker.sha256));
  assert.throws(()=>validateReleaseAttempt(clean,output+'INSTRUMENTATION_FAILED: process died\n',marker,'delivery',marker.sha256));
  assert.throws(()=>validateReleaseAttempt(clean,output+'INSTRUMENTATION_CODE: 0\n',marker,'delivery',marker.sha256));
  assert.throws(()=>validateReleaseAttempt(clean,output,{...marker,sha256:'e'.repeat(64)},'delivery',marker.sha256));
  const changed=row('authoring');changed.readbacks[0].actual_sha256='f'.repeat(64);
  assert.throws(()=>validateReleaseRow(changed,{...expected,caseId:'authoring'}),/readback mismatch/u);
});
async function fixture() {
  const directory=await mkdtemp(join(tmpdir(),'s048-release-'));
  const app=join(directory,'application.apk'),testApk=join(directory,'instrumentation.apk');
  await writeFile(app,application);await writeFile(testApk,instrumentation);
  for(const [group,cases] of Object.entries(releaseCaseGroups)) {
    const path=join(directory,group+'-attempt-1');await mkdir(path);
    for(const caseId of cases) {
      const png=Buffer.from('89504e470d0a1a0a00000000','hex');
      const receipt=row(caseId);receipt.screenshot={file:'s048-'+caseId+'.png',sha256:sha(png)};
      const bytes=Buffer.from(JSON.stringify(receipt));
      await writeFile(join(path,'s048-'+caseId+'.json'),bytes);
      await writeFile(join(path,'s048-'+caseId+'.png'),png);
      await writeFile(join(path,caseId+'-status.json'),JSON.stringify({pass:true,command_exit:0,logcat_exit:0,capture_exit:0}));
      await writeFile(join(path,caseId+'-instrumentation.txt'),'s048_release_evidence='+JSON.stringify({case_id:caseId,file:'s048-'+caseId+'.json',sha256:sha(bytes)})+'\nOK (1 test)\nINSTRUMENTATION_CODE: -1\n');
    }
    if(group==='delivery') {await writeFile(join(path,'s048-installed-application.apk'),application);await writeFile(join(path,'s048-installed-instrumentation.apk'),instrumentation);}
  }
  return {directory,application:app,instrumentation:testApk,source,api:24};
}
test('complete campaign selects all five cases and reads installed APK captures',async()=>{
  const input=await fixture();
  try {
    const result=await validateReleaseDirectory(input);
    assert.equal(result.selected.flatMap((entry)=>entry.cases).length,5);
    await writeFile(join(input.directory,'delivery-attempt-1','s048-installed-application.apk'),'different installed bytes');
    await assert.rejects(validateReleaseDirectory(input),/captured installed application/u);
  } finally {await rm(input.directory,{recursive:true,force:true});}
});
test('newer failed, missing and unbounded attempts cannot fall back to historical success',async()=>{
  const input=await fixture();
  try {
    const next=join(input.directory,'authoring-attempt-2');
    await cp(join(input.directory,'authoring-attempt-1'),next,{recursive:true});
    await writeFile(join(next,'authoring-status.json'),JSON.stringify({pass:false,command_exit:1,logcat_exit:0,capture_exit:0}));
    await assert.rejects(validateReleaseDirectory(input),/complete cleanly/u);
    await rm(next,{recursive:true});
    await rm(join(input.directory,'recovery-attempt-1','s048-recovery_verify.json'));
    await assert.rejects(validateReleaseDirectory(input),/ENOENT/u);
    await mkdir(join(input.directory,'delivery-attempt-3'));
    await assert.rejects(validateReleaseDirectory(input),/unbounded/u);
  } finally {await rm(input.directory,{recursive:true,force:true});}
});
test('required recovery, Diagnostics, export and offline About observations cannot be omitted',()=>{
  for(const caseId of ['delivery','authoring','recovery_verify','back_about']) {
    const changed=row(caseId);
    if(caseId==='recovery_verify')changed.observations.exact_text_verified=false;
    else if(caseId==='back_about')changed.observations.offline_notices.default_network_none=false;
    else changed.readbacks=[];
    assert.throws(()=>validateReleaseRow(changed,{...expected,caseId}));
  }
});
