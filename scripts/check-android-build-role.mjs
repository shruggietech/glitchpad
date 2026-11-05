import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const role = process.argv[2],
  directory = process.argv[3] ?? 'apps/glitchpad/dist/assets';
assert(
  ['ordinary', 'fault_probe'].includes(role),
  'explicit compile role required',
);
const files = (await readdir(directory)).filter((f) => f.endsWith('.js'));
assert(files.length, 'built frontend JavaScript required');
const text = (
  await Promise.all(files.map((f) => readFile(join(directory, f), 'utf8')))
).join('\n');
const markers = [
  'glitchpad:test-recovery',
  '__GLITCHPAD_SAVE_OBSERVATION__',
  '__glitchpad_s047_missing_module__',
  'glitchpad_s047_absent_image_preview_probe',
];
for (const marker of markers)
  assert.equal(
    text.includes(marker),
    role === 'fault_probe',
    'wrong compiled activation/observation branch: ' + marker,
  );
console.log(
  JSON.stringify({
    build_variant: role,
    javascript_assets: files.length,
    activation_markers: role === 'fault_probe' ? 'present' : 'absent',
  }),
);
