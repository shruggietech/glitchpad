import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { promoteCommunityPackage } from './promote-community-package.mjs';
import { releaseIdentity } from './lib/release-identity.mjs';

for(const platform of ['windows','macos','linux']) test('stages '+platform+' truthfully without changing payload bytes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'s048-promote-'));
  const sourceCommit='a'.repeat(40),sourceRef='refs/heads/codex/048-test';
  const manifest={version:releaseIdentity.version,source_commit:sourceCommit,workflow_identity:'shruggietech/glitchpad/.github/workflows/'+platform+'-package.yml@'+sourceRef,
    official:false,gate_status:'candidate_valid',artifacts:[{name:'payload',signature_status:'not_applicable_unsigned_candidate'}],artifact:{name:'payload'},application:{}};
  const path=join(root,platform+'-package-manifest.json');
  const contractPath=join(root,'contract.json');
  try {
    await writeFile(path,JSON.stringify(manifest));
    await writeFile(join(root,'payload'),'immutable payload bytes');
    const payloadHash=createHash('sha256').update(await readFile(join(root,'payload'))).digest('hex');
    await writeFile(join(root,'provenance.json'),JSON.stringify({source_commit:sourceCommit,candidate_only:true}));
    await writeFile(contractPath,JSON.stringify({official:{required_evidence:['community-trust-evidence.json']}}));
    await assert.rejects(promoteCommunityPackage({platform,directory:root,sourceCommit,sourceRef:'refs/tags/'+releaseIdentity.tag,contractPath}),/branch source/u);
    await assert.rejects(promoteCommunityPackage({platform,directory:root,sourceCommit:'b'.repeat(40),sourceRef,contractPath}),/eligible/u);
    const trust=await promoteCommunityPackage({platform,directory:root,sourceCommit,sourceRef,contractPath});
    const promoted=JSON.parse(await readFile(path,'utf8'));
    assert.equal(promoted.official,true);
    assert.equal(promoted.event,'workflow_dispatch_stage');
    assert.equal(promoted.tag,releaseIdentity.tag);
    assert.equal(promoted.publication_context,'staged_unpublished');
    assert.equal(createHash('sha256').update(await readFile(join(root,'payload'))).digest('hex'),payloadHash);
    assert.equal(JSON.parse(await readFile(join(root,'provenance.json'),'utf8')).candidate_only,false);
    assert.equal(trust.trust_state,{windows:'unsigned_community',macos:'adhoc_non_notarized_community',linux:'repository_attested'}[platform]);
  } finally {await rm(root,{recursive:true,force:true});}
});
