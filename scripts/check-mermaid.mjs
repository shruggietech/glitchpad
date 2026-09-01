import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderMermaid } from '@mermaid-js/mermaid-cli';
import puppeteer from 'puppeteer';

import { collectMarkdownFiles, repositoryPath } from './validation-files.mjs';

const defaultRepositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const mermaidExcludedDirectories = new Set(['gen', 'node_modules', 'target']);

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function extractMermaidBlocks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!/^```mermaid\s*$/.test(lines[index])) continue;

    const definition = [];
    const openingLine = index + 1;
    let closingIndex = index + 1;
    while (
      closingIndex < lines.length &&
      !/^```\s*$/.test(lines[closingIndex])
    ) {
      definition.push(lines[closingIndex]);
      closingIndex += 1;
    }

    if (closingIndex < lines.length) {
      blocks.push({
        ordinal: blocks.length + 1,
        line: openingLine,
        definition: definition.join('\n'),
      });
      index = closingIndex;
    }
  }

  return blocks;
}

async function defaultLaunchOptions(repositoryRoot) {
  if (process.platform !== 'linux' || process.env.GITHUB_ACTIONS !== 'true') {
    return {};
  }
  const path = resolve(repositoryRoot, '.github', 'puppeteer-ci.json');
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateMermaid({
  repositoryRoot = defaultRepositoryRoot,
  launchBrowser,
  renderDiagram = renderMermaid,
  launchOptions,
  loadLaunchOptions = defaultLaunchOptions,
} = {}) {
  const files = await collectMarkdownFiles(repositoryRoot, {
    excludedDirectories: mermaidExcludedDirectories,
  });
  const diagrams = [];

  for (const file of files) {
    const source = repositoryPath(repositoryRoot, file);
    const markdown = await readFile(file, 'utf8');
    for (const block of extractMermaidBlocks(markdown)) {
      diagrams.push({ source, ...block });
    }
  }

  if (diagrams.length === 0) {
    return { diagramCount: 0, fileCount: files.length };
  }

  const failures = [];
  let browser;
  try {
    try {
      const launch = launchBrowser ?? ((options) => puppeteer.launch(options));
      const options =
        launchOptions ??
        (launchBrowser ? {} : await loadLaunchOptions(repositoryRoot));
      browser = await launch(options);
    } catch (error) {
      const first = diagrams[0];
      failures.push(
        `${first.source}: Mermaid browser launch failed before block ${first.ordinal} at line ${first.line}: ${errorMessage(error)}`,
      );
    }

    if (browser) {
      for (const diagram of diagrams) {
        try {
          const result = await renderDiagram(
            browser,
            diagram.definition,
            'svg',
            { backgroundColor: 'transparent' },
          );
          if (!result?.data?.byteLength) {
            throw new Error('renderer returned an empty SVG');
          }
        } catch (error) {
          failures.push(
            `${diagram.source}: Mermaid block ${diagram.ordinal} at line ${diagram.line} failed: ${errorMessage(error)}`,
          );
        }
      }
    }
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        failures.push(`Mermaid browser cleanup failed: ${errorMessage(error)}`);
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Mermaid validation failed:\n${failures.join('\n')}`);
  }

  return { diagramCount: diagrams.length, fileCount: files.length };
}

async function main() {
  const result = await validateMermaid();
  console.log(`Parsed and rendered ${result.diagramCount} Mermaid diagrams.`);
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
