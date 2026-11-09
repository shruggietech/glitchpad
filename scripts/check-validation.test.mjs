import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  assertValidatorTopology,
  checkConfiguration,
} from './check-config.mjs';
import { validateLinks } from './check-links.mjs';
import { extractMermaidBlocks, validateMermaid } from './check-mermaid.mjs';
import { collectMarkdownFiles } from './validation-files.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

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

async function temporaryConfigurationRepository(t) {
  const root = await temporaryRepository(t);
  for (const path of [
    'package.json',
    'scripts/check-links.mjs',
    'scripts/check-mermaid.mjs',
    '.github/workflows/docs.yml',
    '.github/workflows/delete-merged-branch.yml',
    '.github/workflows/release.yml',
  ]) {
    await writeFixture(
      root,
      path,
      await readFile(join(repositoryRoot, path), 'utf8'),
    );
  }
  return root;
}

for (const [path, invalid] of [
  ['config/source.json', '{"incomplete":'],
  ['config/source.yaml', 'source: [unterminated'],
]) {
  test(`Configuration discovery ignores private failed captures but rejects malformed ${path}`, async (t) => {
    const root = await temporaryConfigurationRepository(t);
    const capture = 'cat: files/s047-row-1.json: No such file or directory\n';
    const capturePath = await writeFixture(
      root,
      '.codex-tmp/s047/failed-attempt/_temp/s047-row-1.json',
      capture,
    );

    assert.equal(await checkConfiguration(root), 4);
    assert.equal(await readFile(capturePath, 'utf8'), capture);

    await writeFixture(root, path, invalid);
    await assert.rejects(checkConfiguration(root), (error) => {
      assert.ok(
        error.message.startsWith(
          `Invalid configuration in ${relative(root, join(root, path))}:`,
        ),
      );
      return true;
    });
    assert.equal(await readFile(capturePath, 'utf8'), capture);
  });
}

test('Configuration discovery excludes only the root private session directory', async (t) => {
  const root = await temporaryConfigurationRepository(t);
  const path = 'config/.codex-tmp/source.json';
  await writeFixture(root, path, '{"incomplete":');
  await assert.rejects(checkConfiguration(root), (error) => {
    assert.ok(
      error.message.startsWith(
        `Invalid configuration in ${relative(root, join(root, path))}:`,
      ),
    );
    return true;
  });
});

test('Markdown discovery is deterministic and preserves exclusion policy', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(root, 'z.md', '# Z\n');
  await writeFixture(root, 'excluded.md', '# Exact file exclusion\n');
  await writeFixture(root, 'docs with space/éclair.md', '# Unicode\n');
  await writeFixture(root, 'docs with space/alpha.md', '# Alpha\n');
  await writeFixture(root, '.agents/ignored.md', '# Ignored\n');
  await writeFixture(root, 'node_modules/ignored.md', '# Ignored\n');

  const files = await collectMarkdownFiles(root, {
    excludedDirectories: new Set(['.agents', 'node_modules']),
    excludedPaths: new Set(['excluded.md']),
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
    loadLaunchOptions: async () => {
      throw new Error('injected launchers must not load production options');
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

test('Documentation discovery excludes private session inputs while rejecting broken source links', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(root, 'README.md', '# Source documentation\n');
  await writeFixture(
    root,
    '.codex-tmp/s047/private.md',
    '[Private](https://private.invalid/input)\n\n```mermaid\nnot-a-diagram\n```\n',
  );
  const observed = [];
  const checkLinks = async (markdown) => {
    observed.push(markdown);
    return markdown.includes('invalid')
      ? [
          {
            link: 'https://source.invalid/broken',
            status: 'dead',
            statusCode: 404,
          },
        ]
      : [];
  };
  assert.deepEqual(
    await validateLinks({
      repositoryRoot: root,
      configuration: {},
      checkLinks,
    }),
    { fileCount: 1, linkCount: 0 },
  );
  assert.equal(observed.length, 1);
  assert.ok(observed.every((markdown) => !markdown.includes('Private')));
  assert.deepEqual(
    await validateMermaid({
      repositoryRoot: root,
      launchBrowser: async () => {
        throw new Error('private_diagram_must_not_launch_browser');
      },
    }),
    { diagramCount: 0, fileCount: 1 },
  );
  await writeFixture(
    root,
    'docs/broken.md',
    '[Source](https://source.invalid/broken)\n',
  );
  await assert.rejects(
    validateLinks({ repositoryRoot: root, configuration: {}, checkLinks }),
    /docs\/broken\.md: dead link/,
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

test('Focused validation enforces the production process topology', async () => {
  const packageJson = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
  );
  const sources = {
    links: await readFile(
      join(repositoryRoot, 'scripts', 'check-links.mjs'),
      'utf8',
    ),
    mermaid: await readFile(
      join(repositoryRoot, 'scripts', 'check-mermaid.mjs'),
      'utf8',
    ),
  };
  assert.doesNotThrow(() =>
    assertValidatorTopology({
      packageScripts: packageJson.scripts,
      sources,
    }),
  );
});

test('Hosted Mermaid validation selects the installed headless shell', async () => {
  const configuration = JSON.parse(
    await readFile(
      join(repositoryRoot, '.github', 'puppeteer-ci.json'),
      'utf8',
    ),
  );
  assert.equal(configuration.headless, 'shell');
  assert.ok(configuration.args.includes('--no-sandbox'));
});

test('Android delivery instrumentation gets a bounded clean-state retry without erasing restoration evidence', async () => {
  const runner = await readFile(
    join(repositoryRoot, 'scripts', 'run-android-instrumentation.sh'),
    'utf8',
  );
  const workflow = await readFile(
    join(repositoryRoot, '.github', 'workflows', 'ci.yml'),
    'utf8',
  );

  const topology = (await import('yaml')).parse(workflow);
  const runtime = topology.jobs['android-instrumentation'];
  const sourceExpression =
    '${{ github.event.pull_request.head.sha || github.sha }}';
  const manual = topology.on.workflow_dispatch?.inputs?.android_runtime;
  assert.equal(manual?.type, 'choice');
  assert.equal(
    manual?.default,
    'full',
    'manual dispatch must retain full native qualification by default',
  );
  assert.deepEqual(manual?.options, ['full', 'source_only', 'back_diagnostic']);
  assert.equal(
    runtime.if,
    "github.event_name != 'workflow_dispatch' || inputs.android_runtime != 'source_only'",
  );
  assert.equal(
    runtime.steps.find((step) => step.name === 'Checkout').with.ref,
    sourceExpression,
  );
  assert.equal(runtime.env.GLITCHPAD_BUILD_COMMIT, sourceExpression);
  assert.equal(runtime.env.VITE_GLITCHPAD_BUILD_COMMIT, sourceExpression);
  assert.ok(
    runtime.strategy.matrix.includes(
      "github.event_name == 'workflow_dispatch' && inputs.android_runtime == 'back_diagnostic'",
    ),
  );
  const matrices = [...runtime.strategy.matrix.matchAll(/'(\{[^']+\})'/gu)].map(
    (match) => JSON.parse(match[1]),
  );
  assert.deepEqual(matrices, [
    { 'api-level': [36], role: ['ordinary'] },
    { 'api-level': [24, 36], role: ['ordinary', 'fault_probe'] },
  ]);
  assert.equal(
    topology.jobs['ci-ok'].name,
    "${{ github.event_name == 'workflow_dispatch' && inputs.android_runtime != 'full' && format('{0}-ci', inputs.android_runtime) || 'ci-ok' }}",
  );
  assert.ok(
    runtime.steps
      .find((step) =>
        step.uses?.startsWith('ReactiveCircus/android-emulator-runner@'),
      )
      .with.script.includes('"$GLITCHPAD_BUILD_COMMIT"'),
  );

  assert.match(runner, /for attempt in 1 2; do/u);
  assert.match(
    runner,
    /ANDROID_INSTRUMENTATION_RESET_APP_DATA:-false.*prepare_attempt_app_data.*\|\| exit 1/su,
  );
  const setup = await readFile(
    join(repositoryRoot, 'scripts', 'prepare-android-instrumentation.mjs'),
    'utf8',
  );
  assert.match(runner, /node[^\n]+prepare-android-instrumentation\.mjs/u);
  assert.match(setup, /com\.shruggietech\.glitchpad'/u);
  assert.match(setup, /com\.shruggietech\.glitchpad\.test'/u);
  assert.match(setup, /timeout: timeoutMs/u);
  assert.match(setup, /killSignal: 'SIGKILL'/u);
  assert.match(setup, /windowsHide: true/u);
  assert.match(setup, /'pm', 'clear', packageName/u);
  assert.doesNotMatch(runner, /pm clear[^\n]+\|\| true/u);
  assert.match(workflow, /bash scripts\/run-android-s047-journeys\.sh/u);
  const campaign = await readFile(
    join(repositoryRoot, 'scripts', 'run-android-s047-journeys.sh'),
    'utf8',
  );
  const native = await readFile(
    join(
      repositoryRoot,
      'crates',
      'glitchpad-host',
      'gen',
      'android',
      'app',
      'src',
      'androidTest',
      'java',
      'com',
      'shruggietech',
      'glitchpad',
      'source',
      'AndroidDeliveryInstrumentedTest.kt',
    ),
    'utf8',
  );
  assert.match(
    campaign,
    /run_task authoring standaloneAuthoringAndDiagnosticJourneys/u,
  );
  assert.match(
    campaign,
    /if ANDROID_INSTRUMENTATION_RESET_APP_DATA=true[^\n]+draftRecoveryAcrossProcessBoundary[^\n]+seed; then[\s\S]+ANDROID_INSTRUMENTATION_RESET_APP_DATA=false[^\n]+draftRecoveryAcrossProcessBoundary[^\n]+verify/u,
  );
  assert.match(
    native,
    /fun s047MarkdownJourney\(\)[\s\S]+governedMarkdownDeliveryRoutes\(\)/u,
  );
  assert.match(
    native,
    /fun s047ImageJourney\(\)[\s\S]+resolvedIntentDisplaysColdAndWarmProviderDocuments\(\)/u,
  );
  assert.match(
    native,
    /fun s047FaultJourney\(\)[\s\S]+verifyRootFailureRetainsDraft\(scenario\)[\s\S]+verifyMarkdownFailures\(scenario, corpus\)/u,
  );
  assert.match(
    native,
    /val deadline = deadlineOverride \?: \(SystemClock\.elapsedRealtime\(\) \+ 30_000L\)/u,
  );
  assert.match(
    runner,
    /adb_exit_status == 0 && marker_present == 1 && junit_success == 1 && instrumentation_failure == 0/u,
  );
  assert.match(
    runner,
    /INSTRUMENTATION_\(FAILED\|ABORTED\)[\s\S]+INSTRUMENTATION_CODE:/u,
  );
  assert.match(
    runner,
    /attempt_output="\$\{output%\.txt\}-attempt-\$\{attempt\}\.txt"/u,
  );
  assert.doesNotMatch(
    workflow,
    /ANDROID_INSTRUMENTATION_RESET_APP_DATA=true[^\n]+RestorationInstrumentedTest/u,
  );
});

test('Android connected tests preserve crash evidence and retry from clean app state', async () => {
  const runner = await readFile(
    join(repositoryRoot, 'scripts', 'run-android-connected-tests.sh'),
    'utf8',
  );

  assert.match(runner, /for attempt in 1 2; do/u);
  assert.match(
    runner,
    /adb logcat -d -t 4000 > "\$logcat_output" 2>&1 \|\| true/u,
  );
  assert.match(
    runner,
    /pm clear com\.shruggietech\.glitchpad[\s\S]+pm clear com\.shruggietech\.glitchpad\.test/u,
  );
  assert.match(runner, /adb wait-for-device[\s\S]+sleep 3/u);
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

test('link validation keeps local provenance while excluding exact upstream vendor documentation', async (t) => {
  const root = await temporaryRepository(t);
  await writeFixture(root, 'vendor/README.md', '# Local patch provenance\n');
  await writeFixture(
    root,
    'vendor/tauri-plugin-opener-2.5.5/README.md',
    '# Upstream opener\n',
  );
  await writeFixture(
    root,
    'vendor/tauri-plugin-single-instance-2.4.5/CHANGELOG.md',
    '# Upstream changelog\n',
  );
  await writeFixture(root, 'vendor/tao-0.35.3/README.md', '# Upstream Tao\n');
  await writeFixture(root, 'vendor/tao-0.35.4/README.md', '# Other version\n');
  await writeFixture(
    root,
    'docs/tao-0.35.3/README.md',
    '# Owned same basename\n',
  );
  await writeFixture(
    root,
    'vendor/tauri-2.11.6/README.md',
    '# Retired unowned tree\n',
  );
  for (const name of ['CHANGELOG.md', 'MOBILE.md', 'README.md', 'SECURITY.md'])
    await writeFixture(root, 'vendor/wry-0.55.1/' + name, '# Upstream Wry ' + name + '\n');
  await writeFixture(root, 'vendor/wry-0.55.1/GLITCHPAD-PATCH.md', '# Local Wry patch provenance\n');
  await writeFixture(root, 'vendor/wry-0.55.2/README.md', '# Other Wry version\n');
  await writeFixture(root, 'docs/wry-0.55.1/README.md', '# Owned Wry basename\n');
  const seen = [];
  const result = await validateLinks({
    repositoryRoot: root,
    configuration: {},
    checkLinks: async (markdown) => {
      seen.push(markdown);
      return [];
    },
  });
  assert.equal(result.fileCount, 7);
  assert.deepEqual(
    seen.sort(),
    [
      '# Local patch provenance\n',
      '# Local Wry patch provenance\n',
      '# Other Wry version\n',
      '# Owned Wry basename\n',
      '# Other version\n',
      '# Owned same basename\n',
      '# Retired unowned tree\n',
    ].sort(),
  );
});
