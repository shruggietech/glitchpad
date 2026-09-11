import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(siteRoot, '..');
const docsDirectory = join(siteRoot, 'content', 'docs');
const generatedDirectory = join(siteRoot, 'lib', 'generated');
const canonicalSource = 'docs/glitchpad-technical-specification.md';
const generatedMarker = `{/* Generated from ${canonicalSource}. Do not edit this derived page. */}`;

function normalizeSource(source) {
  return source.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
}

function fenceAt(line) {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match) return undefined;
  return { marker: match[1][0], length: match[1].length };
}

function closesFence(line, fence) {
  const expression = new RegExp(
    `^ {0,3}\\${fence.marker}{${fence.length},}[ \\t]*$`,
  );
  return expression.test(line);
}

function headingAt(line) {
  const match = /^ {0,3}(#{1,6})[ \t]+(.*)$/.exec(line);
  if (!match) return undefined;
  const text = match[2]
    .trimEnd()
    .replace(/[ \t]+#+$/, '')
    .trimEnd();
  return { level: match[1].length, text };
}

function scanMarkdown(source) {
  const lines = normalizeSource(source).split('\n');
  const headings = [];
  let fence;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (fence) {
      if (closesFence(line, fence)) fence = undefined;
      continue;
    }
    const opening = fenceAt(line);
    if (opening) {
      fence = opening;
      continue;
    }
    const heading = headingAt(line);
    if (heading) headings.push({ ...heading, line: index });
  }
  if (fence)
    throw new Error('Unclosed fenced code block in technical specification');
  return { lines, headings };
}

function plainText(source) {
  if (/[<>]/.test(source))
    throw new Error('Raw HTML is not allowed in documentation structure text');
  return source
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function headingAnchor(source) {
  return plainText(source)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-');
}

function routeSlug(number, title) {
  const readable = headingAnchor(title);
  if (!readable)
    throw new Error(`Section ${number} title cannot produce a readable route`);
  return `${String(number).padStart(2, '0')}-${readable}`;
}

function parseDocumentControl(lines, titleLine, tocLine) {
  const rows = [];
  for (let index = titleLine + 1; index < tocLine; index += 1) {
    const match = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/.exec(lines[index]);
    if (!match || match[1] === 'Field' || /^-+$/.test(match[1])) continue;
    rows.push({ field: match[1].trim(), value: match[2].trim() });
  }
  const fields = new Map(rows.map(({ field, value }) => [field, value]));
  for (const required of [
    'Status',
    'Specification version',
    'Product version',
    'Release class',
    'Issued',
    'Updated',
    'Repository',
    'License',
  ]) {
    if (!fields.get(required))
      throw new Error(`Document-control field is missing: ${required}`);
  }
  return { rows, fields };
}

function parseTableOfContents(lines, start, end) {
  const entries = [];
  for (let index = start + 1; index < end; index += 1) {
    if (!lines[index].trim()) continue;
    const match = /^\s*(\d+)\.\s+\[([^\]]+)\]\(#([^)]+)\)\s*$/.exec(
      lines[index],
    );
    if (!match)
      throw new Error(
        `Invalid table-of-contents entry at line ${index + 1}: ${lines[index]}`,
      );
    const number = Number(match[1]);
    const expected = entries.length + 1;
    if (number !== expected)
      throw new Error(
        `Expected table-of-contents entry ${expected}, found ${number} at line ${index + 1}`,
      );
    entries.push({
      number,
      title: plainText(match[2]),
      anchor: match[3],
      line: index,
    });
  }
  if (!entries.length)
    throw new Error('Technical specification table of contents is empty');
  return entries;
}

export function parseTechnicalSpecification(source) {
  const { lines, headings } = scanMarkdown(source);
  const titles = headings.filter(({ level }) => level === 1);
  if (titles.length !== 1)
    throw new Error(
      `Technical specification must have exactly one level-one title; found ${titles.length}`,
    );
  const versionMatch =
    /^Glitchpad Technical Specification v(\d+\.\d+\.\d+)$/.exec(titles[0].text);
  if (!versionMatch)
    throw new Error(
      'Technical specification title must end with a semantic version',
    );

  const tocHeadings = headings.filter(
    ({ level, text }) => level === 2 && text === 'Table of Contents',
  );
  if (tocHeadings.length !== 1)
    throw new Error(
      `Technical specification must have exactly one Table of Contents heading; found ${tocHeadings.length}`,
    );
  const tocHeading = tocHeadings[0];
  const topLevelAfterToc = headings.filter(
    ({ level, line }) => level === 2 && line > tocHeading.line,
  );
  if (!topLevelAfterToc.length)
    throw new Error('Technical specification has no numbered sections');
  const entries = parseTableOfContents(
    lines,
    tocHeading.line,
    topLevelAfterToc[0].line,
  );
  const documentControl = parseDocumentControl(
    lines,
    titles[0].line,
    tocHeading.line,
  );

  const numberedHeadings = topLevelAfterToc.map((heading) => {
    const match = /^(\d+)\.\s+(.+)$/.exec(heading.text);
    if (!match)
      throw new Error(
        `Unexpected level-two heading after the table of contents at line ${heading.line + 1}: ${heading.text}`,
      );
    return {
      ...heading,
      number: Number(match[1]),
      title: plainText(match[2]),
      anchor: headingAnchor(heading.text),
    };
  });
  if (numberedHeadings.length !== entries.length)
    throw new Error(
      `Table of contents has ${entries.length} entries but ${numberedHeadings.length} numbered sections were found`,
    );

  const seenRoutes = new Set();
  const sections = numberedHeadings.map((heading, index) => {
    const expectedNumber = index + 1;
    if (heading.number !== expectedNumber)
      throw new Error(
        `Expected section ${expectedNumber}, found section ${heading.number} at line ${heading.line + 1}`,
      );
    const entry = entries[index];
    if (entry.number !== heading.number)
      throw new Error(
        `Table-of-contents entry ${entry.number} does not match section ${heading.number}`,
      );
    if (entry.title !== heading.title)
      throw new Error(
        `Table-of-contents title "${entry.title}" does not match section title "${heading.title}"`,
      );
    if (entry.anchor !== heading.anchor)
      throw new Error(
        `Table-of-contents anchor "${entry.anchor}" does not match section anchor "${heading.anchor}"`,
      );
    const slug = routeSlug(heading.number, heading.title);
    if (seenRoutes.has(slug))
      throw new Error(`Duplicate generated route slug: ${slug}`);
    seenRoutes.add(slug);
    const endLine = numberedHeadings[index + 1]?.line ?? lines.length;
    const sourceLines = lines.slice(heading.line + 1, endLine);
    const ownedHeadings = headings.filter(
      ({ line, level }) => line > heading.line && line < endLine && level > 2,
    );
    return {
      number: heading.number,
      title: heading.title,
      heading: heading.text,
      anchor: heading.anchor,
      slug,
      route: `/docs/${slug}`,
      line: heading.line,
      endLine,
      body: sourceLines.join('\n').trim(),
      sourceLines,
      headings: ownedHeadings.map((owned) => ({
        ...owned,
        anchor: headingAnchor(owned.text),
      })),
    };
  });

  const anchorOwners = new Map();
  for (const section of sections) {
    for (const heading of [
      { anchor: section.anchor, topLevel: true },
      ...section.headings.map(({ anchor }) => ({ anchor, topLevel: false })),
    ]) {
      if (!heading.anchor)
        throw new Error(
          `Section ${section.number} contains an empty heading anchor`,
        );
      if (anchorOwners.has(heading.anchor))
        throw new Error(
          `Duplicate canonical heading anchor: ${heading.anchor}`,
        );
      anchorOwners.set(heading.anchor, {
        route: section.route,
        topLevel: heading.topLevel,
      });
    }
  }

  return {
    title: titles[0].text,
    version: versionMatch[1],
    documentControl,
    tableOfContents: entries,
    sections,
    anchorOwners,
  };
}

function transformOutsideCodeSpans(line, transform) {
  let output = '';
  let cursor = 0;
  const spans = /(`+)([\s\S]*?)\1/g;
  for (const match of line.matchAll(spans)) {
    output += transform(line.slice(cursor, match.index));
    output += match[0];
    cursor = match.index + match[0].length;
  }
  return output + transform(line.slice(cursor));
}

function rewriteFragments(line, section, anchorOwners) {
  return transformOutsideCodeSpans(line, (text) =>
    text.replace(/(?<!!)\[([^\]]+)\]\(#([^)]+)\)/g, (link, label, anchor) => {
      const owner = anchorOwners.get(anchor);
      if (!owner) return link;
      if (owner.topLevel) return `[${label}](${owner.route})`;
      if (owner.route === section.route) return link;
      return `[${label}](${owner.route}#${anchor})`;
    }),
  );
}

function transformSectionBody(section, anchorOwners) {
  const transformed = [];
  let fence;
  for (const line of section.sourceLines) {
    if (fence) {
      transformed.push(line);
      if (closesFence(line, fence)) fence = undefined;
      continue;
    }
    const opening = fenceAt(line);
    if (opening) {
      fence = opening;
      transformed.push(line);
      continue;
    }
    const heading = headingAt(line);
    if (heading && heading.level > 2) {
      transformed.push(`${'#'.repeat(heading.level - 1)} ${heading.text}`);
      continue;
    }
    transformed.push(rewriteFragments(line, section, anchorOwners));
  }
  return transformed.join('\n').trim();
}

function escapeMdx(source) {
  let fence;
  return source
    .split('\n')
    .map((line) => {
      if (fence) {
        if (closesFence(line, fence)) fence = undefined;
        return line;
      }
      const opening = fenceAt(line);
      if (opening) {
        fence = opening;
        return line;
      }
      if (/^\s*</.test(line)) return line;
      return transformOutsideCodeSpans(line, (text) =>
        text.replaceAll('{', '&#123;').replaceAll('}', '&#125;'),
      );
    })
    .join('\n');
}

function frontmatter(title, description) {
  const yamlString = (value) => `'${value.replaceAll("'", "''")}'`;
  return [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    '---',
    '',
    '',
  ].join('\n');
}

function renderSection(section, anchorOwners) {
  const title = `${section.number}. ${section.title}`;
  const description = `${section.title} requirements from the authoritative Glitchpad Technical Specification.`;
  const body = escapeMdx(transformSectionBody(section, anchorOwners));
  return {
    description,
    source: `${frontmatter(title, description)}${generatedMarker}\n\n${body}\n`,
  };
}

function validateAuthorities(parsed, workspace, readme) {
  if (parsed.version !== workspace.version)
    throw new Error(
      `Specification version ${parsed.version} does not match workspace version ${workspace.version}`,
    );
  for (const field of ['Specification version', 'Product version']) {
    if (parsed.documentControl.fields.get(field) !== workspace.version)
      throw new Error(
        `${field} does not match workspace version ${workspace.version}`,
      );
  }
  if (!parsed.documentControl.fields.get('License').includes(workspace.license))
    throw new Error(
      `Document-control license does not include workspace license ${workspace.license}`,
    );
  const escapedVersion = workspace.version.replaceAll('.', '\\.');
  if (
    !new RegExp(
      `Glitchpad v${escapedVersion} is the current corrective community release`,
    ).test(readme)
  )
    throw new Error(
      `README community release status authority for v${workspace.version} is missing or changed`,
    );
}

function renderIntroduction(parsed, workspace) {
  const rows = parsed.documentControl.rows
    .map(({ field, value }) => `| ${field} | ${value} |`)
    .join('\n');
  return `${frontmatter(
    'Documentation',
    'Authoritative project documentation for Glitchpad.',
  )}${generatedMarker}

Glitchpad is a fast, cross-platform viewer and editor for local files. v${workspace.version} is the current corrective community release for Markdown, Mermaid, plain-text, and supported source files.

## Technical Specification authority

The pages in this documentation set present the [Glitchpad Technical Specification](/docs/01-document-control-and-authority), the normative authority for architecture, product behavior, security, platform support, file-format capability, validation, and release requirements. Every section is generated from \`${canonicalSource}\` during the site build, so the repository document remains the single authority.

| Field | Value |
| --- | --- |
${rows}

## Current release and source

Install Glitchpad v${workspace.version} from the [GitHub release](https://github.com/ShruggieTech/glitchpad/releases/tag/v${workspace.version}). For contribution requirements, source code, verification evidence, and current work, visit the [Glitchpad repository](https://github.com/ShruggieTech/glitchpad).
`;
}

function renderCompatibilityPage() {
  return `${frontmatter(
    'Technical specification moved',
    'Continue to the sectioned authoritative Glitchpad Technical Specification.',
  )}${generatedMarker}

The Technical Specification is now presented as focused, ordered project documentation. [Open the sectioned Technical Specification](/docs).
`;
}

export function buildDocumentation({
  technicalSpecification,
  workspace,
  readme,
}) {
  const parsed = parseTechnicalSpecification(technicalSpecification);
  validateAuthorities(parsed, workspace, readme);
  const files = new Map();
  files.set('index.mdx', renderIntroduction(parsed, workspace));
  const manifestSections = [];
  for (const [index, section] of parsed.sections.entries()) {
    const rendered = renderSection(section, parsed.anchorOwners);
    files.set(`${section.slug}.mdx`, rendered.source);
    manifestSections.push({
      number: section.number,
      title: section.title,
      heading: section.heading,
      anchor: section.anchor,
      slug: section.slug,
      route: section.route,
      description: rendered.description,
      previousRoute: index === 0 ? '/docs' : parsed.sections[index - 1].route,
      nextRoute: parsed.sections[index + 1]?.route ?? null,
      headingAnchors: section.headings.map(({ anchor }) => anchor),
    });
  }
  files.set('technical-specification.mdx', renderCompatibilityPage());
  files.set(
    'meta.json',
    `${JSON.stringify(
      {
        title: 'Glitchpad Technical Specification',
        pages: ['index', ...parsed.sections.map(({ slug }) => slug)],
      },
      null,
      2,
    )}\n`,
  );
  const manifest = {
    schemaVersion: 1,
    source: canonicalSource,
    productVersion: workspace.version,
    introductionRoute: '/docs',
    compatibilityRoute: '/docs/technical-specification',
    documentControl: Object.fromEntries(
      parsed.documentControl.rows.map(({ field, value }) => [field, value]),
    ),
    sections: manifestSections,
  };
  return { files, manifest };
}

export function extractSection(source, heading) {
  const { lines, headings } = scanMarkdown(source);
  const start = headings.find(
    ({ level, text }) => level === 2 && text === heading,
  );
  if (!start) return '';
  const end = headings.find(
    ({ level, line }) => level === 2 && line > start.line,
  );
  return lines
    .slice(start.line + 1, end?.line ?? lines.length)
    .join('\n')
    .trim();
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function recoverAbandonedPublication(targets) {
  const states = await Promise.all(
    targets.map(async (target) => ({
      target,
      backup: `${target}.s036-backup`,
      targetExists: await pathExists(target),
      backupExists: await pathExists(`${target}.s036-backup`),
    })),
  );
  if (!states.some(({ backupExists }) => backupExists)) return;

  if (states.every(({ targetExists }) => targetExists)) {
    await Promise.all(
      states.map(({ backup }) => rm(backup, { recursive: true, force: true })),
    );
    return;
  }

  for (const { target, backup, targetExists, backupExists } of states) {
    if (!backupExists) continue;
    if (targetExists) await rm(target, { recursive: true, force: true });
    await rename(backup, target);
  }
}

async function writeStagingDirectory(target, files) {
  const staging = `${target}.s036-staging`;
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  try {
    for (const [name, source] of files)
      await writeFile(join(staging, name), source, 'utf8');
    const actual = (await readdir(staging)).sort();
    const expected = [...files.keys()].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error(`Staging inventory mismatch for ${target}`);
    return staging;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export async function publishDocumentation({
  docsDirectory: docsTarget,
  generatedDirectory: generatedTarget,
  documentation,
  projectSource,
}) {
  await recoverAbandonedPublication([docsTarget, generatedTarget]);
  const manifestSource = `${JSON.stringify(documentation.manifest, null, 2)}\n`;
  const generatedFiles = new Map([
    ['documentation.json', manifestSource],
    ['project.ts', projectSource],
  ]);
  const docsStaging = await writeStagingDirectory(
    docsTarget,
    documentation.files,
  );
  let generatedStaging;
  try {
    generatedStaging = await writeStagingDirectory(
      generatedTarget,
      generatedFiles,
    );
  } catch (error) {
    await rm(docsStaging, { recursive: true, force: true });
    throw error;
  }

  const targets = [
    {
      target: docsTarget,
      staging: docsStaging,
      hadTarget: false,
      installed: false,
    },
    {
      target: generatedTarget,
      staging: generatedStaging,
      hadTarget: false,
      installed: false,
    },
  ];
  try {
    for (const item of targets) {
      item.hadTarget = await pathExists(item.target);
      if (item.hadTarget)
        await rename(item.target, `${item.target}.s036-backup`);
    }
    for (const item of targets) {
      await rename(item.staging, item.target);
      item.installed = true;
    }
  } catch (error) {
    for (const item of targets.toReversed()) {
      if (item.installed)
        await rm(item.target, { recursive: true, force: true });
      if (item.hadTarget && (await pathExists(`${item.target}.s036-backup`)))
        await rename(`${item.target}.s036-backup`, item.target);
      await rm(item.staging, { recursive: true, force: true });
    }
    throw error;
  }
  await Promise.allSettled(
    targets.map(({ target }) =>
      rm(`${target}.s036-backup`, { recursive: true, force: true }),
    ),
  );
}

function buildProjectSource({ workspace, license, notice, support, security }) {
  const supportText = (
    extractSection(support, 'Where to ask') || support.trimEnd()
  ).replaceAll('(SECURITY.md)', '(/security)');
  return [
    '// Generated from repository authorities. Do not edit by hand.',
    `export const projectVersion = ${JSON.stringify(workspace.version)};`,
    'export const installableReleaseAvailable = true;',
    `export const releaseUrl = ${JSON.stringify(`https://github.com/ShruggieTech/glitchpad/releases/tag/v${workspace.version}`)};`,
    `export const licenseText = ${JSON.stringify(license.trimEnd())};`,
    `export const noticeText = ${JSON.stringify(notice.trimEnd())};`,
    `export const supportText = ${JSON.stringify(supportText)};`,
    `export const securityText = ${JSON.stringify(extractSection(security, 'Reporting a vulnerability') || security.trimEnd())};`,
    '',
  ].join('\n');
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
    readFile(join(repositoryRoot, canonicalSource), 'utf8'),
    readFile(join(repositoryRoot, 'package.json'), 'utf8'),
    readFile(join(repositoryRoot, 'README.md'), 'utf8'),
    readFile(join(repositoryRoot, 'LICENSE'), 'utf8'),
    readFile(join(repositoryRoot, 'NOTICE'), 'utf8'),
    readFile(join(repositoryRoot, 'SUPPORT.md'), 'utf8'),
    readFile(join(repositoryRoot, 'SECURITY.md'), 'utf8'),
  ]);
  const workspace = JSON.parse(packageSource);
  const documentation = buildDocumentation({
    technicalSpecification,
    workspace,
    readme,
  });
  await publishDocumentation({
    docsDirectory,
    generatedDirectory,
    documentation,
    projectSource: buildProjectSource({
      workspace,
      license,
      notice,
      support,
      security,
    }),
  });
  console.log(
    `Prepared the documentation introduction, ${documentation.manifest.sections.length} technical-specification sections, compatibility route, and repository-derived project facts.`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
