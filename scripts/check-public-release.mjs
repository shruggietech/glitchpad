import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const currentVersion = '0.1.1';
export const currentTag = `v${currentVersion}`;
export const releaseUrl =
  'https://github.com/ShruggieTech/glitchpad/releases/tag/v0.1.1';

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
    navigation,
    footer,
    docsIndex,
    specification,
    prebuild,
    workflow,
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
    '| Updated | 2026-09-09 |',
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
  if (revisionDates.at(-1) !== '2026-09-09')
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
  if (!/github\.event_name == 'push'/.test(workflow))
    problems.push(
      'docs workflow does not authorize deployment after a main push',
    );
  if (!/github\.event_name != 'pull_request'/.test(workflow))
    problems.push(
      'docs workflow does not explicitly exclude pull-request deployment',
    );
  requireText(
    problems,
    '.github/workflows/docs.yml',
    workflow,
    'Verify production deployment',
  );

  return problems;
}

export async function loadPublicSources(root = repositoryRoot) {
  const paths = {
    readme: 'README.md',
    home: 'site/app/(home)/page.tsx',
    navigation: 'site/lib/layout.shared.tsx',
    footer: 'site/components/footer.tsx',
    docsIndex: 'site/content/docs/index.mdx',
    specification: 'docs/glitchpad-technical-specification.md',
    prebuild: 'site/scripts/prebuild.mjs',
    workflow: '.github/workflows/docs.yml',
  };
  return Object.fromEntries(
    await Promise.all(
      Object.entries(paths).map(async ([key, path]) => [
        key,
        await readFile(join(root, ...path.split('/')), 'utf8'),
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
