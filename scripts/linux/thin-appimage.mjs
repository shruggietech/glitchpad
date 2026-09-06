import { execFile } from 'node:child_process';
import { appendFile, chmod, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const forbiddenAppImagePaths = [
  'usr/lib/libjavascriptcoregtk-4.1.so.0',
  'usr/lib/libwebkit2gtk-4.1.so.0',
  'usr/lib/x86_64-linux-gnu/webkit2gtk-4.1',
];

export function assertThinInventory(paths) {
  const normalized = paths.map((path) => path.replace(/^\.\//u, ''));
  for (const forbidden of forbiddenAppImagePaths) {
    if (normalized.some((path) => path === forbidden || path.startsWith(`${forbidden}/`)))
      throw new Error(`thin AppImage still bundles ${forbidden}`);
  }
  return true;
}

async function command(program, arguments_) {
  try {
    return await execFileAsync(program, arguments_, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  } catch (error) {
    const code = typeof error?.code === 'string' || typeof error?.code === 'number' ? error.code : 'unknown';
    throw new Error(`native_command_failed:${program}:${code}`);
  }
}

export async function buildThinAppImage({ inputPath, appDir, outputPath }) {
  const input = resolve(inputPath);
  const directory = resolve(appDir);
  const output = resolve(outputPath);
  const [{ stdout }, inputBytes] = await Promise.all([
    command(input, ['--appimage-offset']),
    readFile(input),
  ]);
  const offset = Number.parseInt(stdout.trim(), 10);
  if (!Number.isSafeInteger(offset) || offset < 4096 || offset >= inputBytes.length)
    throw new Error('invalid AppImage runtime offset');
  for (const path of forbiddenAppImagePaths)
    await rm(resolve(directory, path), { recursive: true, force: true });
  const libraryRoot = resolve(directory, 'usr/lib');
  for (const entry of await readdir(libraryRoot)) {
    if (entry !== 'Glitchpad')
      await rm(resolve(libraryRoot, entry), { recursive: true, force: true });
  }
  const squashfsPath = `${output}.squashfs`;
  await rm(squashfsPath, { force: true });
  await command('mksquashfs', [
    directory,
    squashfsPath,
    '-noappend',
    '-all-root',
    '-comp',
    'gzip',
    '-Xcompression-level',
    '9',
    '-b',
    '1048576',
  ]);
  await writeFile(output, inputBytes.subarray(0, offset));
  await appendFile(output, await readFile(squashfsPath));
  await chmod(output, 0o755);
  await rm(squashfsPath, { force: true });
  const metadata = await stat(output);
  return { bytes: metadata.size, offset };
}

function parseArguments(arguments_) {
  const result = {};
  const names = new Map([['--input', 'inputPath'], ['--appdir', 'appDir'], ['--output', 'outputPath']]);
  for (let index = 0; index < arguments_.length; index += 1) {
    const key = names.get(arguments_[index]);
    const value = arguments_[++index];
    if (!key || !value || value.startsWith('--')) throw new Error('argument_invalid');
    result[key] = value;
  }
  for (const key of names.values()) if (!result[key]) throw new Error(`argument_missing:${key}`);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  buildThinAppImage(parseArguments(process.argv.slice(2)))
    .then(({ bytes }) => console.log(`Built thin AppImage (${bytes} bytes).`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'thin_appimage_failed'}\n`);
      process.exitCode = 1;
    });
}
