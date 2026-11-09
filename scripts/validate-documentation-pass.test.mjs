import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {validatePreparedDocumentationPass} from './validate-documentation-pass.mjs';
const receipt=JSON.parse(await readFile(new URL('../docs/releases/v0.3.0-documentation-pass.json',import.meta.url),'utf8'));
const contract=JSON.parse(await readFile(new URL('../packaging/release/package-contract.json',import.meta.url),'utf8'));
test('prepared documentation pass binds current release scope without claiming owner approval',()=>{assert.equal(validatePreparedDocumentationPass(receipt,contract),true);});
test('version, prior release, slices, platform/claim/security/tooling/fragment and timestamp omissions fail',()=>{for(const mutate of [r=>r.target_version='9.9.9',r=>r.prior_version='0.1.0',r=>r.reviewed_slices=['S049'],r=>r.sections_reviewed=[],r=>r.capability_rows_changed=[],r=>r.platform_rows_changed=['android'],r=>r.security_changes=[],r=>r.contributor_tool_changes=[],r=>r.changelog_fragments=['changelog.d/S049.md'],r=>r.prepared_utc='not-a-date']){const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>validatePreparedDocumentationPass(changed,contract));}});
test('prepared receipts cannot invent approval actor, evidence or publication authorization',()=>{for(const mutate of [r=>r.approval_state_at_preparation='approved',r=>r.approver='invented approver',r=>r.approval_evidence='invented approval',r=>r.approval_basis='automatic',r=>r.owner_authorized=true]){const changed=structuredClone(receipt);mutate(changed);assert.throws(()=>validatePreparedDocumentationPass(changed,contract));}});
