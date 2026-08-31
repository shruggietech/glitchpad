import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
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
const files = [];

async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
      continue;
    }

    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collect(path);
    } else if (supportedExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }
}

await collect(repositoryRoot);

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
  if (!pattern.test(docsWorkflow))
    throw new Error(`Invalid docs workflow contract: missing ${label}`);
}

console.log(`Parsed ${files.length} JSON and YAML configuration files.`);
