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
  const parsedDocsWorkflow = parseYaml(docsWorkflow);
  for (const [label, pattern] of [
    ['pull-request build trigger', /^\s*pull_request:\s*$/m],
    ['main build trigger', /^\s*push:\s*\n\s*branches:\s*\[main\]/m],
    ['reusable release entry point', /^\s*workflow_call:\s*\n\s*inputs:/m],
    ['read-only default permission', /^permissions:\s*\n\s*contents:\s*read/m],
    ['Pages artifact path', /^\s*path:\s*site\/out\s*$/m],
    ['protected Pages environment', /^\s*name:\s*github-pages\s*$/m],
    [
      'exact publisher deployment condition',
      /inputs\.deploy[\s\S]*inputs\.release_tag == 'v0\.1\.3'/,
    ],
    [
      'shared Pages deployment group',
      /^\s*group:\s*github-pages-production\s*$/m,
    ],
    ['ordered Pages deployment queue', /^\s*queue:\s*max\s*$/m],
  ]) {
    if (!pattern.test(docsWorkflow)) {
      throw new Error(`Invalid docs workflow contract: missing ${label}`);
    }
  }
  const expectedDeploymentCondition =
    "inputs.deploy && inputs.release_tag == 'v0.1.3'";
  const normalizeExpression = (value) =>
    typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  const uploadStep = parsedDocsWorkflow.jobs?.build?.steps?.find(
    (step) => step.name === 'Upload Pages artifact',
  );
  if (
    normalizeExpression(uploadStep?.if) !== expectedDeploymentCondition ||
    normalizeExpression(parsedDocsWorkflow.jobs?.deploy?.if) !==
      expectedDeploymentCondition
  )
    throw new Error(
      'Invalid docs workflow contract: deployment authority must be exactly the authorized release input',
    );
  if (
    JSON.stringify(parsedDocsWorkflow.jobs?.deploy?.concurrency) !==
    JSON.stringify({ group: 'github-pages-production', queue: 'max' })
  )
    throw new Error(
      'Invalid docs workflow contract: production deployments must use the shared ordered queue',
    );
  if (
    JSON.stringify(parsedDocsWorkflow.jobs?.deploy?.permissions) !==
    JSON.stringify({ contents: 'read', pages: 'write', 'id-token': 'write' })
  )
    throw new Error(
      'Invalid docs workflow contract: deployment permissions must be only Pages and OIDC write',
    );
  const freshnessStep = parsedDocsWorkflow.jobs?.deploy?.steps?.find(
    (step) => step.name === 'Confirm deployment revision is current',
  );
  for (const [label, pattern] of [
    ['default-branch freshness lookup', /github\.rest\.repos\.getBranch/],
    [
      'exact deployment revision comparison',
      /current\.data\.commit\.sha === process\.env\.CANDIDATE_SHA/,
    ],
    ['deployment authorization output', /core\.setOutput\('deploy'/],
  ])
    if (!pattern.test(freshnessStep?.with?.script ?? ''))
      throw new Error(`Invalid docs workflow contract: missing ${label}`);
  for (const step of parsedDocsWorkflow.jobs?.deploy?.steps?.slice(1) ?? [])
    if (step.if !== "steps.freshness.outputs.deploy == 'true'")
      throw new Error(
        'Invalid docs workflow contract: every deployment and verification step must honor freshness',
      );

  const cleanupWorkflowPath = join(
    repositoryRoot,
    '.github',
    'workflows',
    'delete-merged-branch.yml',
  );
  const cleanupWorkflowSource = await readFile(cleanupWorkflowPath, 'utf8');
  const cleanupWorkflow = parseYaml(cleanupWorkflowSource);
  if (
    JSON.stringify(cleanupWorkflow.on) !==
    JSON.stringify({ pull_request_target: { types: ['closed'] } })
  )
    throw new Error(
      'Invalid cleanup workflow contract: trigger must be only pull_request_target closed',
    );
  if (
    JSON.stringify(cleanupWorkflow.permissions) !==
    JSON.stringify({ contents: 'write' })
  )
    throw new Error(
      'Invalid cleanup workflow contract: permissions must be only contents write',
    );
  const cleanupJob = cleanupWorkflow.jobs?.delete;
  if (!cleanupJob || Object.keys(cleanupWorkflow.jobs).length !== 1)
    throw new Error(
      'Invalid cleanup workflow contract: expected one delete job',
    );
  if (
    cleanupJob.steps?.length !== 1 ||
    cleanupJob.steps[0].shell !== 'bash' ||
    typeof cleanupJob.steps[0].run !== 'string' ||
    cleanupJob.steps[0].uses
  )
    throw new Error(
      'Invalid cleanup workflow contract: expected one trusted inline Bash step',
    );
  for (const [label, pattern] of [
    ['closed pull request merged gate', /pull_request\.merged == true/],
    ['same-repository job gate', /head\.repo\.full_name == github\.repository/],
    [
      'default-branch job gate',
      /head\.ref != github\.event\.repository\.default_branch/,
    ],
    [
      'case-sensitive repository guard',
      /"\$HEAD_REPOSITORY" != "\$BASE_REPOSITORY"/,
    ],
    ['default-branch script guard', /"\$HEAD_REF" == "\$DEFAULT_BRANCH"/],
    ['bare temporary repository', /git init --bare --quiet "\$git_directory"/],
    ['isolated Git directory', /git -C "\$git_directory"/],
    ['current reference lookup', /run_git ls-remote --exit-code --refs/],
    ['revision observation guard', /"\$current_sha" != "\$HEAD_SHA"/],
    [
      'atomic revision lease',
      /--force-with-lease="refs\/heads\/\$\{HEAD_REF\}:\$\{HEAD_SHA\}"/,
    ],
    ['exact reference deletion', /":refs\/heads\/\$\{HEAD_REF\}"/],
    ['idempotent absent-ref handling', /\$lookup_status -eq 2/],
    ['lookup error propagation', /exit "\$lookup_status"/],
    ['push error propagation', /exit "\$push_status"/],
  ])
    if (!pattern.test(cleanupWorkflowSource))
      throw new Error(`Invalid cleanup workflow contract: missing ${label}`);
  if (/actions\/checkout@|actions\/github-script@/m.test(cleanupWorkflowSource))
    throw new Error(
      'Invalid cleanup workflow contract: checkout and non-atomic API deletion are prohibited',
    );

  const releaseWorkflow = await readFile(
    join(repositoryRoot, '.github', 'workflows', 'release.yml'),
    'utf8',
  );
  for (const [label, pattern] of [
    ['post-publication site job', /^\s*publish-site:\s*$/m],
    ['publication dependency', /^\s*needs:\s*publish\s*$/m],
    [
      'reusable docs workflow call',
      /^\s*uses:\s*\.\/\.github\/workflows\/docs\.yml\s*$/m,
    ],
    ['deployment authorization', /^\s*deploy:\s*true\s*$/m],
    ['exact release tag input', /^\s*release_tag:\s*v0\.1\.3\s*$/m],
  ]) {
    if (!pattern.test(releaseWorkflow)) {
      throw new Error(`Invalid release workflow contract: missing ${label}`);
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
