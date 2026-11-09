import assert from 'node:assert/strict';
import test from 'node:test';
import { validateObservedMerge } from './verify-accepted-merge.mjs';
const source = 'a'.repeat(40),
  tree = 'b'.repeat(40),
  merge = 'c'.repeat(40),
  main = 'd'.repeat(40);
function proof() {
  return {
    accepted: {
      accepted_source_commit: source,
      implementation_pull_request: { number: 500, head_sha: source },
    },
    pr: {
      number: 500,
      merged: true,
      merged_at: '2026-11-09T12:00:00Z',
      merged_by: { login: 'observed-owner' },
      html_url: 'https://github.com/ShruggieTech/glitchpad/pull/500',
      merge_commit_sha: merge,
      head: { sha: source },
      base: { ref: 'main', repo: { full_name: 'ShruggieTech/glitchpad' } },
    },
    sourceCommit: { sha: source, commit: { tree: { sha: tree } } },
    mergeCommit: { sha: merge, commit: { tree: { sha: tree } } },
    mainCommit: { sha: main, commit: { tree: { sha: 'e'.repeat(40) } } },
    comparison: {
      status: 'ahead',
      base_commit: { sha: merge },
      merge_base_commit: { sha: merge },
    },
  };
}
test('observes the immutable merged PR and ancestry while allowing unrelated later main changes', () => {
  const result = validateObservedMerge(proof());
  assert.equal(result.merge_commit, merge);
  assert.equal(result.merge_actor, 'observed-owner');
  assert.equal(result.observed_main_commit, main);
  assert.equal(result.accepted_tree, tree);
});
test('unmerged, changed source/tree, missing actor/time, wrong repository and non-ancestry fail', () => {
  for (const mutate of [
    (p) => (p.pr.merged = false),
    (p) => (p.pr.head.sha = 'f'.repeat(40)),
    (p) => (p.pr.number = 501),
    (p) => (p.pr.merged_at = null),
    (p) => (p.pr.merged_by = null),
    (p) => (p.pr.base.repo.full_name = 'other/repository'),
    (p) => (p.mergeCommit.commit.tree.sha = 'f'.repeat(40)),
    (p) => (p.comparison.status = 'diverged'),
    (p) => (p.comparison.merge_base_commit.sha = 'f'.repeat(40)),
  ]) {
    const changed = proof();
    mutate(changed);
    assert.throws(() => validateObservedMerge(changed));
  }
});
