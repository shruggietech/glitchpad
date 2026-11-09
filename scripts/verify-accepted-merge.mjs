import { releaseIdentity } from './lib/release-identity.mjs';
const required = (condition, message) => {
  if (!condition) throw Error('Accepted merge: ' + message);
};
const fullSha = (value) =>
  typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
export function validateObservedMerge({
  accepted,
  pr,
  sourceCommit,
  mergeCommit,
  mainCommit,
  comparison,
}) {
  const source = accepted.accepted_source_commit,
    number = accepted.implementation_pull_request?.number;
  required(
    Number.isSafeInteger(number) && number > 0 && pr.number === number,
    'PR identity mismatch',
  );
  required(
    pr.merged === true && fullSha(pr.merge_commit_sha),
    'PR has not been merged',
  );
  required(
    pr.base?.repo?.full_name?.toLowerCase() ===
      releaseIdentity.repository.toLowerCase() && pr.base.ref === 'main',
    'wrong repository or target branch',
  );
  required(
    pr.head?.sha === source &&
      sourceCommit.sha === source &&
      accepted.implementation_pull_request.head_sha === source,
    'accepted source differs from merged PR head',
  );
  required(
    mergeCommit.sha === pr.merge_commit_sha &&
      fullSha(sourceCommit.commit?.tree?.sha) &&
      sourceCommit.commit.tree.sha === mergeCommit.commit?.tree?.sha,
    'accepted and immutable merge trees differ',
  );
  required(
    typeof pr.merged_by?.login === 'string' &&
      pr.merged_by.login.length > 0 &&
      typeof pr.merged_at === 'string' &&
      Number.isFinite(Date.parse(pr.merged_at)),
    'observed merge actor/time missing',
  );
  required(
    fullSha(mainCommit.sha) &&
      ['ahead', 'identical'].includes(comparison.status) &&
      comparison.base_commit?.sha === mergeCommit.sha &&
      comparison.merge_base_commit?.sha === mergeCommit.sha,
    'merged PR is not an ancestor of observed main',
  );
  required(
    typeof pr.html_url === 'string' &&
      pr.html_url.toLowerCase() ===
        'https://github.com/' +
          releaseIdentity.repository.toLowerCase() +
          '/pull/' +
          number,
    'observed PR URL mismatch',
  );
  return {
    schema_version: 1,
    pull_request: number,
    url: pr.html_url,
    accepted_source_commit: source,
    accepted_tree: sourceCommit.commit.tree.sha,
    merge_commit: mergeCommit.sha,
    merge_actor: pr.merged_by.login,
    merged_at: pr.merged_at,
    observed_main_commit: mainCommit.sha,
    merge_ancestry_verified: true,
  };
}
export async function observeAcceptedMerge({
  accepted,
  githubJson,
  observedPr,
}) {
  const pr =
    observedPr ??
    (await githubJson('pulls/' + accepted.implementation_pull_request.number));
  required(
    pr.merged === true && fullSha(pr.merge_commit_sha),
    'PR has not been merged',
  );
  const [sourceCommit, mergeCommit, mainCommit] = await Promise.all([
    githubJson('commits/' + accepted.accepted_source_commit),
    githubJson('commits/' + pr.merge_commit_sha),
    githubJson('commits/main'),
  ]);
  const comparison = await githubJson(
    'compare/' + mergeCommit.sha + '...' + mainCommit.sha,
  );
  return validateObservedMerge({
    accepted,
    pr,
    sourceCommit,
    mergeCommit,
    mainCommit,
    comparison,
  });
}
