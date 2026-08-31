import { expect, test } from '@playwright/test';

for (const [path, heading] of [
  ['/', /See the file/],
  ['/docs', 'Documentation'],
  ['/docs/technical-specification', 'Technical specification'],
  ['/license', 'License'],
  ['/support', 'Support'],
  ['/security', 'Security'],
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
  });
}

test('unknown route renders the static not-found page', async ({ page }) => {
  const response = await page.goto('/missing-s007-route');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'Page not found' }),
  ).toBeVisible();
});
