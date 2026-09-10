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
        '| Updated | 2026-09-09 |',
        '| Updated | 2026-08-30 |',
      );
    },
    /missing \| Updated \| 2026-09-09/,
  ],
  [
    'primary support navigation',
    (sources) => {
      sources.navigation += "\n{ text: 'Support', url: '/support' }";
    },
    /primary navigation contains Support or Security/,
  ],
  [
    'premature main deployment',
    (sources) => {
      sources.workflow = sources.workflow.replace(
        "github.event_name == 'release'",
        "github.event_name == 'push'",
      );
    },
    /does not restrict deployment to a release event|permits deployment before publication/,
  ],
]) {
  test(`public authority rejects ${name}`, async () => {
    const sources = await loadPublicSources();
    mutate(sources);
    assert.match(verifyPublicSources(sources).join('\n'), expected);
  });
}
