import { expect, test } from '@playwright/test';

const routes = ['/', '/docs'];
const widths = [320, 768, 1280];

async function openWithSystemTheme(page, route, colorScheme, width) {
  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ colorScheme });
  await page.addInitScript(() => window.localStorage.removeItem('theme'));
  await page.goto(route);
  const root = page.locator('html');
  if (colorScheme === 'dark')
    await expect(root).toHaveAttribute('class', /dark/);
  else await expect(root).not.toHaveAttribute('class', /(?:^|\s)dark(?:\s|$)/);
}

async function openWithStoredTheme(page, route, systemTheme, storedTheme) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: systemTheme });
  await page.addInitScript(
    (theme) => window.localStorage.setItem('theme', theme),
    storedTheme,
  );
  await page.goto(route);
  const root = page.locator('html');
  if (storedTheme === 'dark')
    await expect(root).toHaveAttribute('class', /dark/);
  else await expect(root).not.toHaveAttribute('class', /(?:^|\s)dark(?:\s|$)/);
}

async function expectLockup(page, colorScheme) {
  const expected =
    colorScheme === 'dark'
      ? '/logos/glitchpad-horizontal-white.svg'
      : '/logos/glitchpad-horizontal-black.svg';
  const lockup = page.locator('.brand-lockup:visible');
  await expect(lockup).toHaveCount(1);
  await expect(lockup.locator('img')).toHaveCount(2);
  await expect(lockup.locator('img:visible')).toHaveCount(1);
  await expect(lockup.locator('img:visible')).toHaveAttribute('src', expected);
  const home = page.getByRole('link', { name: 'Glitchpad', exact: true });
  await expect(home).toHaveCount(1);
  await expect(home).toBeVisible();
  await expect(home).toHaveAttribute('href', '/');
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

for (const route of routes) {
  for (const colorScheme of ['light', 'dark']) {
    for (const width of widths) {
      test(`${route} selects the ${colorScheme} surface lockup at ${width}px`, async ({
        page,
      }) => {
        await openWithSystemTheme(page, route, colorScheme, width);
        await expectLockup(page, colorScheme);
      });
    }
  }

  for (const [systemTheme, storedTheme] of [
    ['light', 'dark'],
    ['dark', 'light'],
  ]) {
    test(`${route} honors stored ${storedTheme} over system ${systemTheme}`, async ({
      page,
    }) => {
      await openWithStoredTheme(page, route, systemTheme, storedTheme);
      await expectLockup(page, storedTheme);
    });
  }

  test(`${route} switches lockups without reloading or losing its name`, async ({
    page,
  }) => {
    await openWithSystemTheme(page, route, 'light', 1280);
    await expectLockup(page, 'light');
    await page.evaluate(() => {
      window.__s010PageMarker = 'retained';
    });

    await page.getByRole('button', { name: 'Toggle Theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('class', /dark/);
    await expectLockup(page, 'dark');
    expect(await page.evaluate(() => window.__s010PageMarker)).toBe('retained');

    await page.getByRole('button', { name: 'Toggle Theme' }).click();
    await expect(page.locator('html')).not.toHaveAttribute(
      'class',
      /(?:^|\s)dark(?:\s|$)/,
    );
    await expectLockup(page, 'light');
    expect(await page.evaluate(() => window.__s010PageMarker)).toBe('retained');
  });
}
