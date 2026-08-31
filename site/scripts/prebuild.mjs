import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(siteRoot, '..');
const docsOutput = join(
  siteRoot,
  'content',
  'docs',
  'technical-specification.mdx',
);
const generatedRoot = join(siteRoot, 'lib', 'generated');

function escapeMdx(source) {
  let inFence = false;
  return source
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence || /^\s*</.test(line)) return line;
      return line.replaceAll('{', '&#123;').replaceAll('}', '&#125;');
    })
    .join('\n');
}

export function adaptTechnicalSpecification(source) {
  const normalized = source.replaceAll('\r\n', '\n');
  const withoutTitle = normalized.replace(
    /^#\s+Glitchpad Technical Specification[^\n]*\n+/,
    '',
  );
  const frontmatter = [
    '---',
    'title: Technical specification',
    'description: "The normative architecture, behavior, security, platform, format, and release contract for Glitchpad."',
    '---',
    '',
    '{/* Generated from docs/glitchpad-technical-specification.md. Do not edit this adaptation. */}',
    '',
  ].join('\n');
  return `${frontmatter}${escapeMdx(withoutTitle).trimEnd()}\n`;
}

export function extractSection(source, heading) {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return '';
  const body = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) break;
    body.push(lines[index]);
  }
  return body.join('\n').trim();
}

async function main() {
  const [
    technicalSpecification,
    packageSource,
    readme,
    license,
    notice,
    support,
    security,
  ] = await Promise.all([
    readFile(
      join(repositoryRoot, 'docs', 'glitchpad-technical-specification.md'),
      'utf8',
    ),
    readFile(join(repositoryRoot, 'package.json'), 'utf8'),
    readFile(join(repositoryRoot, 'README.md'), 'utf8'),
    readFile(join(repositoryRoot, 'LICENSE'), 'utf8'),
    readFile(join(repositoryRoot, 'NOTICE'), 'utf8'),
    readFile(join(repositoryRoot, 'SUPPORT.md'), 'utf8'),
    readFile(join(repositoryRoot, 'SECURITY.md'), 'utf8'),
  ]);
  const workspace = JSON.parse(packageSource);
  if (
    !/No installable release or production viewer is available yet\./.test(
      readme,
    )
  ) {
    throw new Error(
      'README pre-release status authority is missing or changed',
    );
  }

  await mkdir(dirname(docsOutput), { recursive: true });
  await writeFile(
    docsOutput,
    adaptTechnicalSpecification(technicalSpecification),
  );
  await rm(generatedRoot, { recursive: true, force: true });
  await mkdir(generatedRoot, { recursive: true });
  const generated = [
    '// Generated from repository authorities. Do not edit by hand.',
    `export const projectVersion = ${JSON.stringify(workspace.version)};`,
    'export const installableReleaseAvailable = false;',
    `export const licenseText = ${JSON.stringify(license.trimEnd())};`,
    `export const noticeText = ${JSON.stringify(notice.trimEnd())};`,
    `export const supportText = ${JSON.stringify(extractSection(support, 'Where to ask') || support.trimEnd())};`,
    `export const securityText = ${JSON.stringify(extractSection(security, 'Reporting a vulnerability') || security.trimEnd())};`,
    '',
  ].join('\n');
  await writeFile(join(generatedRoot, 'project.ts'), generated);
  console.log(
    'Prepared public documentation and repository-derived project facts.',
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
