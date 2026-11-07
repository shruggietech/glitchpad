import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function configureAndroidTaskAvd(path) {
  const original = await readFile(path, 'utf8');
  const lines = original
    .replace(/^\uFEFF/u, '')
    .replaceAll('\r\n', '\n')
    .split('\n');
  const retained = lines.filter(
    (line) => !/^[ \t]*hw\.mainKeys[ \t]*=/u.test(line),
  );
  while (retained.at(-1) === '') retained.pop();
  const configured = [...retained, 'hw.mainKeys=no', ''].join('\n');
  await writeFile(path, configured, 'utf8');
  return {
    hardware_main_keys: false,
    config_sha256: createHash('sha256').update(configured).digest('hex'),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (process.argv.length !== 3)
    throw new Error('An existing AVD config.ini path is required.');
  console.log(
    's047_avd_hardware=' +
      JSON.stringify(await configureAndroidTaskAvd(process.argv[2])),
  );
}
