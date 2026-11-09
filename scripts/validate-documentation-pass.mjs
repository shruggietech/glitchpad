import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const required=(condition,message)=>{if(!condition)throw Error('Prepared documentation pass: '+message);};
const same=(left,right)=>JSON.stringify(left)===JSON.stringify(right);
export function validatePreparedDocumentationPass(receipt,contract) {
  const scope=contract.release_scope;
  required(scope?.capability==='pdf' && Array.isArray(scope.slices) && scope.slices.length>0 && scope.slices.every(s=>/^S[0-9]{3}$/u.test(s)),'current release scope missing');
  required(receipt.schema_version===1 && receipt.record_kind==='prepared_documentation_pass','schema/kind invalid');
  const fields=['schema_version','record_kind','target_version','prior_version','reviewed_slices','sections_reviewed','capability_rows_changed','platform_rows_changed','security_changes','contributor_tool_changes','changelog_fragments','prepared_utc','approval_state_at_preparation','approver','approval_evidence','approval_basis'];
  required(Object.keys(receipt).every(key=>fields.includes(key)),'unexpected approval or receipt field');
  required(receipt.target_version===contract.version && receipt.prior_version===scope.prior_version,'target/prior version mismatch');
  required(same(receipt.reviewed_slices,scope.slices),'reviewed slice list mismatch');
  required(Array.isArray(receipt.sections_reviewed) && ['1','5','20','24','25','26','31','33','36'].every(s=>receipt.sections_reviewed.includes(s)),'critical specification sections missing');
  required(same(receipt.capability_rows_changed,['pdf']),'PDF capability change missing');
  required(same(receipt.platform_rows_changed,['windows','macos','linux','android']),'four-platform reconciliation missing');
  for(const field of ['security_changes','contributor_tool_changes']) required(Array.isArray(receipt[field])&&receipt[field].length>0&&receipt[field].every(text=>typeof text==='string'&&text.trim().length>0),field+' missing');
  required(same(receipt.changelog_fragments,scope.slices.map(s=>'changelog.d/'+s+'.md')),'chronological fragment set mismatch');
  required(typeof receipt.prepared_utc==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.]\d{3})?Z$/u.test(receipt.prepared_utc) && Number.isFinite(Date.parse(receipt.prepared_utc)),'UTC preparation timestamp missing');
  required(receipt.approval_state_at_preparation==='pending_owner_review'&&receipt.approver===null&&receipt.approval_evidence===null&&receipt.approval_basis==='owner_merge_and_later_publication_authorization','prepared receipt cannot claim owner approval');
  return true;
}
export async function checkPreparedDocumentationPass(repositoryRoot) {
  const root=resolve(repositoryRoot),contract=JSON.parse(await readFile(join(root,'packaging/release/package-contract.json'),'utf8'));
  required(contract.release_scope?.documentation_pass==='docs/releases/'+contract.tag+'-documentation-pass.json','documentation-pass source path mismatch');
  const receipt=JSON.parse(await readFile(join(root,contract.release_scope.documentation_pass),'utf8'));
  validatePreparedDocumentationPass(receipt,contract);
  for(const path of receipt.changelog_fragments)required((await readFile(join(root,path),'utf8')).trim().length>0,'empty fragment '+path);
  return true;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await checkPreparedDocumentationPass(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
  console.log('Prepared documentation scope is consistent; owner review and later publication authorization remain pending.');
}
