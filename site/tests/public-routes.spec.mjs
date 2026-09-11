import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const documentation = JSON.parse(
  await readFile('lib/generated/documentation.json', 'utf8'),
);
const representativeSections = [
  documentation.sections[0],
  documentation.sections[18],
  documentation.sections[37],
];

for (const [path, heading, title] of [
  ['/', /View your files/, 'Glitchpad'],
  ['/docs', 'Documentation', 'Documentation'],
  [
    '/docs/technical-specification',
    'Technical specification moved',
    'Technical specification moved',
  ],
  ...representativeSections.map((section) => [
    section.route,
    `${section.number}. ${section.title}`,
    `${section.number}. ${section.title}`,
  ]),
  ['/license', 'License', 'License'],
  ['/support', 'Support', 'Support'],
  ['/security', 'Security', 'Security'],
]) {
  test(`${path} renders its public contract`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main, [role="main"]')).toHaveCount(1);
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
    ).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /.+/,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      new RegExp(title, 'i'),
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `https://glitchpad.com${path === '/' ? '' : path}`,
    );
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      new RegExp(title, 'i'),
    );
  });
}

test('documentation navigation follows canonical order and excludes the legacy route', async ({
  page,
}) => {
  await page.goto(documentation.sections[18].route);
  const expected = [
    documentation.introductionRoute,
    ...documentation.sections.map(({ route }) => route),
  ];
  const sidebarRoutes = await page
    .locator('#nd-sidebar a[href^="/docs"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  let priorIndex = -1;
  for (const route of expected) {
    const index = sidebarRoutes.indexOf(route, priorIndex + 1);
    expect(index, `${route} must follow its predecessor`).toBeGreaterThan(
      priorIndex,
    );
    priorIndex = index;
  }
  expect(sidebarRoutes).not.toContain(documentation.compatibilityRoute);

  const previous = documentation.sections[17];
  const next = documentation.sections[19];
  await expect(
    page.locator(`[role="main"] a[href="${previous.route}"]`).last(),
  ).toHaveAttribute('href', previous.route);
  await expect(
    page.locator(`[role="main"] a[href="${next.route}"]`).last(),
  ).toHaveAttribute('href', next.route);
});

test('legacy documentation route forwards readers without monolithic content', async ({
  page,
}) => {
  await page.goto(documentation.compatibilityRoute);
  await expect(
    page.getByRole('link', {
      name: 'Open the sectioned Technical Specification',
    }),
  ).toHaveAttribute('href', '/docs');
  await expect(page.getByText(/TS-FR-001/)).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Table of Contents' }),
  ).toHaveCount(0);
});

test('representative section content preserves tables and Mermaid diagrams', async ({
  page,
}) => {
  await page.goto(documentation.sections[0].route);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Revision history' }),
  ).toBeVisible();
  await expect(page.locator('table')).toContainText('Product release');
  const diagram = page.locator('figure.mermaid-figure').first();
  await expect(diagram).toBeAttached({ timeout: 15_000 });
  await expect(diagram.locator('figcaption')).toContainText('flowchart TB');

  await page.goto(documentation.sections[37].route);
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: 'Appendix K. Release documentation pass checklist',
    }),
  ).toBeVisible();
});

test('homepage presents concise release actions and keeps utility pages secondary', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByText('A ShruggieTech project.', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('#main-content').getByRole('link', {
      name: 'Download',
      exact: true,
    }),
  ).toHaveAttribute(
    'href',
    'https://github.com/ShruggieTech/glitchpad/releases/tag/v0.1.2',
  );
  await expect(
    page.getByRole('link', { name: 'Docs', exact: true }),
  ).toHaveCount(2);
  const navigation = page.locator('header, nav').first();
  await expect(
    navigation.getByRole('link', { name: 'Support', exact: true }),
  ).toHaveCount(0);
  await expect(
    navigation.getByRole('link', { name: 'Security', exact: true }),
  ).toHaveCount(0);
});

test('repository-authored support and security links remain operable', async ({
  page,
}) => {
  await page.goto('/support');
  await expect(
    page.getByRole('link', { name: 'GitHub Discussions' }),
  ).toHaveAttribute(
    'href',
    /github\.com\/shruggietech\/glitchpad\/discussions/i,
  );

  await page.goto('/security');
  await expect(
    page.getByRole('link', { name: 'private vulnerability reporting form' }),
  ).toHaveAttribute('href', /security\/advisories\/new/);
});

test('unknown route renders the static not-found page', async ({ page }) => {
  const response = await page.goto('/missing-s007-route');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
    'content',
    /noindex/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://glitchpad.com/404',
  );
});
