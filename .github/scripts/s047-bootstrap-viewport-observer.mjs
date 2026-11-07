import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const run=promisify(execFile), out=join(process.env.RUNNER_TEMP,'s047-bootstrap-viewport');
await mkdir(out,{recursive:true});
const app='com.shruggietech.glitchpad';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const adb=async args=>{const r=await run(process.execPath,['scripts/bounded-android-adb.mjs',...args],{encoding:'utf8',timeout:70000,maxBuffer:1024*1024});return r.stdout.trim();};
async function connect(){
  const deadline=Date.now()+60000;let last;
  while(Date.now()<deadline){try{
    const pid=(await adb(['shell','pidof',app])).split(/\s+/)[0];assert.match(pid,/^\d+$/);
    await adb(['forward','tcp:9222','localabstract:webview_devtools_remote_'+pid]);
    const targets=await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
    const page=targets.find(t=>t.type==='page'&&/localhost/.test(t.url));
    if(!page)throw Error('App-owned WebView page is not ready');
    const ws=new WebSocket(page.webSocketDebuggerUrl);let serial=0;const pending=new Map();
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP connection timed out')),5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP connection failed'));},{once:true});});
    ws.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(Error(JSON.stringify(message.error))):item.resolve(message.result);});
    const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
    return {pid,url:page.url,call,close:()=>ws.close()};
  }catch(error){last=String(error);await pause(500);}}
  throw Error('No readable app WebView CDP endpoint: '+last);
}
const expression=String.raw`(()=>{
 const box=n=>{if(!n)return null;const r=n.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const nodes=Array.from(document.querySelectorAll('.task-surface')).map(n=>{const s=getComputedStyle(n),h=n.querySelector('h2'),b=n.querySelector('.task-surface-body'),bs=b&&getComputedStyle(b);return {title:h&&h.textContent,attributes:Array.from(n.attributes).reduce((a,x)=>{a[x.name]=x.value;return a;},{}),rect:box(n),maxHeight:s.maxHeight,maxWidth:s.maxWidth,overflow:s.overflow,bottom:s.bottom,nativeBlock:s.getPropertyValue('--gl-task-native-block-size'),nativeInline:s.getPropertyValue('--gl-task-native-inline-size'),body:b?{rect:box(b),scrollHeight:b.scrollHeight,clientHeight:b.clientHeight,scrollTop:b.scrollTop,overflow:bs.overflow,minHeight:bs.minHeight}:null,buttons:Array.from(n.querySelectorAll('button')).map(b=>({label:b.textContent.trim(),rect:box(b)}))};});
 return {url:location.href,readyState:document.readyState,userAgent:navigator.userAgent,width:innerWidth,height:innerHeight,rootFont:getComputedStyle(document.documentElement).fontSize,nativeInvoke:!!window.__TAURI_INTERNALS__&&typeof window.__TAURI_INTERNALS__.invoke==='function',fonts:document.fonts&&document.fonts.status,bodyText:document.body.innerText.slice(0,1800),surfaces:nodes};
})()`;
async function observe(phase){const session=await connect();const samples=[];try{
 for(let i=0;i<12;i++){
  const result=await session.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  const sample={at:new Date().toISOString(),pid:session.pid,phase,exception:result.exceptionDetails||null,value:result.result&&result.result.value};samples.push(sample);
  if(i===3||i===11){const environment=await session.call('Runtime.evaluate',{expression:"Promise.resolve().then(()=>window.__TAURI_INTERNALS__.invoke('android_diagnostic_environment',{includeViewport:true})).then(value=>({ok:true,value}),error=>({ok:false,error:String(error)}))",returnByValue:true,awaitPromise:true});sample.explicit_native_environment=environment;}
  await writeFile(join(out,phase+'.json'),JSON.stringify(samples,null,2)+'\n','utf8');await pause(500);
 }
 const screen=await run('adb',['exec-out','screencap','-p'],{encoding:'buffer',timeout:30000,maxBuffer:3*1024*1024});assert.ok(screen.stdout.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));await writeFile(join(out,phase+'.png'),screen.stdout);
 assert.ok(samples.some(s=>s.value&&s.value.surfaces.some(n=>String(n.title).startsWith('Recover '))),'The actual controlled recovery decision must be observed');
 return samples;
}finally{session.close();}}
try{
 await writeFile(join(out,'provenance.json'),JSON.stringify({product_source:process.env.GLITCHPAD_BUILD_COMMIT,driver_source:process.env.GITHUB_SHA,original_run:42358143054,scope:'Read-only CDP observation of exact retained debug APKs; actual native seed/restart/font change. Not candidate qualification.'},null,2)+'\n','utf8');
 for(const path of ['crates/glitchpad-host/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk','crates/glitchpad-host/gen/android/app/build/outputs/apk/androidTest/universal/debug/app-universal-debug-androidTest.apk'])await adb(['install','-r','-t',path]);
 await adb(['shell','settings','put','system','font_scale','1.0']);
 const seed=await run('bash',['scripts/run-android-instrumentation.sh',join(out,'seed.txt'),'draft_recovery_seed=pass','-e','waitForActivitiesToComplete','false','-e','expectedSource',process.env.GLITCHPAD_BUILD_COMMIT,'-e','expectedRole','ordinary','-e','recoveryPhase','seed','-e','class','com.shruggietech.glitchpad.source.AndroidDeliveryInstrumentedTest#draftRecoveryAcrossProcessBoundary'],{env:{...process.env,ANDROID_INSTRUMENTATION_RESET_APP_DATA:'true'},encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});await writeFile(join(out,'seed-driver.log'),seed.stdout+'\n'+seed.stderr,'utf8');
 await adb(['shell','am','force-stop',app]);
 await adb(['shell','am','start','-W','-n',app+'/.MainActivity','-a','android.intent.action.MAIN','-c','android.intent.category.LAUNCHER']);
 await observe('cold-font1');
 await adb(['shell','settings','put','system','font_scale','2.0']);await pause(1000);
 await observe('recreated-font2');
 console.log('bootstrap_viewport_observation=retained_not_qualified');
}catch(error){await writeFile(join(out,'error.json'),JSON.stringify({error:String(error),stack:String(error.stack).slice(0,5000)},null,2)+'\n','utf8');throw error;}
