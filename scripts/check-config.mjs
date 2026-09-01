import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const defaultRepositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const excludedDirectories = new Set([
  '.git',
  '.gradle',
  '.next',
  '.source',
  'build',
  'coverage',
  'dist',
  'gen',
  'node_modules',
  'out',
  'playwright-report',
  'target',
  'test-results',
]);
const supportedExtensions = new Set(['.json', '.yaml', '.yml']);

function topologyError(detail) {
  throw new Error(`Invalid validation process topology: ${detail}`);
}

export function assertValidatorTopology({ packageScripts, sources }) {
  for (const [name, expected] of [
    ['docs:links', 'node scripts/check-links.mjs'],
    ['docs:mermaid', 'node scripts/check-mermaid.mjs'],
  ]) {
    if (packageScripts[name] !== expected) {
      topologyError(`${name} must be exactly "${expected}"`);
    }
  }

  for (const [name, source] of Object.entries(sources)) {
    for (const [label, pattern] of [
      ['a process-spawning Node import', /node:(?:child_process|cluster)/i],
      [
        'a nested package-manager or command-shell launcher',
        /\b(?:pnpm|pwsh|powershell|cmd\.exe)\b/i,
      ],
      [
        'a process-spawning call',
        /\b(?:exec|execFile|fork|spawn|spawnSync)\s*\(/,
      ],
    ]) {
      if (pattern.test(source)) topologyError(`${name} contains ${label}`);
    }
  }

  const browserLaunches =
    sources.mermaid.match(/\bpuppeteer\.launch\s*\(/g)?.length ?? 0;
  if (browserLaunches !== 1) {
    topologyError(
      `Mermaid validation must launch Puppeteer exactly once in source (found ${browserLaunches})`,
    );
  }
}

async function collectConfigurationFiles(repositoryRoot) {
  const files = [];

  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;

      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await collect(path);
      } else if (supportedExtensions.has(extname(entry.name))) {
        files.push(path);
      }
    }
  }

  await collect(repositoryRoot);
  return files;
}

export async function checkConfiguration(
  repositoryRoot = defaultRepositoryRoot,
) {
  const files = await collectConfigurationFiles(repositoryRoot);

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    try {
      if (extname(file) === '.json') {
        JSON.parse(source);
      } else {
        parseYaml(source);
      }
    } catch (error) {
      const name = relative(repositoryRoot, file);
      throw new Error(`Invalid configuration in ${name}: ${error.message}`, {
        cause: error,
      });
    }
  }

  const packageJson = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
  );
  assertValidatorTopology({
    packageScripts: packageJson.scripts,
    sources: {
      links: await readFile(
        join(repositoryRoot, 'scripts', 'check-links.mjs'),
        'utf8',
      ),
      mermaid: await readFile(
        join(repositoryRoot, 'scripts', 'check-mermaid.mjs'),
        'utf8',
      ),
    },
  });

  const docsWorkflowPath = join(
    repositoryRoot,
    '.github',
    'workflows',
    'docs.yml',
  );
  const docsWorkflow = await readFile(docsWorkflowPath, 'utf8');
  for (const [label, pattern] of [
    ['pull-request build trigger', /^\s*pull_request:\s*$/m],
    ['main build trigger', /^\s*push:\s*\n\s*branches:\s*\[main\]/m],
    ['explicit deployment input', /^\s*deploy:\s*$/m],
    ['read-only default permission', /^permissions:\s*\n\s*contents:\s*read/m],
    ['Pages artifact path', /^\s*path:\s*site\/out\s*$/m],
    ['protected Pages environment', /^\s*name:\s*github-pages\s*$/m],
    [
      'dispatch-only deployment condition',
      /github\.event_name == 'workflow_dispatch' && inputs\.deploy/,
    ],
  ]) {
    if (!pattern.test(docsWorkflow)) {
      throw new Error(`Invalid docs workflow contract: missing ${label}`);
    }
  }

  return files.length;
}

async function main() {
  const count = await checkConfiguration();
  console.log(`Parsed ${count} JSON and YAML configuration files.`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
