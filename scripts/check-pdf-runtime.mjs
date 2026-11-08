import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { installNativeSeams } from './check-android-authoring-layout.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=resolve(root,'apps/glitchpad/dist');
const legacy=process.argv.includes('--legacy');
const output=resolve(root,'artifacts/pdf-runtime',legacy?'chrome69':'current');
await mkdir(output,{recursive:true});
const fixture=await readFile(resolve(root,'fixtures/pdf/s049-compatibility.pdf'));
const errors=[];const consoleMessages=[];const requests=[];
const server=createServer(async(request,response)=>{
  try {
    const url=new URL(request.url,'http://127.0.0.1');
    const path=resolve(dist,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
    if(!path.startsWith(dist+sep)){response.writeHead(403);response.end();return;}
    const headers={'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream'};
    if(/^\/assets\/pdf-worker-[A-Za-z0-9_-]+\.js$/.test(url.pathname))headers['Content-Security-Policy']="default-src 'none'; connect-src 'none'; script-src 'none'; worker-src 'none'; child-src 'none'; object-src 'none'; base-uri 'none'";
    response.writeHead(200,headers);response.end(await readFile(path));
  }catch{response.writeHead(404);response.end();}
});
server.listen(0,'127.0.0.1');await once(server,'listening');
const implementation=legacy?await import('/tmp/glitchpad-browser-compat/client/node_modules/puppeteer-core/index.js'):await import('puppeteer');
const browser=await implementation.default.launch({headless:legacy?true:'shell',...(legacy?{executablePath:'/tmp/glitchpad-browser-compat/chromium/linux-576753/chrome-linux/chrome'}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const version=await browser.version();if(legacy)assert.match(version,/69\.0\.3497\.0/);
  const page=await browser.newPage();await page.setViewport({width:480,height:800});
  await page.setUserAgent('Mozilla/5.0 (Linux; Android 7.0) AppleWebKit/537.36 Chrome/69.0.3497.0 Mobile Safari/537.36');
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>consoleMessages.push(message.text()));
  page.on('request',request=>requests.push(request.url()));
  await page.evaluateOnNewDocument(installNativeSeams);
  await page.evaluateOnNewDocument(function(encoded){
    var binary=atob(encoded),bytes=new Uint8Array(binary.length);for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    var original=window.__TAURI_INTERNALS__.invoke;
    var identity={authority:'synthetic',scope:'s049-browser',token:'pdf-fixture',strength:'strong'};
    var revision={identity:identity,byte_length:bytes.length,modified_unix_nanos:'1',change_token:null};
    var summary={source_id:'pdf-fixture',descriptor:{identity:identity,restoration_reference:null,display_name:'s049-compatibility.pdf',claimed_media_type:'application/pdf',byte_length:bytes.length,modified_unix_ms:1,kind:'document_uri',capabilities:{read:true,seek:true,stream:true,metadata:true,observe_revision:true,revalidate:true,watch:false,write:false,replace_atomically:false,persistent_permission:false,rename:false,observe_deletion:false,reopen:true,reveal_location:false}},external_revision:revision,delivery_kind:'open_result',grant:{read:true,write:false,persisted_read:false,persisted_write:false,restorable:false}};
    window.__pdfReads=[];window.__pdfForbiddenCalls=[];
    window.__TAURI_INTERNALS__.invoke=async function(command,args){
      args=args||{};
      if(command==='open_android_document')return summary;
      if(command==='identify_image_source')return null;
      if(command==='identify_pdf_source')return true;
      if(command==='revalidate_android_source')return {source_id:'pdf-fixture',expected:revision,current:revision,status:'match'};
      if(command==='read_android_range'){
        if(args.sourceId!=='pdf-fixture'||args.length>262144||args.offset<0||args.offset+args.length>bytes.length)throw new Error('Invalid bounded source read');
        window.__pdfReads.push({offset:args.offset,length:args.length});var chunk=Array.from(bytes.slice(args.offset,args.offset+args.length));
        return args.binary?[args.offset+args.length>=bytes.length?1:0].concat(chunk):{source_id:'pdf-fixture',offset:args.offset,bytes:chunk,end_of_source:args.offset+args.length>=bytes.length};
      }
      if(/save|write|open_external/.test(command))window.__pdfForbiddenCalls.push(command);
      return original(command,args);
    };
  },fixture.toString('base64'));
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'networkidle0'});
  await page.waitForSelector('.add-document-trigger');await page.click('.add-document-trigger');
  await page.evaluate(function(){var button=Array.from(document.querySelectorAll('.add-document-menu button')).find(function(node){return /Open/.test(node.textContent);});if(!button)throw new Error('Open picker action missing');button.click();});
  try{await page.waitForFunction("document.querySelector('[data-pdf-ready=true][data-pdf-worker=true]')",{timeout:60000});}
  catch(error){await writeFile(resolve(output,'failure.json'),JSON.stringify({version,errors,consoleMessages,body:await page.$eval('body',node=>node.innerText)},null,2)+'\n');await page.screenshot({path:resolve(output,'failure.png')});throw error;}
  const facts=await page.evaluate(function(){
    var canvas=document.querySelector('.pdf-page canvas');var pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;var ink=0;for(var i=0;i<pixels.length;i+=4)if(pixels[i]<200&&pixels[i+1]<200&&pixels[i+2]<200)ink++;
    var text=document.querySelector('.pdf-text-layer');var selection=window.getSelection();selection.selectAllChildren(text);var selected=selection.toString();selection.removeAllRanges();
    return {width:canvas.width,height:canvas.height,ink:ink,text:text.textContent,selected:selected,reads:window.__pdfReads,forbidden:window.__pdfForbiddenCalls,executed:window.__s049PdfExecuted===true,engine:document.querySelector('.pdf-layout').getAttribute('data-pdf-engine'),frames:document.querySelectorAll('[data-bb-app-frame]').length};
  });
  assert.ok(facts.ink>500,'Actual canvas needs representative text ink');assert.match(facts.text,/Glitchpad PDF compatibility page 1/);assert.match(facts.selected,/Glitchpad PDF compatibility/);assert.equal(facts.engine,'6.5.438');assert.equal(facts.frames,1);assert.equal(facts.executed,false);assert.deepEqual(facts.forbidden,[]);assert.ok(facts.reads.reduce((sum,r)=>sum+r.length,0)<fixture.length,'First content must not require whole-source reads');assert.ok(!requests.some(url=>url.includes('example.invalid')));
  await page.click('button[aria-label="Next page"]');await page.waitForFunction("document.querySelector('[data-pdf-ready=true]') && document.querySelector('.pdf-text-layer').textContent.includes('page 2')",{timeout:30000});
  await page.screenshot({path:resolve(output,'page.png')});
  await writeFile(resolve(output,'result.json'),JSON.stringify({schema_version:1,diagnostic_only:true,candidate_qualified:false,evidence_class:'production_browser_synthetic_native_boundary',source:process.env.SOURCE_REF||null,browser:version,fixture_sha256:createHash('sha256').update(fixture).digest('hex'),facts,errors,consoleMessages,requests,second_page:true},null,2)+'\n');
  assert.deepEqual(errors,[]);console.log('PDF production browser read/navigation passed: '+version);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
