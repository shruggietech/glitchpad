import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildDocumentation,
  extractSection,
  parseTechnicalSpecification,
  publishDocumentation,
} from '../scripts/prebuild.mjs';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(siteRoot, '..');

const fixture = `# Glitchpad Technical Specification v1.2.3

| Field | Value |
| --- | --- |
| Status | Normative test release |
| Specification version | 1.2.3 |
| Product version | 1.2.3 |
| Release class | Test release |
| Issued | 2026-01-01 |
| Updated | 2026-01-02 |
| Repository | \`github.com/ShruggieTech/glitchpad\` |
| License | Apache License 2.0 (\`Apache-2.0\`) |

## Table of Contents

1. [First Section](#1-first-section)
2. [Second Section](#2-second-section)

## 1. First Section

Read the [second section](#2-second-section).

Keep \`[inline](#2-second-section) {value}\` literal and escape {unsafe} MDX text.

### Nested Topic

\`\`\`markdown
## 99. Not a section
[example](#2-second-section)
\`\`\`

## 2. Second Section

Return to the [nested topic](#nested-topic).
`;

test('technical specification parser pairs numbered TOC entries and ignores fenced headings', () => {
  const parsed = parseTechnicalSpecification(fixture);
  assert.equal(parsed.title, 'Glitchpad Technical Specification v1.2.3');
  assert.equal(parsed.version, '1.2.3');
  assert.deepEqual(
    parsed.sections.map(({ number, slug, anchor }) => ({
      number,
      slug,
      anchor,
    })),
    [
      {
        number: 1,
        slug: '01-first-section',
        anchor: '1-first-section',
      },
      {
        number: 2,
        slug: '02-second-section',
        anchor: '2-second-section',
      },
    ],
  );
  assert.match(parsed.sections[0].body, /## 99\. Not a section/);
  assert.match(parsed.sections[0].body, /### Nested Topic/);
});

test('technical specification parser preserves literal trailing heading hashes', () => {
  const csharp = fixture
    .replaceAll('First Section', 'C#')
    .replaceAll('#1-first-section', '#1-c');
  const parsed = parseTechnicalSpecification(csharp);
  assert.equal(parsed.sections[0].title, 'C#');
  assert.equal(parsed.sections[0].slug, '01-c');
});

test('documentation rendering rewrites owned fragments and preserves fenced examples', () => {
  const documentation = buildDocumentation({
    technicalSpecification: fixture,
    workspace: { version: '1.2.3', license: 'Apache-2.0' },
    readme: 'Glitchpad v1.2.3 is the current corrective community release.\n',
  });
  const first = documentation.files.get('01-first-section.mdx');
  const second = documentation.files.get('02-second-section.mdx');
  assert.match(first, /\[second section\]\(\/docs\/02-second-section\)/);
  assert.match(first, /## Nested Topic/);
  assert.match(first, /\[example\]\(#2-second-section\)/);
  assert.match(first, /`\[inline\]\(#2-second-section\) \{value\}`/);
  assert.match(first, /escape &#123;unsafe&#125; MDX text/);
  assert.match(
    second,
    /\[nested topic\]\(\/docs\/01-first-section#nested-topic\)/,
  );
  assert.match(
    first,
    /Generated from docs\/glitchpad-technical-specification\.md/,
  );
  assert.doesNotMatch(first, /Table of Contents/);
});

test('canonical technical specification produces exactly 38 ordered focused pages', async () => {
  const source = await readFile(
    join(repositoryRoot, 'docs', 'glitchpad-technical-specification.md'),
    'utf8',
  );
  const workspace = JSON.parse(
    await readFile(join(repositoryRoot, 'package.json'), 'utf8'),
  );
  const readme = await readFile(join(repositoryRoot, 'README.md'), 'utf8');
  const documentation = buildDocumentation({
    technicalSpecification: source,
    workspace,
    readme,
  });
  assert.equal(documentation.manifest.sections.length, 38);
  assert.deepEqual(
    documentation.manifest.sections.map(({ number }) => number),
    Array.from({ length: 38 }, (_, index) => index + 1),
  );
  assert.equal(
    [...documentation.files].filter(([name]) => /^\d{2}-.+\.mdx$/.test(name))
      .length,
    38,
  );
  assert.match(
    documentation.files.get('01-document-control-and-authority.mdx'),
    /flowchart TB/,
  );
  assert.match(
    documentation.files.get('38-appendices.mdx'),
    /## Appendix K\. Release documentation pass checklist/,
  );
  assert.match(
    documentation.files.get('index.mdx'),
    /\| Updated \| 2026-09-09 \|/,
  );
  assert.doesNotMatch(
    [...documentation.files.values()].join('\n'),
    /^## Table of Contents$/m,
  );
});

test('generation rejects malformed numbering, mismatched anchors, and slug collisions', () => {
  assert.throws(
    () =>
      parseTechnicalSpecification(fixture.replace('2. [Second', '3. [Second')),
    /expected table-of-contents entry 2/i,
  );
  assert.throws(
    () =>
      parseTechnicalSpecification(
        fixture.replace('#2-second-section)', '#2-wrong-section)'),
      ),
    /anchor.*does not match/i,
  );
  assert.throws(
    () =>
      parseTechnicalSpecification(
        fixture.replace('## 2. Second Section', '## 2. First Section'),
      ),
    /title.*does not match/i,
  );
  assert.throws(
    () =>
      parseTechnicalSpecification(
        fixture.replace(
          '## 2. Second Section',
          '### Nested Topic\n\n## 2. Second Section',
        ),
      ),
    /duplicate canonical heading anchor/i,
  );
  assert.throws(
    () =>
      parseTechnicalSpecification(
        fixture.replace('## 2. Second Section\n\nReturn', 'Return'),
      ),
    /table of contents has 2 entries but 1 numbered section/i,
  );
  assert.throws(
    () =>
      parseTechnicalSpecification(
        fixture.replace('## 1. First', '## 2. First'),
      ),
    /expected section 1, found section 2/i,
  );
  assert.throws(
    () =>
      parseTechnicalSpecification(
        fixture.replace('First Section', '<script>First Section</script>'),
      ),
    /raw HTML is not allowed in documentation structure text/i,
  );
});

test('generation validates specification, workspace, license, and README authorities', () => {
  assert.throws(
    () =>
      buildDocumentation({
        technicalSpecification: fixture,
        workspace: { version: '1.2.4', license: 'Apache-2.0' },
        readme:
          'Glitchpad v1.2.4 is the current corrective community release.\n',
      }),
    /specification version 1\.2\.3 does not match workspace version 1\.2\.4/i,
  );
  assert.throws(
    () =>
      buildDocumentation({
        technicalSpecification: fixture,
        workspace: { version: '1.2.3', license: 'MIT' },
        readme:
          'Glitchpad v1.2.3 is the current corrective community release.\n',
      }),
    /document-control license does not include workspace license MIT/i,
  );
  assert.throws(
    () =>
      buildDocumentation({
        technicalSpecification: fixture,
        workspace: { version: '1.2.3', license: 'Apache-2.0' },
        readme: 'No current release statement.\n',
      }),
    /README community release status authority/i,
  );
});

test('complete-set publication removes stale output and is deterministic', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-s036-'));
  const docsDirectory = join(root, 'docs');
  const generatedDirectory = join(root, 'generated');
  try {
    const documentation = buildDocumentation({
      technicalSpecification: fixture,
      workspace: { version: '1.2.3', license: 'Apache-2.0' },
      readme: 'Glitchpad v1.2.3 is the current corrective community release.\n',
    });
    await publishDocumentation({
      docsDirectory,
      generatedDirectory,
      documentation,
      projectSource: '// deterministic project facts\n',
    });
    await writeFile(join(docsDirectory, 'stale.mdx'), 'stale\n');
    const expectedDocs = new Map(
      await Promise.all(
        (await readdir(docsDirectory)).map(async (name) => [
          name,
          await readFile(join(docsDirectory, name), 'utf8'),
        ]),
      ),
    );
    const expectedManifest = await readFile(
      join(generatedDirectory, 'documentation.json'),
      'utf8',
    );
    await publishDocumentation({
      docsDirectory,
      generatedDirectory,
      documentation,
      projectSource: '// deterministic project facts\n',
    });
    assert.ok(!(await readdir(docsDirectory)).includes('stale.mdx'));
    assert.equal(
      await readFile(join(generatedDirectory, 'documentation.json'), 'utf8'),
      expectedManifest,
    );
    for (const [name, source] of expectedDocs) {
      if (name === 'stale.mdx') continue;
      assert.equal(await readFile(join(docsDirectory, name), 'utf8'), source);
    }

    const invalid = {
      ...documentation,
      files: new Map([
        ...documentation.files,
        ['missing/partial.mdx', 'must never publish\n'],
      ]),
    };
    const retainedIndex = await readFile(
      join(docsDirectory, 'index.mdx'),
      'utf8',
    );
    await assert.rejects(
      publishDocumentation({
        docsDirectory,
        generatedDirectory,
        documentation: invalid,
        projectSource: '// changed project facts\n',
      }),
    );
    assert.equal(
      await readFile(join(docsDirectory, 'index.mdx'), 'utf8'),
      retainedIndex,
    );
    await publishDocumentation({
      docsDirectory,
      generatedDirectory,
      documentation,
      projectSource: '// deterministic project facts\n',
    });
    assert.ok(!(await readdir(root)).some((name) => name.includes('staging')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('publication recovery restores both outputs after an interrupted install', async () => {
  const root = await mkdtemp(join(tmpdir(), 'glitchpad-s036-recovery-'));
  const docsDirectory = join(root, 'docs');
  const generatedDirectory = join(root, 'generated');
  try {
    const documentation = buildDocumentation({
      technicalSpecification: fixture,
      workspace: { version: '1.2.3', license: 'Apache-2.0' },
      readme: 'Glitchpad v1.2.3 is the current corrective community release.\n',
    });
    await publishDocumentation({
      docsDirectory,
      generatedDirectory,
      documentation,
      projectSource: '// original project facts\n',
    });
    const originalIndex = await readFile(
      join(docsDirectory, 'index.mdx'),
      'utf8',
    );
    const originalManifest = await readFile(
      join(generatedDirectory, 'documentation.json'),
      'utf8',
    );

    await rename(docsDirectory, `${docsDirectory}.s036-backup`);
    await rename(generatedDirectory, `${generatedDirectory}.s036-backup`);
    await mkdir(docsDirectory);
    await writeFile(join(docsDirectory, 'index.mdx'), 'partial new docs\n');

    const invalid = {
      ...documentation,
      files: new Map([
        ...documentation.files,
        ['missing/partial.mdx', 'must never publish\n'],
      ]),
    };
    await assert.rejects(
      publishDocumentation({
        docsDirectory,
        generatedDirectory,
        documentation: invalid,
        projectSource: '// changed project facts\n',
      }),
    );

    assert.equal(
      await readFile(join(docsDirectory, 'index.mdx'), 'utf8'),
      originalIndex,
    );
    assert.equal(
      await readFile(join(generatedDirectory, 'documentation.json'), 'utf8'),
      originalManifest,
    );
    assert.ok(!(await readdir(root)).some((name) => name.includes('backup')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('landing copy keeps the current release, canonical brand, and navigation contract', async () => {
  const home = await readFile(
    join(siteRoot, 'app', '(home)', 'page.tsx'),
    'utf8',
  );
  const navigation = await readFile(
    join(siteRoot, 'lib', 'layout.shared.tsx'),
    'utf8',
  );
  const footer = await readFile(
    join(siteRoot, 'components', 'footer.tsx'),
    'utf8',
  );
  assert.match(home, /v0\.1\.2 community release/i);
  assert.match(home, /View your files\./);
  assert.match(
    home,
    /A fast, cross-platform viewer and editor for local files\./,
  );
  assert.match(home, /A ShruggieTech project\./);
  assert.doesNotMatch(navigation, /text:\s*['"](?:Support|Security)['"]/);
  for (const route of ['/docs', '/support', '/security'])
    assert.match(home + navigation + footer, new RegExp(route));
});

test('root metadata declares the production domain and social preview', async () => {
  const layout = await readFile(join(siteRoot, 'app', 'layout.tsx'), 'utf8');
  assert.match(layout, /https:\/\/glitchpad\.com/);
  assert.match(layout, /social-preview\.png/);
  assert.match(layout, /site\.webmanifest/);
});

test('web manifest icons are present in the public export source', async () => {
  const manifest = JSON.parse(
    await readFile(join(siteRoot, 'public', 'site.webmanifest'), 'utf8'),
  );

  for (const icon of manifest.icons) {
    assert.match(icon.src, /^\/[a-z0-9.-]+$/);
    const asset = await readFile(join(siteRoot, 'public', icon.src.slice(1)));
    assert.ok(asset.byteLength > 0, `${icon.src} must not be empty`);
  }
});

test('repository support and security sections preserve actionable Markdown links', async () => {
  const support = await readFile(join(repositoryRoot, 'SUPPORT.md'), 'utf8');
  const security = await readFile(join(repositoryRoot, 'SECURITY.md'), 'utf8');
  const supportSection = extractSection(support, 'Where to ask');
  const securitySection = extractSection(security, 'Reporting a vulnerability');

  assert.match(supportSection, /\[GitHub Discussions\]\([^)]+\)/);
  assert.match(
    securitySection,
    /\[private vulnerability reporting form\]\([^)]+\)/,
  );
  assert.doesNotMatch(supportSection, /^# /m);
  assert.doesNotMatch(securitySection, /^# /m);
});

test('generated site support maps repository-relative security guidance to the public route', async () => {
  const project = await readFile(
    join(siteRoot, 'lib', 'generated', 'project.ts'),
    'utf8',
  );
  assert.match(project, /\[SECURITY\.md\]\(\/security\)/);
  assert.doesNotMatch(project, /\[SECURITY\.md\]\(SECURITY\.md\)/);
});

test('documentation workflow rejects stale checked generation contracts', async () => {
  const workflow = await readFile(
    join(repositoryRoot, '.github', 'workflows', 'docs.yml'),
    'utf8',
  );
  assert.match(
    workflow,
    /git diff --exit-code -- site\/content\/docs\/index\.mdx/,
  );
  assert.match(workflow, /site\/content\/docs\/meta\.json/);
  assert.match(workflow, /site\/lib\/generated\/documentation\.json/);
});
