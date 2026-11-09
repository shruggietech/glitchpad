import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { PDF_RELEASE_PROFILES, validatePdfConformance } from '../pdf-conformance.mjs';
import { nativePdfConformanceRecord } from './pdf-native-record.mjs';
import { createAndroidPdfReleaseRecord, hashReleaseFile, validateReleaseDirectory } from '../validate-android-release-evidence.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const required=(value,message)=>{if(!value)throw Error('PDF release evidence: '+message);};
const platformFor=profile=>profile.startsWith('windows')?'windows':profile.startsWith('macos')?'macos':profile.startsWith('android')?'android':'linux';
const one=(files,name)=>{const matches=files.filter(path=>basename(path)===name);required(matches.length===1,'missing/duplicate '+name);return matches[0];};
export function validatePdfExecutionBindings(records, platformRuns) {
  if(!platformRuns)return;
  for(const row of records){const run=platformRuns[platformFor(row.profile)];required(run && row.execution?.run_id===run.run_id && row.execution.run_attempt===run.run_attempt,'stale execution '+row.profile);}
}
/** Independently recompute retained proof, then require the complete staged PDF matrix. */
export async function collectPdfReleaseEvidence({files,source,platformRuns}) {
  const records=[], packages={};
  const recordPaths=files.filter(path=>['conformance-record.json','pdf-conformance-record.json'].includes(basename(path)));
  required(recordPaths.length===PDF_RELEASE_PROFILES.length,'all ten native PDF profile receipts are required');
  const manifests=new Map();
  for(const platform of ['windows','macos','linux','android']){
    const path=one(files,platform+'-package-manifest.json'), bytes=await readFile(path), value=JSON.parse(bytes);
    required(value.source_commit===source,'stale '+platform+' manifest');
    manifests.set(platform,{path,value,sha:hash(bytes)});
  }
  for(const path of recordPaths){
    const record=JSON.parse(await readFile(path,'utf8')), profile=record.profile;
    required(PDF_RELEASE_PROFILES.includes(profile),'unexpected profile');
    const platform=platformFor(profile), manifest=manifests.get(platform);
    const payloads=manifest.value.artifacts ?? [manifest.value.artifact];
    const suffix=profile==='windows_installed'?'-setup.exe':profile==='windows_portable'?'.zip':platform==='macos'?'.dmg':platform==='android'?'-universal.apk':profile.endsWith('_deb')?'.deb':'.AppImage';
    const matches=payloads.filter(row=>row.name.endsWith(suffix));
    required(matches.length===1,'profile payload binding '+profile);
    const payload=matches[0], application=one(files,payload.name);
    required(await hashReleaseFile(application)===payload.sha256,'actual payload bytes changed '+profile);
    packages[profile]={artifactSha:payload.sha256,manifestSha:manifest.sha};
    if(platform==='android'){
      const summaryPath=join(dirname(path),'release-runtime.json');
      const claimed=JSON.parse(await readFile(summaryPath,'utf8'));
      const instrumentation=one(files,'instrumentation.apk');
      const summary=await validateReleaseDirectory({directory:dirname(path),source,api:profile==='android_api24'?24:36,application,instrumentation});
      assert.deepEqual(claimed,summary,'PDF release summary contradicts independently captured bytes');
      const observed=await createAndroidPdfReleaseRecord({summary,manifestPath:manifest.path,inputIdentityPath:join(dirname(instrumentation),'identity.json'),instrumentation,execution:record.execution});
      assert.deepEqual(record,observed,'PDF Android sidecar contradicts observed campaign');
    }else{
      const result=JSON.parse(await readFile(join(dirname(path),'result.json'),'utf8'));
      const observed=nativePdfConformanceRecord(result,profile);
      assert.deepEqual(record,observed,'PDF desktop sidecar contradicts native raw result');
      required(result.package?.form===profile,'desktop package profile mismatch');
      const log=await readFile(join(dirname(path),'native-print-dialogs.log'),'utf8');
      const count=platform==='macos'?(log.match(/NATIVE_PRINT_CANCEL/g)||[]).length:(log.match(/"observed_native_dialog"\s*:\s*true/g)||[]).length;
      required(count===2,'both actual native print dialogs required '+profile);
      required(result.journey.source_identity?.native===source && result.journey.source_identity.frontend===source,'native/frontend source mismatch');
      required(result.journey.checks.canvas_ink>500 && result.journey.checks.embedded_font_text===true,'actual native text/canvas proof missing');
    }
    records.push(record);
  }
  validatePdfExecutionBindings(records,platformRuns);
  const fixtureSha=await hashReleaseFile(new URL('../../fixtures/pdf/s049-compatibility.pdf',import.meta.url));
  return validatePdfConformance(records,{source,fixtureSha,packages});
}
