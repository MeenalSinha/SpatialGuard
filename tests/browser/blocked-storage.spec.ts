import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const unavailable = 'Browser storage is unavailable. Allow site storage or download your project as JSON.';

/** Site data blocked (strict privacy settings, "Block all cookies"): web storage refuses access and IndexedDB will not open. */
async function blockSiteStorage(page: Page) {
  await page.addInitScript(() => {
    const denied = () => new DOMException('Access is denied for this document.', 'SecurityError');
    for (const name of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, name, { configurable: true, get() { throw denied(); } });
    }
    IDBFactory.prototype.open = function() { throw denied(); };
  });
}

function observe(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  return () => expect(errors).toEqual([]);
}

test('the library explains blocked site storage instead of failing to load', async ({ page }) => {
  const check = observe(page);
  await blockSiteStorage(page);
  await page.goto('/');
  const alert = page.getByRole('alert').filter({ hasText: unavailable });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Retry loading', exact: true })).toBeVisible();
  await expect(alert.getByRole('button', { name: 'Download library backup', exact: true })).toBeVisible();
  check();
});

test('with site storage blocked a new plan still opens, downloads as JSON and takes a theme', async ({ page }) => {
  const check = observe(page);
  await page.emulateMedia({ colorScheme: 'light' });
  await blockSiteStorage(page);
  await page.goto('/');
  await expect(page.getByRole('alert').filter({ hasText: unavailable })).toBeVisible();
  await page.getByRole('button', { name: 'New Project', exact: true }).click();
  await expect(page).toHaveURL(/\/editor\?id=/);
  const saveAlert = page.getByRole('alert').filter({ hasText: 'Changes are not saved.' });
  await expect(saveAlert).toContainText(unavailable);

  // The plan exists only in memory; the JSON backup keeps it.
  const pending = page.waitForEvent('download');
  await saveAlert.getByRole('button', { name: 'Download JSON backup', exact: true }).click();
  const backup = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(backup.id).toBe(new URL(page.url()).searchParams.get('id'));

  const html = page.locator('html');
  await expect(html).not.toHaveClass(/\bdark\b/);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settings.getByRole('button', { name: 'Appearance', exact: true }).click();
  await settings.getByRole('button', { name: 'Dark' }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  check();
});
