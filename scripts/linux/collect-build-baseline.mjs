import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function firstLine(value) {
  return (
    value
      .split(/\r?\n/u)
      .find((line) => line.trim())
      ?.trim() ?? ''
  );
}

function parseOsRelease(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z_]+)=(?:"([^"]*)"|(.*))$/u))
      .filter(Boolean)
      .map((match) => [match[1], match[2] ?? match[3]]),
  );
}

export async function collectBuildBaseline(
  executablePath,
  { runner = execFileAsync, osReleasePath = '/etc/os-release' } = {},
) {
  const target = process.env.GLITCHPAD_VALIDATION_TARGET;
  if (!target) throw new Error('governed container target is not observable');
  const executable = resolve(executablePath);
  const [
    osSource,
    elfHeader,
    versionInfo,
    ldd,
    webkitgtk,
    rust,
    node,
    pnpm,
    compiler,
    linker,
  ] = await Promise.all([
    readFile(osReleasePath, 'utf8'),
    runner('readelf', ['--file-header', executable]).then(
      ({ stdout }) => stdout,
    ),
    runner('readelf', ['--version-info', executable]).then(
      ({ stdout }) => stdout,
    ),
    runner('ldd', ['--version']).then(({ stdout }) => stdout),
    runner('pkg-config', ['--modversion', 'webkit2gtk-4.1']).then(
      ({ stdout }) => stdout,
    ),
    runner('rustc', ['--version']).then(({ stdout }) => stdout),
    runner('node', ['--version']).then(({ stdout }) => stdout),
    runner('pnpm', ['--version']).then(({ stdout }) => stdout),
    runner('cc', ['--version']).then(({ stdout }) => stdout),
    runner('ld', ['--version']).then(({ stdout }) => stdout),
  ]);
  const os = parseOsRelease(osSource);
  const elfMachine = elfHeader.match(/^\s*Machine:\s*(.+)$/mu)?.[1]?.trim();
  const imported = [...versionInfo.matchAll(/GLIBC_(\d+\.\d+)/gu)].map(
    (match) => match[1],
  );
  imported.sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );
  const glibcVersion = firstLine(ldd).match(/(\d+\.\d+)$/u)?.[1];
  if (
    !os.ID ||
    !os.VERSION_ID ||
    !elfMachine ||
    !glibcVersion ||
    imported.length === 0
  )
    throw new Error('governed build baseline could not be observed');
  const architecture =
    elfMachine === 'Advanced Micro Devices X86-64'
      ? 'x86_64'
      : `unsupported:${elfMachine}`;
  return {
    distribution: os.ID,
    release: os.VERSION_ID,
    architecture,
    elf_machine: elfMachine,
    container_target: target,
    glibc_version: glibcVersion,
    maximum_imported_glibc: imported.at(-1),
    webkitgtk_api: '4.1',
    webkitgtk_version: firstLine(webkitgtk),
    compiler: firstLine(compiler),
    linker: firstLine(linker),
    rust: firstLine(rust),
    node: firstLine(node),
    pnpm: firstLine(pnpm),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const value = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const executable = value('--executable');
  const output = value('--output');
  if (!executable || !output)
    throw new Error('expected --executable and --output');
  const baseline = await collectBuildBaseline(executable);
  await writeFile(
    resolve(output),
    `${JSON.stringify(baseline, null, 2)}\n`,
    'utf8',
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'baseline_collection_failed'}\n`,
    );
    process.exitCode = 1;
  });
}
