import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import YAML from 'yaml';
const base = '404c73e7a90d5e50f3af4c7589073c6c830144a5';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const cargoPackages = (s) => [...s.matchAll(/\[\[package\]\]([\s\S]*?)(?=\n\[\[|$)/g)].map((m) => Object.fromEntries([...m[1].matchAll(/^(name|version|checksum|source) = "([^"]+)"$/gm)].map((a) => [a[1], a[2]])));
const oldCargo = new Set(cargoPackages(git('show', base + ':Cargo.lock')).map((p) => p.name + '@' + p.version));
const crates = cargoPackages(await fs.readFile('Cargo.lock', 'utf8')).filter((p) => p.source?.startsWith('registry') && !oldCargo.has(p.name + '@' + p.version));
const oldPnpm = YAML.parse(git('show', base + ':pnpm-lock.yaml'));
const newPnpm = YAML.parse(await fs.readFile('pnpm-lock.yaml', 'utf8'));
const list = JSON.parse(execFileSync('pnpm', ['--filter', '@shruggietech/glitchpad', 'list', '--prod', '--json', '--depth', 'Infinity'], { encoding: 'utf8', maxBuffer: 32*1024*1024 }));
const npm = new Map();
const visit = (deps) => { for (const [name, p] of Object.entries(deps || {})) { const key = name + '@' + p.version; if (newPnpm.packages[key] && !oldPnpm.packages[key]) npm.set(key, {name, version:p.version, path:p.path, integrity:newPnpm.packages[key].resolution?.integrity}); visit(p.dependencies); } };
for (const project of list) visit(project.dependencies);
const sections = [], provenance = [];
async function licenses(root) {
  let files = (await fs.readdir(root, {withFileTypes:true})).filter((f) => f.isFile() && /^(license|copying|notice)([-_.]|$)/i.test(f.name)).map((f) => f.name).sort();
  if (!files.length) throw new Error('Missing exact license texts in ' + root);
  const texts = [];
  for (const file of files) { const data = await fs.readFile(path.join(root,file)); texts.push({file,sha256:sha256(data),text:data.toString('utf8')}); }
  return texts;
}
const registry = path.join(process.env.CARGO_HOME || path.join(os.homedir(),'.cargo'),'registry','src');
const registryRoots = await fs.readdir(registry);
for (const p of crates) {
  let root; for (const r of registryRoots) { const candidate = path.join(registry,r,p.name+'-'+p.version); if (await fs.stat(candidate).then((s)=>s.isDirectory(),()=>false)) {root=candidate;break;} }
  if (!root) throw new Error('Missing downloaded crate ' + p.name+'@'+p.version);
  const texts = await licenses(root); sections.push('Component: '+p.name+'-'+p.version+'\n\n'+texts.map((t)=>t.text.trim()).join('\n\n'));
  provenance.push({ecosystem:'cargo',name:p.name,version:p.version,registry_checksum:p.checksum,texts:texts.map(({text,...t})=>t)});
}
for (const [name,version,checksum] of [['tao','0.37.2','d5777b06fe6435126ae8d816eba269e050e1e10d302cf5461e9c49eccabc3548'],['wry','0.57.1','759c50ddad0ef9913bb5496cb9d509a50433a3b78cb0238d61105526589cf0e9']]) {
  const texts = await licenses('vendor/'+name+'-'+version);
  sections.push('Component: '+name+'-'+version+' (Glitchpad patch)\n\n'+texts.map((t)=>t.text.trim()).join('\n\n'));
  provenance.push({ecosystem:'cargo',name,version,upstream_archive_sha256:checksum,vendored_patch:true,texts:texts.map(({text,...t})=>t)});
}
for (const p of [...npm.values()].sort((a,b)=>(a.name+'@'+a.version).localeCompare(b.name+'@'+b.version))) {
  const texts = await licenses(p.path); sections.push('Component: '+p.name+'-'+p.version+'\n\n'+texts.map((t)=>t.text.trim()).join('\n\n'));
  provenance.push({ecosystem:'npm',name:p.name,version:p.version,registry_integrity:p.integrity,texts:texts.map(({text,...t})=>t)});
}
for (const platform of ['windows','macos','linux','android']) {
  const file = 'packaging/'+platform+'/THIRD_PARTY_NOTICES.txt';
  const previous = git('show',base+':'+file).trimEnd();
  await fs.writeFile(file,previous+'\n\nDependabot dependency convergence (2026-11-09). Changed application dependencies and exact upstream license texts follow. Current platform SBOMs identify distributed components.\n\n'+sections.join('\n\n')+'\n');
}
await fs.writeFile('packaging/dependabot-20261109-notice-sources.json',JSON.stringify({schema_version:1,baseline:base,source_policy:'Changed Cargo lock packages and application production npm packages. Exact downloaded registry license texts bound to lock checksums and integrity.',components:provenance},null,2)+'\n');
console.log('Updated exact notices for '+crates.length+' Cargo packages and '+npm.size+' application npm packages.');
