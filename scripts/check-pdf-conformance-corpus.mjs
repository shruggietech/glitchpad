import assert from 'node:assert/strict';
import {verifyPdfFixtureManifests} from './check-pdf-fixtures.mjs';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function checkPdfConformanceCorpus({page,openCase,closeCase,root}) {
  const manifest=await verifyPdfFixtureManifests(root);
  const rows=[];
  const ready=async index=>page.waitForFunction(function(index){var r=document.querySelector('[data-pdf-ready=true][data-pdf-worker=true]'),p=document.querySelector('.pdf-page[data-current=true]');return r&&p&&Number(p.getAttribute('data-pdf-page'))===index&&p.querySelector('canvas').width>0;},{timeout:60000},index);
  const visible=async()=>page.evaluate(function(){var p=document.querySelector('.pdf-page[data-current=true]'),c=p.querySelector('canvas'),t=p.querySelector('.pdf-text-layer'),r=document.querySelector('.pdf-layout');return {text:t.textContent,width:c.width,height:c.height,worker:r.getAttribute('data-pdf-worker'),engine:r.getAttribute('data-pdf-engine'),observations:JSON.parse(r.getAttribute('data-pdf-observations')||'null')};});
  async function open(name) {const start=Date.now();await openCase(name);await ready(0);return {opened_epoch_ms:start,first_page_ms:Date.now()-start};}
  async function retain(name,start,extra={}) {const source=manifest.fixtures.find(f=>f.name===name);const current=await readFile(resolve(root,'fixtures/pdf',name));assert.equal(sha(current),source.sha256);rows.push({name,status:'pass',fixture_sha256:source.sha256,fixture_bytes:current.length,first_page_ms:start.first_page_ms,case_elapsed_ms:Date.now()-start.opened_epoch_ms,first_page_method:"synthetic_source_open_to_ready_canvas_text",...await visible(),...extra});await closeCase();}
  var started=await open('s050-version-1.4.pdf');
  assert.match((await visible()).text,/Glitchpad PDF compatibility page 1/u);
  await retain('s050-version-1.4.pdf',started,{version:'1.4'});
  started=await open('s050-codecs.pdf');
  const pixels=[];
  for(let index=0;index<2;index++) {
    if(index){await page.click('button[aria-label="Next page"]');await ready(index);}
    const actual=await page.evaluate(function(){var c=document.querySelector('.pdf-page[data-current=true] canvas'),ctx=c.getContext('2d');return [[.25,.25],[.75,.25],[.25,.75],[.75,.75],[.45,.25]].map(function(point){return Array.from(ctx.getImageData(Math.floor(c.width*point[0]),Math.floor(c.height*point[1]),1,1).data).slice(0,3);});});
    const expected=index===0?[[230,20,40],[20,210,40],[20,40,230],[230,210,20],[230,20,40]]:[[0,0,0],[255,255,255],[255,255,255],[0,0,0],[255,255,255]];
    for(let sample=0;sample<expected.length;sample++)for(let channel=0;channel<3;channel++)assert.ok(Math.abs(actual[sample][channel]-expected[sample][channel])<=12,(index===0?'JPX':'JBIG2')+' actual decoder pixel '+sample+': '+JSON.stringify(actual));
    pixels.push({page:index,decoder:index===0?'JPXDecode':'JBIG2Decode',expected,actual});
  }
  await retain('s050-codecs.pdf',started,{static_decoder_pixels:pixels});
  started=await open('s050-hebrew.pdf');
  const unicode=await page.evaluate(function(){var t=document.querySelector('.pdf-page[data-current=true] .pdf-text-layer'),s=window.getSelection();s.selectAllChildren(t);var selected=s.toString();s.removeAllRanges();return {text:t.textContent,selected,rtl:Array.from(t.querySelectorAll('span')).some(function(n){return n.dir==='rtl';})};});
  assert.ok(unicode.text.includes('שלום')&&unicode.selected.includes('שלום')&&unicode.rtl,'actual Hebrew ToUnicode, logical selection and RTL spans: '+JSON.stringify(unicode));
  await page.click('button[aria-label="More PDF tools"]');
  await page.evaluate(function(){Array.from(document.querySelectorAll('button')).reverse().find(function(n){return n.textContent.trim()==='Search'&&!n.disabled;}).click();});
  await page.waitForSelector('#pdf-search');
  await page.type('#pdf-search','שלום');
  await page.evaluate(function(){Array.from(document.querySelectorAll('button')).reverse().find(function(n){return n.textContent.trim()==='Search PDF'&&!n.disabled;}).click();});
  await page.waitForFunction(function(){return Array.from(document.querySelectorAll('.task-surface')).some(function(n){return /1 match/.test(n.textContent);});},{timeout:30000});
  await page.click('button[aria-label="Close Search PDF"]');
  await page.click('button[aria-label="Close PDF tools"]');
  await retain('s050-hebrew.pdf',started,{unicode,logical_search:true,arabic_shaping_claimed:false});
  started=await open('s050-geometry.pdf');
  const geometry=[];
  for(let index=0;index<3;index++){if(index){await page.click('button[aria-label="Next page"]');await ready(index);}const facts=await visible();assert.match(facts.text,/Mixed geometry source preserved/u);assert.equal(facts.width>facts.height,index!==2);geometry.push({page:index,width:facts.width,height:facts.height});}
  await retain('s050-geometry.pdf',started,{geometry});
  started=await open('s050-valid-10000.pdf');
  await page.click('button[aria-label="Go to page"]');await page.waitForSelector('#pdf-page-number');
  await page.evaluate(function(){var input=document.getElementById('pdf-page-number');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'10000');input.dispatchEvent(new Event('input',{bubbles:true}));input.form.querySelector('button[type=submit]').click();});
  await ready(9999);assert.match((await visible()).text,/Page-count contract fixture/u);
  await retain('s050-valid-10000.pdf',started,{valid_page_count:10000,last_page_rendered:true});
  const stableErrors=['malformed','incorrect_password','unsupported_encryption','source_limit','page_limit','surface_limit','source_changed','permission_revoked','worker_failure','unavailable','invalid_destination','cancelled'];
  for(const name of ['s050-huge-page.pdf','s050-cyclic-pages.pdf','s050-truncated-codecs.pdf']){
    const start=Date.now();await openCase(name);
    await page.waitForFunction(function(){var r=document.querySelector('.pdf-layout');return r&&(r.getAttribute('data-pdf-error')||r.getAttribute('data-pdf-ready')==='true');},{timeout:60000});
    const outcome=await page.evaluate(function(){var r=document.querySelector('.pdf-layout'),c=document.querySelector('.pdf-page[data-current=true] canvas');return {state:r.getAttribute('data-pdf-state'),error:r.getAttribute('data-pdf-error'),canvas:c?{width:c.width,height:c.height}:null,observations:JSON.parse(r.getAttribute('data-pdf-observations')||'null')};});
    if(name.includes("cyclic")||name.includes("truncated"))assert.ok(outcome.error,"Corrupt PDF content must expose a stable actionable failure, not silent blank success: "+name);
    if(outcome.error)assert.ok(stableErrors.includes(outcome.error));else assert.ok(outcome.canvas.width>0&&outcome.canvas.height>0&&outcome.canvas.width*outcome.canvas.height*4<=96*1024*1024);
    const original=manifest.fixtures.find(f=>f.name===name);rows.push({name,status:'pass',fixture_sha256:original.sha256,fixture_bytes:original.bytes,terminal_ms:Date.now()-start,...outcome});await closeCase();
  }
  const seed=await readFile(resolve(root,'fixtures/pdf/s050-version-1.4.pdf'));
  for(const [id,bytes] of [[0,seed],[1,seed.subarray(0,64)],[2,seed.subarray(0,seed.length-24)]]){
    assert.equal(bytes.subarray(0,5).toString('ascii'),'%PDF-');const start=Date.now();await openCase('s050-recognized-mutation-'+id+'.pdf',undefined,bytes);
    await page.waitForFunction(function(){var r=document.querySelector('.pdf-layout');return r&&(r.getAttribute('data-pdf-error')||r.getAttribute('data-pdf-ready')==='true');},{timeout:30000});
    const outcome=await page.evaluate(function(){var r=document.querySelector('.pdf-layout');return {state:r.getAttribute('data-pdf-state'),error:r.getAttribute('data-pdf-error'),text:(document.querySelector('.pdf-page[data-current=true] .pdf-text-layer')||{}).textContent||''};});
    if(id===0)assert.match(outcome.text,/Glitchpad PDF compatibility/u);else if(outcome.error)assert.ok(stableErrors.includes(outcome.error));
    rows.push({name:'recognized_seed_mutation_'+id,status:'pass',seed_sha256:sha(seed),input_sha256:sha(bytes),recognized_pdf_header:true,valid_control:id===0,terminal_ms:Date.now()-start,...outcome});await closeCase();
  }
  return {schema_version:1,status:'pass',fixture_manifest_sha256:sha(await readFile(resolve(root,'fixtures/pdf/s050-fixtures.json'))),cases:rows,scope:'Real production worker corpus with synthetic native source transport; native staged packages are separate required evidence.'};
}
