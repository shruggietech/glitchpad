import assert from 'node:assert/strict';
import {readFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyPdfFixtureManifests(root=fileURLToPath(new URL('../',import.meta.url))) {
  const directory=join(root,'fixtures/pdf');
  const original=JSON.parse(await readFile(join(directory,'pdf-fixtures.json'),'utf8'));
  const additions=JSON.parse(await readFile(join(directory,'s050-fixtures.json'),'utf8'));
  assert.equal(additions.preserved_s049.length,8,'All eight original S049 fixtures remain pinned');
  assert.equal(original.fixtures.length,8,'The original S049 manifest must not lose entries');
  for(const row of additions.preserved_s049)assert.equal(original.fixtures.find(f=>f.name===row.name)?.sha256,row.sha256,'Historical fixture manifest changed: '+row.name);
  for(const [manifest,base] of [[original,directory],[additions,directory],[JSON.parse(await readFile(join(directory,'assets/asset-manifest.json'),'utf8')),join(directory,'assets')]]) {
    const rows=manifest.fixtures ?? manifest.assets;
    assert.equal(new Set(rows.map(r=>r.name)).size,rows.length,'Fixture names must be unique');
    for(const row of rows) {assert.match(row.name,/^[A-Za-z0-9_.-]+$/u);const bytes=await readFile(join(base,row.name));assert.equal(bytes.length,row.bytes,row.name+' byte length');assert.equal(digest(bytes),row.sha256,row.name+' digest');}
  }
  const source=await readFile(join(directory,'source/NotoSansHebrew-variable.ttf'));
  assert.equal(source.length,112640);
  assert.equal(digest(source),'7ef36a2c3593758cdb622e1bdef4f84523e92fbc3ccc667438dd80ff54c2de88');
  for(const license of ['OFL-Courier-Prime.txt','OFL-Noto-Sans-Hebrew.txt'])assert.match(await readFile(join(directory,license),'utf8'),/SIL OPEN FONT LICENSE/u);
  return additions;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=fileURLToPath(new URL('../',import.meta.url));await verifyPdfFixtureManifests(root);
  if(process.argv.includes('--stage-reading-journey'))await copyFile(join(root,'scripts/pdf-reading-journey.js'),join(root,'fixtures/pdf/pdf-reading-journey.js'));
  console.log('Original and additive PDF fixture, asset, source-font and license identities agree.');
}
