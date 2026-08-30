import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const excludedDirectories = new Set(['.git', '.gradle', 'build', 'coverage', 'dist', 'gen', 'node_modules', 'target']);
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
    throw new Error(`Invalid configuration in ${name}: ${error.message}`, { cause: error });
  }
}

console.log(`Parsed ${files.length} JSON and YAML configuration files.`);
