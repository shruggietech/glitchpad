import { expect, test } from '@playwright/test';

test('landing route supports keyboard entry and responsive layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  await expect(page.locator('img')).toHaveCount(2);
});

test('light, dark, and reduced-motion preferences remain usable', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/docs');
  await expect(page.locator('html')).toHaveAttribute('class', /dark/);
  const motion = await page.evaluate(
    () => getComputedStyle(document.documentElement).scrollBehavior,
  );
  expect(motion).toBe('auto');
  const landmarks = await page.locator('main, [role="main"]').count();
  expect(landmarks).toBe(1);
});
