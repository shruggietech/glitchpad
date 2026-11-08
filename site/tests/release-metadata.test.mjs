import assert from 'node:assert/strict';
import test from 'node:test';
import { deploymentReleaseMetadata } from '../scripts/release-metadata.mjs';

test('a source preview cannot manufacture an unpublished tag destination', () => {
  assert.deepEqual(deploymentReleaseMetadata('0.2.1'), {
    releaseUrl: 'https://github.com/ShruggieTech/glitchpad/releases/latest',
    releaseTag: null,
    publicationContext: 'source_preview',
  });
});
test('published metadata requires the exact target tag', () => {
  assert.equal(
    deploymentReleaseMetadata('0.2.1', 'v0.2.1').releaseUrl,
    'https://github.com/ShruggieTech/glitchpad/releases/tag/v0.2.1',
  );
  assert.equal(
    deploymentReleaseMetadata('0.2.1', 'v0.2.1').publicationContext,
    'published_tag',
  );
  for (const tag of ['v0.2.0', 'refs/tags/v0.2.1', '../../outside'])
    assert.throws(
      () => deploymentReleaseMetadata('0.2.1', tag),
      /published tag/u,
    );
});
