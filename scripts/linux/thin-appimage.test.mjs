import assert from 'node:assert/strict';
import test from 'node:test';

import { assertThinInventory, forbiddenAppImagePaths } from './thin-appimage.mjs';

test('thin AppImage inventory rejects bundled WebKitGTK runtime files', () => {
  assert.equal(assertThinInventory(['AppRun', 'usr/bin/glitchpad-host']), true);
  for (const path of forbiddenAppImagePaths)
    assert.throws(() => assertThinInventory([path]), /still bundles/u);
});
