import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import puppeteer from 'puppeteer';

import catalog from '../fixtures/performance/budgets.json' with { type: 'json' };
import { classifyValue, summarizeSamples, validateCatalog, validateEvidence } from './lib/performance-policy.mjs';

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const distribution = join(repositoryRoot, 'apps', 'glitchpad', 'dist');

export const parseArguments = (arguments_) => {
  const result = { profile: '', buildId: '', output: null, metric: null, artifact: null, skipBuild: false, confirmHardFailure: false };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--skip-build') result.skipBuild = true;
    else if (argument === '--confirm-hard-failure') result.confirmHardFailure = true;
    else if (['--profile', '--build-id', '--output', '--metric', '--artifact'].includes(argument)) {
      const value = arguments_[++index];
      if (!value || value.startsWith('--')) throw new Error(`argument_value_missing:${argument.slice(2)}`);
      const key = { '--profile': 'profile', '--build-id': 'buildId', '--output': 'output', '--metric': 'metric', '--artifact': 'artifact' }[argument];
      result[key] = value;
    } else throw new Error(`argument_unknown:${argument}`);
  }
  if (!result.profile) throw new Error('profile_required');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,127}$/u.test(result.buildId)) throw new Error('build_id_invalid');
  if (result.artifact !== null && result.metric === null) throw new Error('artifact_metric_pair_required');
  return result;
};

export const collectWithHardFailureConfirmation = async (options, collector = collectPerformance) => {
  try {
    return await collector(options);
  } catch (error) {
    if (!options.confirmHardFailure || !(error instanceof Error) || !error.message.startsWith('performance_hard_limit:')) throw error;
    process.stderr.write(`${error.message}: confirming on a second independent collection\n`);
    return collector(options);
  }
};

export const isAllowedRequest = (target, origin) => {
  const url = new URL(target, origin);
  return url.origin === origin || url.protocol === 'blob:' || url.protocol === 'data:';
};

const run = (program, arguments_, environment = process.env) => new Promise((resolvePromise, reject) => {
  const windowsPnpm = process.platform === 'win32' && program === 'pnpm';
  const executable = windowsPnpm ? (process.env.ComSpec ?? 'cmd.exe') : program;
  const childArguments = windowsPnpm ? ['/d', '/s', '/c', 'pnpm --filter @shruggietech/glitchpad build'] : arguments_;
  const child = spawn(executable, childArguments, {
    cwd: repositoryRoot,
    env: environment,
    shell: false,
    stdio: 'inherit',
    windowsHide: true,
  });
  child.once('error', reject);
  child.once('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`${program}_failed:${code}`)));
});

const contentType = (path) => ({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
}[extname(path)] ?? 'application/octet-stream');

const startServer = async () => {
  const server = createServer(async (request, response) => {
    const requested = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    const relative = normalize(requested === '/' ? 'index.html' : requested.slice(1));
    if (relative.startsWith('..')) return void response.writeHead(403).end();
    let path = join(distribution, relative);
    try {
      if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      response.writeHead(200, { 'content-type': contentType(path), 'cache-control': 'no-store' });
      response.end(await readFile(path));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('runtime_server_address_failed');
  return { server, origin: `http://127.0.0.1:${address.port}` };
};

const closeServer = (server) => new Promise((resolvePromise) => server.close(resolvePromise));

const measureNavigation = async (browser, origin, selector, prepare = null, samples = 5) => {
  const values = [];
  for (let index = 0; index < samples; index += 1) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    const external = [];
    page.on('request', (request) => { if (!isAllowedRequest(request.url(), origin)) external.push(request.url()); });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: false, value: { invoke: () => Promise.reject(new Error('native_unavailable')) } });
    });
    try {
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      if (prepare) await prepare(page);
      const readyAt = await page.waitForFunction(
        (readySelector) => document.querySelector(readySelector) ? performance.now() : false,
        { timeout: 10_000 },
        selector,
      );
      values.push(await readyAt.jsonValue());
      await readyAt.dispose();
    } catch (error) {
      await context.close();
      throw new Error('performance_selector_failed', { cause: error });
    }
    await context.close();
    if (external.length) throw new Error('performance_external_request');
  }
  return values;
};

const measureInteraction = async (browser, origin, setup, interact, ready, samples) => {
  const values = [];
  for (let index = 0; index < samples; index += 1) {
    const page = await browser.newPage();
    const external = [];
    page.on('request', (request) => { if (!isAllowedRequest(request.url(), origin)) external.push(request.url()); });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: false, value: { invoke: () => Promise.reject(new Error('native_unavailable')) } });
    });
    try {
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await setup(page);
      await page.evaluate(() => {
        delete window.__glitchpadPerformanceInputStarted;
        document.addEventListener('beforeinput', () => {
          window.__glitchpadPerformanceInputStarted = performance.now();
        }, { capture: true, once: true });
      });
      await interact(page);
      await ready(page);
      const elapsed = await page.evaluate(() => new Promise((resolvePromise) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const started = window.__glitchpadPerformanceInputStarted;
          resolvePromise(typeof started === 'number' ? performance.now() - started : null);
        }));
      }));
      if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error('performance_input_timing_failed');
      values.push(elapsed);
      if (external.length) throw new Error('performance_external_request');
    } finally {
      await page.close();
    }
  }
  return values;
};

const interactionDefinitions = {
  editor_input_paint: {
    setup: (page) => page.waitForSelector('.cm-content[contenteditable="true"]'),
    interact: async (page) => {
      await page.click('.cm-content[contenteditable="true"]');
      await page.keyboard.type('y');
    },
    ready: (page) => page.waitForFunction(() => document.querySelector('[data-performance-renderer="text"]')?.getAttribute('data-performance-revision') === '2'),
  },
  mermaid_current_preview: {
    setup: async (page) => {
      await page.$eval('[role="tab"][aria-label="performance-edit.mmd"]', (tab) => tab.click());
      await page.waitForSelector('.mermaid-surface[data-performance-ready="true"][data-performance-revision="1"]');
      await page.$eval('.mermaid-controls button', (button) => button.click());
      await page.waitForSelector('.mermaid-source-editor .cm-content[contenteditable="true"]');
    },
    interact: async (page) => {
      await page.click('.mermaid-source-editor .cm-content[contenteditable="true"]');
      await page.keyboard.press('End');
      await page.keyboard.type('\n%% edit');
    },
    ready: (page) => page.waitForFunction(() => {
      const surfaceRevision = Number(document.querySelector('.mermaid-surface[data-performance-ready="true"]')?.getAttribute('data-performance-revision'));
      const documentRevision = Number(document.querySelector('[data-performance-renderer="mermaid"]')?.getAttribute('data-performance-revision'));
      return documentRevision > 1 && surfaceRevision === documentRevision;
    }),
  },
};

const makeEvidence = (metric, profile, samples, runtimeVersion, buildId, method = 'chromium-navigation-ready-v2') => {
  const scenario = catalog.scenarios.find(({ id }) => id === metric.scenario_id);
  const summary = summarizeSamples(samples, metric.minimum_samples, metric.maximum_samples);
  const observation = metric.aggregation === 'p95' ? summary.p95 : summary.maximum;
  const invariants = Object.fromEntries(metric.failure_invariants.map((name) => [
    name,
    name === 'repeated_hard_stall' ? samples.filter((sample) => sample > metric.hard_limit).length > 1 : false,
  ]));
  return {
    schema_version: 1,
    catalog_version: catalog.catalog_version,
    metric_id: metric.id,
    scenario_id: scenario.id,
    ...(scenario.sha256 ? { scenario_digest: scenario.sha256 } : {}),
    profile_id: profile.id,
    evidence_class: profile.evidence_class,
    build_profile: 'production_web',
    build_id: buildId,
    runtime_version: runtimeVersion.replaceAll(/[^A-Za-z0-9._:+-]/gu, '-').slice(0, 128),
    cold_state: scenario.state === 'cold',
    method,
    samples,
    ...summary,
    invariants,
    classification: classifyValue(metric, observation, { invariants }),
    cleanup_complete: true,
    measured_at: new Date().toISOString(),
  };
};

const collectArtifact = async (options, profile) => {
  const metric = catalog.metrics.find(({ id }) => id === options.metric);
  if (!metric || !['desktop_installer_size', 'universal_android_apk_size'].includes(metric.id)) throw new Error('artifact_metric_invalid');
  const artifact = resolve(options.artifact);
  const information = await stat(artifact).catch((error) => { throw new Error('artifact_unavailable', { cause: error }); });
  if (!information.isFile()) throw new Error('artifact_not_file');
  const scenario = catalog.scenarios.find(({ id }) => id === metric.scenario_id);
  const samples = [information.size];
  const summary = summarizeSamples(samples, 1, 1);
  const evidence = {
    schema_version: 1, catalog_version: catalog.catalog_version, metric_id: metric.id,
    scenario_id: scenario.id, profile_id: profile.id, evidence_class: profile.evidence_class,
    build_profile: 'release', build_id: options.buildId, runtime_version: 'artifact-v1', cold_state: false,
    method: 'artifact-stat-v1', samples, ...summary, invariants: {},
    classification: classifyValue(metric, information.size), cleanup_complete: true, measured_at: new Date().toISOString(),
  };
  const { problems } = validateEvidence(catalog, evidence);
  if (problems.length) throw new Error(problems.join(','));
  if (evidence.classification === 'failure') throw new Error(`performance_hard_limit:${evidence.metric_id}`);
  return [evidence];
};

export const collectPerformance = async (options) => {
  const catalogProblems = validateCatalog(catalog);
  if (catalogProblems.length) throw new Error(catalogProblems.join(','));
  const profile = catalog.profiles.find(({ id }) => id === options.profile);
  if (!profile) throw new Error('profile_unknown');
  if (options.artifact) return collectArtifact(options, profile);
  if (profile.evidence_class !== 'hosted_smoke') throw new Error('reference_collector_requires_platform_harness');
  if (!options.skipBuild) await run('pnpm', ['--filter', '@shruggietech/glitchpad', 'build'], { ...process.env, VITE_GLITCHPAD_PERFORMANCE: '1' });
  await stat(join(distribution, 'index.html'));
  const { server, origin } = await startServer();
  let browser;
  try {
    browser = await puppeteer.launch({ executablePath: await puppeteer.executablePath({ headless: 'shell' }), headless: 'shell', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const runtime = await browser.version();
    const definitions = [
      ['cold_shell_desktop', '.app-shell[data-performance-ready="true"]', null],
      ['text_first_content', '[data-performance-renderer="text"] .text-editor[data-performance-ready="true"]', null],
      ['markdown_first_content', '.markdown-document[data-performance-ready="true"]', (page) => page.$eval('[role="tab"][aria-label*="performance.md"]', (tab) => tab.click())],
      ['mermaid_first_content_desktop', '.mermaid-surface[data-performance-ready="true"]', (page) => page.$eval('[role="tab"][aria-label*="performance.mmd"]', (tab) => tab.click())],
    ];
    const evidence = [];
    const selected = options.metric ? definitions.filter(([metricId]) => metricId === options.metric) : definitions;
    const selectedInteractions = Object.entries(interactionDefinitions)
      .filter(([metricId]) => !options.metric || metricId === options.metric)
      .sort(([left], [right]) => Number(right === 'mermaid_current_preview') - Number(left === 'mermaid_current_preview'));
    if (options.metric && selected.length === 0 && selectedInteractions.length === 0) throw new Error('browser_metric_invalid');
    const coldDefinitions = selected.filter(([metricId]) => metricId === 'cold_shell_desktop');
    const contentDefinitions = selected.filter(([metricId]) => metricId !== 'cold_shell_desktop');
    for (const [metricId, selector, prepare] of coldDefinitions) {
      const metric = catalog.metrics.find(({ id }) => id === metricId);
      const samples = await measureNavigation(browser, origin, selector, prepare, metric.minimum_samples);
      const record = makeEvidence(metric, profile, samples, runtime, options.buildId);
      const { problems } = validateEvidence(catalog, record);
      if (problems.length) throw new Error(problems.join(','));
      if (record.classification === 'failure') throw new Error(`performance_hard_limit:${record.metric_id}`);
      evidence.push(record);
    }
    for (const [metricId, definition] of selectedInteractions) {
      const metric = catalog.metrics.find(({ id }) => id === metricId);
      const samples = await measureInteraction(browser, origin, definition.setup, definition.interact, definition.ready, metric.minimum_samples);
      const record = makeEvidence(metric, profile, samples, runtime, options.buildId, 'chromium-beforeinput-paint-v2');
      const { problems } = validateEvidence(catalog, record);
      if (problems.length) throw new Error(problems.join(','));
      if (record.classification === 'failure') throw new Error(`performance_hard_limit:${record.metric_id}`);
      evidence.push(record);
    }
    for (const [metricId, selector, prepare] of contentDefinitions) {
      const metric = catalog.metrics.find(({ id }) => id === metricId);
      const samples = await measureNavigation(browser, origin, selector, prepare, metric.minimum_samples);
      const record = makeEvidence(metric, profile, samples, runtime, options.buildId);
      const { problems } = validateEvidence(catalog, record);
      if (problems.length) throw new Error(problems.join(','));
      if (record.classification === 'failure') throw new Error(`performance_hard_limit:${record.metric_id}`);
      evidence.push(record);
    }
    return evidence;
  } finally {
    await browser?.close();
    await closeServer(server);
  }
};

export const main = async (arguments_) => {
  const options = parseArguments(arguments_);
  const evidence = await collectWithHardFailureConfirmation(options);
  if (options.output) {
    const output = resolve(options.output);
    await mkdir(output, { recursive: true });
    await writeFile(join(output, 'performance-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
      .catch((error) => { throw new Error('performance_output_unavailable', { cause: error }); });
  }
  for (const record of evidence) process.stdout.write(`${record.metric_id}: ${record.classification} (p95=${record.p95}, max=${record.maximum})\n`);
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).catch((error) => {
    const message = error instanceof Error && /^[a-z0-9_:-]{1,160}$/u.test(error.message)
      ? error.message
      : 'performance_collection_failed';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
