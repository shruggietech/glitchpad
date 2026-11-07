import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,dirname} from 'node:path';
const run=promisify(execFile), out=join(process.env.RUNNER_TEMP,'s047-legacy-cdp');
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
    const ws=new WebSocket(page.webSocketDebuggerUrl);let serial=0;const pending=new Map();const events=[];ws.addEventListener('message',event=>{const m=JSON.parse(String(event.data));if(m.method){events.push(m);if(events.length>50)events.shift();}});
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP connection timed out')),5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP connection failed'));},{once:true});});
    ws.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(!message.id)return;const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(Error(JSON.stringify(message.error))):item.resolve(message.result);});
    const call=(method,params={},budget=10000)=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},budget);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
    return {pid,url:page.url,call,events,close:()=>ws.close()};
  }catch(error){last=String(error);await pause(500);}}
  throw Error('No readable app WebView CDP endpoint: '+last);
}
let session;
const timeline=[];
async function checkpoint(stage){
  const result=await session.call('Runtime.evaluate',{expression:"(()=>{const a=document.activeElement;return {ready:document.readyState,rootFont:getComputedStyle(document.documentElement).fontSize,width:innerWidth,height:innerHeight,active:a&&(a.getAttribute('aria-label')||a.textContent.slice(0,80)),dialogs:Array.from(document.querySelectorAll('[role=dialog]')).map(n=>({state:n.getAttribute('data-state'),title:n.querySelector('h2')&&n.querySelector('h2').textContent,style:n.getAttribute('style')})),body:document.body.innerText.slice(0,1000)};})()",returnByValue:true},3000);
  timeline.push({stage,at:new Date().toISOString(),result});
  await writeFile(join(out,'timeline.json'),JSON.stringify(timeline,null,2)+'\n');
  return result.result.value;
}
async function tap(name,selector='button'){
  const expression="(()=>{const n=Array.from(document.querySelectorAll("+JSON.stringify(selector)+")).find(b=>!b.disabled&&!b.closest('[aria-hidden=true],[inert]')&&b.getBoundingClientRect().width>0&&(b.getAttribute('aria-label')||(b.getAttribute('role')==='menuitem'&&b.querySelector('span')?b.querySelector('span').textContent:b.textContent)).trim()==="+JSON.stringify(name)+");if(!n)return {found:false};n.scrollIntoView({block:'nearest',inline:'nearest'});const r=n.getBoundingClientRect();return {found:true,x:(r.left+r.right)/2*devicePixelRatio,y:(r.top+r.bottom)/2*devicePixelRatio,left:r.left,top:r.top,right:r.right,bottom:r.bottom,dpr:devicePixelRatio};})()";
  const result=await session.call('Runtime.evaluate',{expression,returnByValue:true},3000);
  const point=result.result.value;
  assert.equal(point.found,true,'Actual visible control must exist: '+name);
  timeline.push({stage:'tap:'+name,point});
  await writeFile(join(out,'timeline.json'),JSON.stringify(timeline,null,2)+'\n');
  await adb(['shell','input','tap',String(Math.round(point.x)),String(Math.round(point.y))]);
  await pause(400);
}
async function pauseAndCapture(error){
  const receipt={error:String(error),at:new Date().toISOString(),candidate_qualified:false,scope:'Readonly debugger interruption of retained product after physical touch; diagnostic only'};
  try{
    await session.call('Debugger.pause');await pause(300);
    const paused=session.events.filter(e=>e.method==='Debugger.paused').pop();
    receipt.paused=paused||null;
    if(paused){
      receipt.frames=[];
      for(const frame of paused.params.callFrames.slice(0,5)){
        const script=await session.call('Debugger.getScriptSource',{scriptId:frame.location.scriptId});
        const line=script.scriptSource.split('\n')[frame.location.lineNumber]||'';
        receipt.frames.push({name:frame.functionName,url:frame.url,location:frame.location,source:line.slice(Math.max(0,frame.location.columnNumber-300),frame.location.columnNumber+500)});
      }
      const frame=paused.params.callFrames[0];
      receipt.dom=await session.call('Debugger.evaluateOnCallFrame',{callFrameId:frame.callFrameId,expression:"(()=>{const n=document.querySelector('.task-surface[data-state=open]'),h=n&&n.querySelector('.task-surface-heading');return {font:getComputedStyle(document.documentElement).fontSize,style:n&&n.style.cssText,heading:h&&h.getBoundingClientRect().height};})()",returnByValue:true});
    }
    const screen=await session.call('Page.captureScreenshot',{format:'png'});
    await writeFile(join(out,'paused-screen.png'),Buffer.from(screen.data,'base64'));
  }catch(captureError){receipt.capture_error=String(captureError);}
  await writeFile(join(out,'paused-diagnostic.json'),JSON.stringify(receipt,null,2)+'\n');
  try{await session.call('Debugger.resume');}catch{}
}
try{
  const original=join(process.env.RUNNER_TEMP,'s047-cdp-original');
  const paths=await readdir(original,{recursive:true});
  const receipts=paths.filter(p=>p.endsWith('tested-apk-receipt.json'));assert.equal(receipts.length,1);
  const path=join(original,receipts[0]),receipt=JSON.parse(await readFile(path,'utf8'));
  assert.equal(receipt.source_commit,'3e5a62e370280f1e043fba05bbc83a1796153eda');
  assert.equal(receipt.candidate_build_variant,'ordinary');
  for(const item of receipt.artifacts){
    assert.ok(['application.apk','instrumentation.apk'].includes(item.filename));
    const apk=join(dirname(path),item.filename),data=await readFile(apk);
    assert.equal(data.length,item.byte_count);assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);
    await adb(['install','-r','-t','--no-streaming',apk]);
  }
  await writeFile(join(out,'provenance.json'),JSON.stringify({product_source:receipt.source_commit,driver_source:process.env.GITHUB_SHA,original_run:42362402460,apk_payload_unchanged:true,candidate_qualified:false,scope:'Physical native menu touches plus readonly CDP/debugger observations; no injected handler'},null,2)+'\n');
  for(const pkg of ['com.google.android.gms','com.google.android.googlequicksearchbox'])if((await adb(['shell','pm','list','packages',pkg])).includes('package:'+pkg))await adb(['shell','pm','disable-user','--user','0',pkg]);
  await adb(['shell','svc','power','stayon','true']);await adb(['shell','input','keyevent','224']);await adb(['shell','wm','dismiss-keyguard']);
  await adb(['shell','settings','put','secure','show_ime_with_hard_keyboard','1']);
  await adb(['shell','settings','put','system','font_scale','1.3']);
  const uri='content://com.shruggietech.glitchpad.fixture.documents/document/s047-controls.mmd';
  await adb(['shell','content','call','--uri','content://com.shruggietech.glitchpad.fixture.grants','--method','grant','--arg',uri]);
  await adb(['shell','run-as',app,'am','start','--user','0','-W','-n',app+'/.MainActivity','-a','android.intent.action.VIEW','-d',uri,'-t','text/vnd.mermaid','--grant-read-uri-permission']);
  session=await connect();await session.call('Debugger.enable');
  for(let i=0;i<30;i++){
    const state=await checkpoint('ready-'+i);
    if(state.body.includes('s047-controls.mmd'))break;
    await pause(200);
  }
  const mode=await session.call('Runtime.evaluate',{expression:"!!document.querySelector('.document-surface .mermaid-source-mode')",returnByValue:true},3000);
  if(mode.result.value){await tap('Document tools');await checkpoint('source-menu-open');await tap('Read','[role=menuitem]');await checkpoint('rendered');}
  await tap('Document tools');await checkpoint('tools-open');
  await tap('Search','[role=menuitem]');await checkpoint('after-search-touch');
  console.log('legacy_cdp_diagnostic=responsive_after_search');
}catch(error){
  if(session)await pauseAndCapture(error);
  else {await writeFile(join(out,'setup-error.json'),JSON.stringify({error:String(error),stack:String(error.stack)},null,2)+'\n');process.exitCode=1;}
  console.log('legacy_cdp_diagnostic=retained_not_qualified');
}finally{if(session)session.close();}
