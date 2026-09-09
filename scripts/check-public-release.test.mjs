import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadPublicSources,
  verifyPublicSources,
} from './check-public-release.mjs';

test('repository public release sources satisfy the current authority', async () => {
  assert.deepEqual(verifyPublicSources(await loadPublicSources()), []);
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
]) {
  test(`public authority rejects ${name}`, async () => {
    const sources = await loadPublicSources();
    mutate(sources);
    assert.match(verifyPublicSources(sources).join('\n'), expected);
  });
}
