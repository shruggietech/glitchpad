import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadPublicSources,
  verifyPublicSources,
} from './check-public-release.mjs';

test('repository public release sources satisfy the current authority', async () => {
  const sources = await loadPublicSources();
  assert.deepEqual(verifyPublicSources(sources), []);
  assert.doesNotMatch(sources.readme, /shields\.io\/badge\/platforms-/u);
  assert.match(sources.readme, /## Supported platforms/u);
  assert.match(sources.readme, /Windows 11 x86_64/u);
  assert.match(sources.readme, /macOS 13\+ universal/u);
  assert.match(sources.readme, /Ubuntu 22\.04\/24\.04 x86_64/u);
  assert.match(sources.readme, /Android 7\.0\+/u);
});

test('active public authority rejects the legacy v0.1.2 identity', async () => {
  const sources = await loadPublicSources();
  const errors = verifyPublicSources({
    ...sources,
    readme: sources.readme.replaceAll('0.1.3', '0.1.2'),
  });
  assert.match(errors.join('\n'), /0\.1\.3|current release identity/u);
});

for (const [name, mutate, expected] of [
  [
    'stale availability',
    (sources) => {
      sources.footer += '\nNo installable release is available yet.';
    },
    /stale release-availability claim/,
  ],
  [
    'wrong slogan',
    (sources) => {
      sources.home = sources.home.replace(
        'View your files.',
        'Keep your flow.',
      );
    },
    /missing View your files/,
  ],
  [
    'missing ownership',
    (sources) => {
      sources.home = sources.home.replace(
        'A ShruggieTech project.',
        'Independent project.',
      );
    },
    /missing A ShruggieTech project/,
  ],
  [
    'noncanonical endorsement typography',
    (sources) => {
      sources.styles = sources.styles.replace(
        /(\.hero-endorsement\s*\{[^}]*?)text-transform: uppercase/s,
        '$1text-transform: none',
      );
    },
    /endorsement typography is not governed/,
  ],
  [
    'stale specification date',
    (sources) => {
      sources.specification = sources.specification.replace(
        '| Updated | 2026-09-11 |',
        '| Updated | 2026-08-30 |',
      );
    },
    /missing \| Updated \| 2026-09-11/,
  ],
  [
    'primary support navigation',
    (sources) => {
      sources.navigation += "\n{ text: 'Support', url: '/support' }";
    },
    /primary navigation contains Support or Security/,
  ],
  [
    'pull request deployment authority',
    (sources) => {
      sources.workflow = sources.workflow.replaceAll(
        "github.event_name == 'push'",
        "github.event_name == 'pull_request'",
      );
    },
    /exact trusted deployment authority|missing github\.event_name == 'push'/,
  ],
  [
    'stale deployment guard',
    (sources) => {
      sources.workflow = sources.workflow.replace(
        'github.rest.repos.getBranch',
        'github.rest.repos.getCommit',
      );
    },
    /missing github\.rest\.repos\.getBranch/,
  ],
  [
    'missing publisher deployment handoff',
    (sources) => {
      sources.releaseWorkflow = sources.releaseWorkflow.replace(
        'uses: ./.github/workflows/docs.yml',
        'uses: ./.github/workflows/missing.yml',
      );
    },
    /missing uses: \.\/\.github\/workflows\/docs\.yml/,
  ],
]) {
  test(`public authority rejects ${name}`, async () => {
    const sources = await loadPublicSources();
    mutate(sources);
    assert.match(verifyPublicSources(sources).join('\n'), expected);
  });
}

for (const [name, mutate, expected] of [
  [
    'cleanup close-event trigger',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replace(
        'pull_request_target:',
        'pull_request:',
      );
    },
    /missing pull_request_target:/,
  ],
  [
    'cleanup excess permission',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replace(
        'contents: write',
        'contents: write\n  issues: write',
      );
    },
    /unsafe excess token permission/,
  ],
  [
    'cleanup merged-state gate',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replace(
        'github.event.pull_request.merged == true &&',
        'true &&',
      );
    },
    /missing github\.event\.pull_request\.merged == true/,
  ],
  [
    'cleanup same-repository job gate',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replace(
        'github.event.pull_request.head.repo.full_name == github.repository &&',
        'true &&',
      );
    },
    /missing github\.event\.pull_request\.head\.repo\.full_name == github\.repository/,
  ],
  [
    'cleanup pull request checkout',
    (sources) => {
      sources.cleanupWorkflow += '\n      - uses: actions/checkout@v7\n';
    },
    /unsafe pull request checkout/,
  ],
  [
    'cleanup event interpolation',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replace(
        '"$HEAD_REPOSITORY" != "$BASE_REPOSITORY"',
        '"${{ github.event.pull_request.head.repo.full_name }}" != "$BASE_REPOSITORY"',
      );
    },
    /unsafe event interpolation in executable source/,
  ],
  [
    'cleanup repository identity guard',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replace(
        '"$HEAD_REPOSITORY" != "$BASE_REPOSITORY"',
        'false',
      );
    },
    /missing "\$HEAD_REPOSITORY" != "\$BASE_REPOSITORY"/,
  ],
  [
    'cleanup default branch guard',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replace(
        '"$HEAD_REF" == "$DEFAULT_BRANCH"',
        'false',
      );
    },
    /missing "\$HEAD_REF" == "\$DEFAULT_BRANCH"/,
  ],
  [
    'cleanup revision guard',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replaceAll(
        '"$current_sha" != "$HEAD_SHA"',
        'false',
      );
    },
    /missing "\$current_sha" != "\$HEAD_SHA"/,
  ],
  [
    'cleanup deletion operation',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replace(
        '--force-with-lease="refs/heads/${HEAD_REF}:${HEAD_SHA}"',
        '--force',
      );
    },
    /missing --force-with-lease=/,
  ],
  [
    'cleanup absent-ref handling',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replaceAll(
        '$lookup_status -eq 2',
        'false',
      );
    },
    /missing \$lookup_status -eq 2/,
  ],
  [
    'cleanup unexpected-error propagation',
    (sources) => {
      sources.cleanupWorkflow = sources.cleanupWorkflow.replaceAll(
        'exit "$lookup_status"',
        'exit 0',
      );
    },
    /missing exit "\$lookup_status"/,
  ],
]) {
  test(`public authority rejects ${name}`, async () => {
    const sources = await loadPublicSources();
    mutate(sources);
    assert.match(verifyPublicSources(sources).join('\n'), expected);
  });
}
