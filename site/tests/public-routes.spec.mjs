import { expect, test } from '@playwright/test';

for (const [path, heading, title] of [
  ['/', /See the file/, 'Glitchpad'],
  ['/docs', 'Documentation', 'Documentation'],
  [
    '/docs/technical-specification',
    'Technical specification',
    'Technical specification',
  ],
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
