import { readFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import markdownLinkCheck from 'markdown-link-check';

import { collectMarkdownFiles, repositoryPath } from './validation-files.mjs';

const defaultRepositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const linkExcludedDirectories = new Set([
  '.agents',
  '.specify',
  'gen',
  'node_modules',
  'target',
]);
const defaultCheckLinks = promisify(markdownLinkCheck);

function directoryUrl(path) {
  return pathToFileURL(`${resolve(path)}${sep}`).href;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function resultFailure(source, result) {
  const detail = [
    result.statusCode === undefined ? undefined : `status ${result.statusCode}`,
    result.err ? errorMessage(result.err) : undefined,
  ]
    .filter(Boolean)
    .join('; ');
  return `${source}: ${result.status} link ${result.link}${detail ? ` (${detail})` : ''}`;
}

export async function validateLinks({
  repositoryRoot = defaultRepositoryRoot,
  configuration,
  configurationPath = new URL('../.markdown-link-check.json', import.meta.url),
  checkLinks = defaultCheckLinks,
} = {}) {
  const policy =
    configuration ?? JSON.parse(await readFile(configurationPath, 'utf8'));
  const files = await collectMarkdownFiles(repositoryRoot, {
    excludedDirectories: linkExcludedDirectories,
  });
  const failures = [];
  let linkCount = 0;

  for (const file of files) {
    const source = repositoryPath(repositoryRoot, file);
    const markdown = await readFile(file, 'utf8');
    let results;
    try {
      results = await checkLinks(markdown, {
        ...policy,
        baseUrl: directoryUrl(dirname(file)),
        projectBaseUrl: directoryUrl(repositoryRoot),
        showProgressBar: false,
      });
    } catch (error) {
      failures.push(`${source}: link checker failed: ${errorMessage(error)}`);
      continue;
    }

    linkCount += results.length;
    for (const result of results) {
      if (result.status === 'dead' || result.status === 'error') {
        failures.push(resultFailure(source, result));
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Link validation failed:\n${failures.join('\n')}`);
  }

  return { fileCount: files.length, linkCount };
}

async function main() {
  const result = await validateLinks();
  console.log(`Validated links in ${result.fileCount} Markdown files.`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
