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
  for (const ext of ['docx', 'odt'])
    assert.ok(cap.forbidden_extensions.includes(ext));
});

test('owner-amended physical/manual evidence policy is explicit and never passed', async () => {
  const contract = await json('packaging/release/package-contract.json');
  assert.equal(
    contract.manual_validation,
    'physical_and_screen_reader_unavailable_owner_2026_11_02',
  );
});

test('stable PDF declarations agree across native acquisition paths', async () => {
  const cap = await json('packaging/desktop/capabilities.json');
  const families = cap.families.filter((family) => family.id === 'pdf');
  assert.equal(families.length, 1, 'one canonical PDF capability is required');
  const pdf = families[0];
  assert.deepEqual(pdf.extensions, ['pdf']);
  assert.deepEqual(pdf.media_types, ['application/pdf']);
  assert.equal(pdf.renderer, 'pdf');
  assert.equal(pdf.association, true);
  assert.equal(pdf.dialog, true);
  assert.equal(cap.forbidden_extensions.includes('pdf'), false);
  for (const platform of ['s019-windows', 's020-macos', 's021-linux']) {
    const tauri = await json(
      'crates/glitchpad-host/tauri.' + platform + '.conf.json',
    );
    const declarations = tauri.bundle.fileAssociations.filter((entry) =>
      entry.ext.includes('pdf'),
    );
    assert.equal(declarations.length, 1, platform + ' must register PDF once');
    assert.deepEqual(declarations[0].ext, ['pdf']);
    assert.equal(declarations[0].role, 'Viewer');
  }
  const intents = await json('packaging/android/intent-map.json');
  assert.ok(intents.document_extensions.includes('pdf'));
  assert.ok(intents.media_types.includes('application/pdf'));
  for (const filter of intents.intent_filters.filter(
    (entry) => entry.id !== 'launcher',
  ))
    assert.ok(filter.media_types.includes('application/pdf'), filter.id);
  const manifest = await readFile(
    new URL(
      '../crates/glitchpad-host/gen/android/app/src/main/AndroidManifest.xml',
      import.meta.url,
    ),
    'utf8',
  );
  assert.equal(
    [...manifest.matchAll(/android:mimeType="application\/pdf"/g)].length,
    2,
  );
});
