import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root=process.cwd(), feature='specs/047-android-task-completion';
const ledger=JSON.parse(await readFile(resolve(root,feature,'contracts/control-ledger.json'),'utf8'));
const catalog=ledger.supplemental_evidence_catalog, cache=new Map(), refs=[], missing=[], sources=[], statuses={};
async function source(path){if(!cache.has(path)){const bytes=await readFile(resolve(root,path));cache.set(path,{text:bytes.toString('utf8'),sha256:createHash('sha256').update(bytes).digest('hex')})}return cache.get(path)}
async function walk(node,pointer){
 if(!node||typeof node!=='object')return;
 if(!Array.isArray(node)){
  const path=typeof node.path==='string'?node.path:typeof node.source==='string'?node.source:null;
  if(path){const file=await source(path), lines=file.text.split('\n');const anchor=node.anchor||(typeof node.source_line==='string'?node.source_line:node.method?'fun '+node.method+'(':null);const line=typeof node.source_line==='number'?node.source_line:node.line;
   if(node.source_sha256)assert.equal(node.source_sha256,file.sha256,pointer+' file hash');
   if(anchor){const hits=[];let i=file.text.indexOf(anchor);while(i>=0){hits.push(file.text.slice(0,i).split('\n').length);i=file.text.indexOf(anchor,i+1)}assert.ok(hits.includes(line),pointer+' anchor line '+JSON.stringify({line,hits,anchor}));}
   if(typeof line==='number')assert.ok(line>0&&line<=lines.length&&lines[line-1].trim(),pointer+' nonempty current source line');
   if(typeof node.test_line==='number'){assert.ok(node.test_line>0&&node.test_line<=lines.length&&lines[node.test_line-1].trim(),pointer+' nonempty test declaration line');assert.match(lines[node.test_line-1],/\b(?:it|test|describe|fn|fun|def)\b/,pointer+' test/helper declaration line');}
   sources.push({pointer,path,line:line??null,fingerprinted:Boolean(anchor||node.source_sha256)});
  }
 }
 for(const[key,value]of Object.entries(node)){
  if(key.endsWith('_refs')&&Array.isArray(value))for(const ref of value){refs.push(ref);if(!(ref in catalog))missing.push({pointer:pointer+'.'+key,ref})}
  await walk(value,pointer+'.'+key);
 }
}
await walk(ledger,'ledger');
assert.equal(ledger.rows.length,119);const cases=ledger.rows.flatMap(r=>r.cases);assert.equal(cases.length,459);assert.equal(new Set(cases.map(c=>c.id)).size,459);assert.deepEqual(missing,[]);
for(const row of ledger.rows){assert.ok(row.issues.length&&row.source_owner&&row.disposition);for(const c of row.cases)statuses[c.status]=(statuses[c.status]||0)+1}
const map=await readFile(resolve(root,feature,'contracts/issue-acceptance-map.md'),'utf8');const criteria=[...map.matchAll(/^\| #(249|250|251|253|254) AC(\d+) \|/gm)];assert.equal(criteria.length,27);
const counts={};for(const c of criteria)counts[c[1]]=(counts[c[1]]||0)+1;
const report={at:new Date().toISOString(),rows:ledger.rows.length,unique_cases:cases.length,catalog_entries:Object.keys(catalog).length,source_references:sources.length,fingerprinted_references:sources.filter(r=>r.fingerprinted).length,other_unit_line_pointers:sources.filter(r=>!r.fingerprinted).length,hash_anchor_line_drift:0,catalog_refs:refs.length,missing_catalog_refs:missing,criteria:criteria.length,criterion_counts:counts,case_statuses:statuses};
await writeFile(resolve(root,'.codex-tmp/s047/current-control-reference-audit.json'),JSON.stringify(report,null,2)+'\n','utf8');console.log(JSON.stringify(report));
