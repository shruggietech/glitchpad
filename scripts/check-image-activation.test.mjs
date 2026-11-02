import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const json = async (p) =>
  JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
const imageExtensions = [
  'bmp',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'tif',
  'tiff',
  'webp',
];
test('stable image declarations agree across every native package', async () => {
  const cap = await json('packaging/desktop/capabilities.json');
  const images = cap.families.filter((f) => f.renderer === 'image');
  assert.deepEqual(images.flatMap((f) => f.extensions).sort(), imageExtensions);
  assert.ok(images.every((f) => f.association && f.dialog));
  for (const platform of ['s019-windows', 's020-macos', 's021-linux']) {
    const tauri = await json(
      'crates/glitchpad-host/tauri.' + platform + '.conf.json',
    );
    for (const family of images) {
      const declaration = tauri.bundle.fileAssociations.find((a) =>
        a.ext.includes(family.extensions[0]),
      );
      assert.deepEqual(declaration?.ext, family.extensions);
      if (platform === 's020-macos') assert.equal(declaration.role, 'Viewer');
    }
  }
  const intents = await json('packaging/android/intent-map.json');
  for (const family of images) {
    for (const ext of family.extensions)
      assert.ok(intents.document_extensions.includes(ext));
    for (const mime of family.media_types) {
      assert.ok(intents.media_types.includes(mime));
      for (const filter of intents.intent_filters.filter(
        (f) => f.id !== 'launcher',
      ))
        assert.ok(filter.media_types.includes(mime));
    }
  }
  for (const ext of ['pdf', 'docx', 'odt'])
    assert.ok(cap.forbidden_extensions.includes(ext));
});

test('owner-amended physical/manual evidence policy is explicit and never passed', async () => {
  const contract = await json('packaging/release/package-contract.json');
  assert.equal(
    contract.manual_validation,
    'physical_and_screen_reader_unavailable_owner_2026_11_02',
  );
});
