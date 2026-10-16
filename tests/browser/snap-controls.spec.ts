import { expect, test, type Page } from '@playwright/test';

/** The Command Palette's "Toggle Snap" flips the same switch as the top-bar Snap to Grid button. */
async function toggleSnapFromPalette(page: Page) {
  await page.getByRole('button', { name: 'Save', exact: true }).press('ControlOrMeta+k');
  const search = page.getByRole('combobox', { name: 'Search commands', exact: true });
  await search.fill('Toggle Snap');
  await expect(page.getByRole('option', { name: /Toggle Snap/ })).toHaveAttribute('aria-selected', 'true');
  await search.press('Enter');
  await expect(search).toHaveCount(0);
}

test('the top-bar Snap to Grid button shows the state the Command Palette set', async ({ page }) => {
  await page.goto('/editor');
  const snapping = page.getByRole('button', { name: 'Snap to Grid', exact: true });
  await expect(snapping).toHaveAttribute('aria-pressed', 'true');
  await expect(snapping).toHaveAttribute('title', 'Snap to Grid (On)');
  await toggleSnapFromPalette(page);
  await expect(snapping).toHaveAttribute('aria-pressed', 'false');
  await expect(snapping).toHaveAttribute('title', 'Snap to Grid (Off)');
  await snapping.click();
  await expect(snapping).toHaveAttribute('aria-pressed', 'true');
  await expect(snapping).toHaveAttribute('title', 'Snap to Grid (On)');
  await toggleSnapFromPalette(page);
  await expect(snapping).toHaveAttribute('title', 'Snap to Grid (Off)');
});

test('the More actions Snap to Grid item shows the state the Command Palette set on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/editor');
  await toggleSnapFromPalette(page);
  await page.getByRole('button', { name: 'More actions', exact: true }).click();
  const item = page.getByRole('button', { name: /Snap to Grid/ });
  await expect(item).toHaveAttribute('aria-pressed', 'false');
  await expect(item).toHaveText('Snap to Grid');
  await item.click();
  await expect(item).toHaveAttribute('aria-pressed', 'true');
  await expect(item).toHaveText('✓ Snap to Grid');
});
