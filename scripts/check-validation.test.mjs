import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import test from 'node:test';

import { assertValidatorTopology } from './check-config.mjs';
import { validateLinks } from './check-links.mjs';
import { extractMermaidBlocks, validateMermaid } from './check-mermaid.mjs';
import { collectMarkdownFiles } from './validation-files.mjs';

async function temporaryRepository(t) {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-validation-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function writeFixture(root, path, content) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
  return target;
}

function repositoryPaths(root, files) {
  return files.map((file) => relative(root, file).split(sep).join('/'));
}

test('Markdown discovery is deterministic and preserves exclusion policy', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(root, 'z.md', '# Z\n');
  await writeFixture(root, 'docs with space/éclair.md', '# Unicode\n');
  await writeFixture(root, 'docs with space/alpha.md', '# Alpha\n');
  await writeFixture(root, '.agents/ignored.md', '# Ignored\n');
  await writeFixture(root, 'node_modules/ignored.md', '# Ignored\n');

  const files = await collectMarkdownFiles(root, {
    excludedDirectories: new Set(['.agents', 'node_modules']),
  });

  assert.deepEqual(repositoryPaths(root, files), [
    'docs with space/alpha.md',
    'docs with space/éclair.md',
    'z.md',
  ]);
});

test('Mermaid extraction records deterministic ordinals and opening lines', () => {
  const blocks = extractMermaidBlocks(
    '# Heading\n\n```mermaid\nflowchart TB\n  A --> B\n```\n\nText\n```mermaid\nsequenceDiagram\n  A->>B: Hi\n```\n',
  );

  assert.deepEqual(
    blocks.map(({ ordinal, line, definition }) => ({
      ordinal,
      line,
      definition,
    })),
    [
      { ordinal: 1, line: 3, definition: 'flowchart TB\n  A --> B' },
      { ordinal: 2, line: 9, definition: 'sequenceDiagram\n  A->>B: Hi' },
    ],
  );
});

test('Mermaid validation launches no browser for an empty diagram set', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(root, 'README.md', '# No diagrams\n');
  let launches = 0;

  const result = await validateMermaid({
    repositoryRoot: root,
    launchBrowser: async () => {
      launches += 1;
      throw new Error('browser should not launch');
    },
  });

  assert.equal(launches, 0);
  assert.deepEqual(result, { diagramCount: 0, fileCount: 1 });
});

test('Mermaid validation reuses one browser for every diagram', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(
    root,
    'docs/one.md',
    '```mermaid\nflowchart TB\n  A --> B\n```\n```mermaid\nflowchart TB\n  C --> D\n```\n',
  );
  await writeFixture(
    root,
    'docs/two.md',
    '```mermaid\nsequenceDiagram\n  A->>B: Hi\n```\n',
  );
  const browser = {
    closed: 0,
    async close() {
      this.closed += 1;
    },
  };
  let launches = 0;
  const rendered = [];

  const result = await validateMermaid({
    repositoryRoot: root,
    launchBrowser: async () => {
      launches += 1;
      return browser;
    },
    renderDiagram: async (actualBrowser, definition, format, options) => {
      assert.equal(actualBrowser, browser);
      assert.equal(format, 'svg');
      assert.equal(options.backgroundColor, 'transparent');
      rendered.push(definition);
      return { data: Buffer.from('<svg/>') };
    },
  });

  assert.equal(launches, 1);
  assert.equal(browser.closed, 1);
  assert.equal(rendered.length, 3);
  assert.deepEqual(result, { diagramCount: 3, fileCount: 2 });
});

test('Mermaid render failure keeps exact source metadata and closes the browser', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(
    root,
    'docs/broken diagram.md',
    '# Diagram\n\n```mermaid\nnot-a-diagram\n```\n',
  );
  let closed = 0;

  await assert.rejects(
    validateMermaid({
      repositoryRoot: root,
      launchBrowser: async () => ({
        async close() {
          closed += 1;
        },
      }),
      renderDiagram: async () => {
        throw new Error('Parse error');
      },
    }),
    /docs\/broken diagram\.md: Mermaid block 1 at line 3 failed: Parse error/,
  );
  assert.equal(closed, 1);
});

test('Mermaid launcher failure names the first pending source', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(
    root,
    'docs/launch.md',
    '```mermaid\nflowchart TB\n  A --> B\n```\n',
  );

  await assert.rejects(
    validateMermaid({
      repositoryRoot: root,
      launchBrowser: async () => {
        throw new Error('browser unavailable');
      },
    }),
    /docs\/launch\.md: Mermaid browser launch failed before block 1 at line 1: browser unavailable/,
  );
});

test('Link validation accepts alive results and preserves path context', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(
    root,
    'docs with space/éclair.md',
    '[Local](./target.md)\n',
  );
  await writeFixture(root, 'docs with space/target.md', '# Target\n');
  const observed = [];

  const result = await validateLinks({
    repositoryRoot: root,
    configuration: {},
    checkLinks: async (markdown, options) => {
      observed.push({ markdown, options });
      return [{ link: './target.md', status: 'alive', statusCode: 200 }];
    },
  });

  assert.equal(result.fileCount, 2);
  assert.equal(result.linkCount, 2);
  assert.equal(observed.length, 2);
  assert.ok(
    observed.every(({ options }) => options.baseUrl.startsWith('file:')),
  );
  assert.ok(
    observed.every(({ options }) => options.projectBaseUrl.startsWith('file:')),
  );
});

test('Link validation rejects dead and error results with exact targets', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(
    root,
    'docs/broken.md',
    '[Dead](https://example.invalid/dead)\n[Error](https://example.invalid/error)\n',
  );

  await assert.rejects(
    validateLinks({
      repositoryRoot: root,
      configuration: {},
      checkLinks: async () => [
        {
          link: 'https://example.invalid/dead',
          status: 'dead',
          statusCode: 404,
        },
        {
          link: 'https://example.invalid/error',
          status: 'error',
          statusCode: 500,
          err: new Error('network unavailable'),
        },
      ],
    }),
    (error) => {
      assert.match(
        error.message,
        /docs\/broken\.md: dead link https:\/\/example\.invalid\/dead \(status 404\)/,
      );
      assert.match(
        error.message,
        /docs\/broken\.md: error link https:\/\/example\.invalid\/error \(status 500; network unavailable\)/,
      );
      return true;
    },
  );
});

test('Link checker exceptions retain their source file', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(root, 'docs/checker.md', '[Link](./target.md)\n');

  await assert.rejects(
    validateLinks({
      repositoryRoot: root,
      configuration: {},
      checkLinks: async () => {
        throw new Error('checker crashed');
      },
    }),
    /docs\/checker\.md: link checker failed: checker crashed/,
  );
});

test('Validator topology accepts direct Node scripts and one browser launch', () => {
  assert.doesNotThrow(() =>
    assertValidatorTopology({
      packageScripts: {
        'docs:links': 'node scripts/check-links.mjs',
        'docs:mermaid': 'node scripts/check-mermaid.mjs',
      },
      sources: {
        links: "import thing from 'library';\nawait thing();\n",
        mermaid:
          "import puppeteer from 'puppeteer';\nawait puppeteer.launch({});\n",
      },
    }),
  );
});

for (const [label, source] of [
  ['package manager', 'await pnpm();'],
  ['PowerShell', 'await powershell();'],
  ['command shell', 'await cmd.exe();'],
  ['process spawning', "import { spawn } from 'node:child_process';"],
  [
    'repeated browser launch',
    'await puppeteer.launch({});\nawait puppeteer.launch({});',
  ],
  ['missing browser launch', 'await renderMermaid();'],
]) {
  test(`Validator topology rejects ${label} regressions`, () => {
    assert.throws(
      () =>
        assertValidatorTopology({
          packageScripts: {
            'docs:links': 'node scripts/check-links.mjs',
            'docs:mermaid': 'node scripts/check-mermaid.mjs',
          },
          sources: { links: source, mermaid: source },
        }),
      /validation process topology/i,
    );
  });
}
