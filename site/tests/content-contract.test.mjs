import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  adaptTechnicalSpecification,
  extractSection,
} from '../scripts/prebuild.mjs';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(siteRoot, '..');

test('technical specification adaptation preserves authority and Mermaid source', async () => {
  const source = await readFile(
    join(repositoryRoot, 'docs', 'glitchpad-technical-specification.md'),
    'utf8',
  );
  const adapted = adaptTechnicalSpecification(source);
  assert.match(
    adapted,
    /Generated from docs\/glitchpad-technical-specification\.md/,
  );
  assert.match(adapted, /flowchart TB/);
  assert.doesNotMatch(adapted, /^# Glitchpad Technical Specification$/m);
});

test('landing copy keeps the prerelease claim and required routes', async () => {
  const home = await readFile(
    join(siteRoot, 'app', '(home)', 'page.tsx'),
    'utf8',
  );
  assert.match(home, /no installable release is available yet/i);
  for (const route of ['/docs', '/support', '/security'])
    assert.match(
      home +
        (await readFile(join(siteRoot, 'components', 'footer.tsx'), 'utf8')),
      new RegExp(route),
    );
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
