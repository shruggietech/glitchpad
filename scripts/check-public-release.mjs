import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const currentVersion = '0.1.3';
export const currentTag = `v${currentVersion}`;
export const releaseUrl =
  'https://github.com/ShruggieTech/glitchpad/releases/tag/v0.1.3';
const uploadCondition =
  "inputs.deploy && inputs.release_tag == 'v0.1.3' && steps.release_authority.outputs.authorized == 'true'";
const deploymentCondition =
  "inputs.deploy && inputs.release_tag == 'v0.1.3' && needs.build.outputs.release_authorized == 'true'";

function normalizeExpression(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function requireText(problems, source, text, expected) {
  if (!text.includes(expected))
    problems.push(`${source} is missing ${expected}`);
}

function rejectText(problems, source, text, pattern, label) {
  if (pattern.test(text)) problems.push(`${source} contains stale ${label}`);
}

export function verifyPublicSources(sources) {
  const problems = [];
  const {
    readme,
    home,
    styles,
    navigation,
    footer,
    docsIndex,
    specification,
    prebuild,
    workflow,
    releaseWorkflow,
    cleanupWorkflow,
  } = sources;

  for (const [source, text] of [
    ['README.md', readme],
    ['site/app/(home)/page.tsx', home],
    ['site/components/footer.tsx', footer],
    ['site/content/docs/index.mdx', docsIndex],
  ]) {
    rejectText(
      problems,
      source,
      text,
      /no installable release is available|early development/i,
      'release-availability claim',
    );
  }

  requireText(problems, 'README.md', readme, `Glitchpad v${currentVersion}`);
  requireText(problems, 'site/app/(home)/page.tsx', home, 'View your files.');
  requireText(
    problems,
    'site/app/(home)/page.tsx',
    home,
    'A fast, cross-platform viewer and editor for local files.',
  );
  requireText(
    problems,
    'site/app/(home)/page.tsx',
    home,
    'A ShruggieTech project.',
  );
  for (const action of ['Download', 'Docs']) {
    if (!new RegExp(`>\\s*${action}\\s*<`).test(home))
      problems.push(`site/app/(home)/page.tsx is missing ${action} action`);
  }
  requireText(problems, 'site/app/(home)/page.tsx', home, releaseUrl);
  if (
    !/\.hero-endorsement\s*\{[^}]*font-family:\s*var\(--font-mono\)[^}]*font-weight:\s*400[^}]*letter-spacing:\s*0\.08em[^}]*text-transform:\s*uppercase/s.test(
      styles,
    )
  )
    problems.push('homepage endorsement typography is not governed');

  if (/text:\s*['"](?:Support|Security)['"]/.test(navigation))
    problems.push('primary navigation contains Support or Security');
  requireText(
    problems,
    'site/lib/layout.shared.tsx',
    navigation,
    "text: 'Docs'",
  );
  requireText(
    problems,
    'site/lib/layout.shared.tsx',
    navigation,
    "text: 'Download'",
  );
  requireText(problems, 'site/components/footer.tsx', footer, '/security');

  for (const expected of [
    `| Specification version | ${currentVersion} |`,
    `| Product version | ${currentVersion} |`,
    '| Issued | 2026-08-30 |',
    '| Updated | 2026-09-11 |',
    '`Issued` records the date this specification was first published.',
    '`Updated` records the effective date of the current specification text',
  ])
    requireText(
      problems,
      'docs/glitchpad-technical-specification.md',
      specification,
      expected,
    );
  const revisionDates = [
    ...specification.matchAll(/^\| 0\.\d+\.\d+ \| (\d{4}-\d{2}-\d{2}) \|/gm),
  ].map((match) => match[1]);
  if (
    revisionDates.some(
      (date, index) => index > 0 && date < revisionDates[index - 1],
    )
  )
    problems.push(
      'technical specification revision history is not chronological',
    );
  if (revisionDates.at(-1) !== '2026-09-11')
    problems.push(
      'technical specification Updated date does not match latest revision',
    );

  requireText(
    problems,
    'site/scripts/prebuild.mjs',
    prebuild,
    'installableReleaseAvailable = true',
  );
  requireText(problems, 'site/scripts/prebuild.mjs', prebuild, 'releaseUrl');

  if (!/push:\s*\n\s*branches:\s*\[main\]/.test(workflow))
    problems.push('docs workflow is not triggered by main pushes');
  if (!/workflow_call:\s*\n\s*inputs:/.test(workflow))
    problems.push('docs workflow is not reusable by the release publisher');
  if (!/workflow_dispatch:\s*\n\s*inputs:/.test(workflow))
    problems.push('docs workflow lacks an authorized post-release retry entry point');
  for (const expected of [
    'inputs.deploy',
    "inputs.release_tag == 'v0.1.3'",
    'group: github-pages-production',
    'queue: max',
    'Confirm published release authority',
    'github.rest.repos.getReleaseByTag',
    'github.rest.git.getRef',
    'github.rest.git.getTag',
    "object.type !== 'commit' || object.sha !== process.env.CANDIDATE_SHA",
    "core.setOutput('authorized', 'true')",
    "ref: ${{ inputs.deploy && inputs.release_tag == 'v0.1.3' && inputs.release_tag || github.ref }}",
    'GLITCHPAD_EXPECTED_REVISION: ${{ needs.build.outputs.source_revision }}',
  ])
    requireText(problems, '.github/workflows/docs.yml', workflow, expected);
  try {
    const parsedWorkflow = parseYaml(workflow);
    const uploadStep = parsedWorkflow.jobs?.build?.steps?.find(
      (step) => step.name === 'Upload Pages artifact',
    );
    if (
      normalizeExpression(uploadStep?.if) !== uploadCondition ||
      normalizeExpression(parsedWorkflow.jobs?.deploy?.if) !==
        deploymentCondition
    )
      problems.push(
        'docs workflow does not use the exact trusted deployment authority',
      );
  } catch {
    problems.push('docs workflow cannot be parsed for deployment authority');
  }
  if (/\b(?:gh\s+release|git\s+tag)\b/.test(workflow))
    problems.push('docs workflow can mutate immutable release authority');
  for (const expected of [
    'needs: publish',
    'uses: ./.github/workflows/docs.yml',
    'deploy: true',
    'release_tag: v0.1.3',
  ])
    requireText(
      problems,
      '.github/workflows/release.yml',
      releaseWorkflow,
      expected,
    );
  requireText(
    problems,
    '.github/workflows/docs.yml',
    workflow,
    'Verify production deployment',
  );

  for (const expected of [
    'pull_request_target:',
    'types: [closed]',
    'contents: write',
    'github.event.pull_request.merged == true',
    'github.event.pull_request.head.repo.full_name == github.repository',
    'github.event.pull_request.head.ref != github.event.repository.default_branch',
    'HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}',
    'BASE_REPOSITORY: ${{ github.repository }}',
    'HEAD_REF: ${{ github.event.pull_request.head.ref }}',
    'HEAD_SHA: ${{ github.event.pull_request.head.sha }}',
    'DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}',
    'GITHUB_TOKEN: ${{ github.token }}',
    'shell: bash',
    'set -euo pipefail',
    '"$HEAD_REPOSITORY" != "$BASE_REPOSITORY"',
    '"$HEAD_REF" == "$DEFAULT_BRANCH"',
    'git init --bare --quiet "$git_directory"',
    'git -C "$git_directory"',
    'run_git ls-remote --exit-code --refs',
    '"$current_sha" != "$HEAD_SHA"',
    '--force-with-lease="refs/heads/${HEAD_REF}:${HEAD_SHA}"',
    '":refs/heads/${HEAD_REF}"',
    '$lookup_status -eq 2',
    'exit "$lookup_status"',
    'exit "$push_status"',
  ])
    requireText(
      problems,
      '.github/workflows/delete-merged-branch.yml',
      cleanupWorkflow,
      expected,
    );
  for (const [pattern, label] of [
    [/actions\/checkout@/u, 'pull request checkout'],
    [
      /run:\s*\|[\s\S]*\$\{\{\s*github\.event/u,
      'event interpolation in executable source',
    ],
    [
      /^\s{2}(?!contents:)\S+:\s*(?:read|write)\s*$/mu,
      'excess token permission',
    ],
  ])
    if (pattern.test(cleanupWorkflow))
      problems.push(
        `.github/workflows/delete-merged-branch.yml contains unsafe ${label}`,
      );

  return problems;
}

export async function loadPublicSources(root = repositoryRoot) {
  const paths = {
    readme: 'README.md',
    home: 'site/app/(home)/page.tsx',
    styles: 'site/app/global.css',
    navigation: 'site/lib/layout.shared.tsx',
    footer: 'site/components/footer.tsx',
    docsIndex: 'site/content/docs/index.mdx',
    specification: 'docs/glitchpad-technical-specification.md',
    prebuild: 'site/scripts/prebuild.mjs',
    workflow: '.github/workflows/docs.yml',
    releaseWorkflow: '.github/workflows/release.yml',
    cleanupWorkflow: '.github/workflows/delete-merged-branch.yml',
  };
  return Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([key, path]) => [
        key,
        await readFile(join(root, ...path.split('/')), 'utf8').catch(
          (error) => {
            if (error.code === 'ENOENT') return '';
            throw error;
          },
        ),
      ]),
    ),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const problems = verifyPublicSources(await loadPublicSources());
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(
      `Public ${currentTag} authority verified: copy, ownership, dates, actions, and deployment policy are consistent.`,
    );
  }
}
