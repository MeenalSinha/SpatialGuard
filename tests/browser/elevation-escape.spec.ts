import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const id = 'qa-elevation-escape';
async function seed(page: Page) {
  const project = JSON.parse(await readFile('tests/fixtures/save-conflicts.openplan.json', 'utf8'));
  project.id = id; project.name = 'QA Elevation Escape';
  await page.addInitScript(project => {
    if (!localStorage.getItem('qaElevationEscapeSeeded')) {
      localStorage.setItem('floorplan_projects', JSON.stringify({ [project.id]: JSON.stringify(project) }));
      localStorage.setItem('hasSeenWelcome', 'true');
      localStorage.setItem('qaElevationEscapeSeeded', 'true');
    }
  }, project);
  await page.goto(`/editor?id=${id}`);
  await page.getByRole('button', { name: 'Save', exact: true }).press('l');
  await page.getByRole('button', { name: '─ Wall 1', exact: true }).click();
}
function observe(page: Page) {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== 'http://127.0.0.1:4188') external.push(r.url()); });
  return () => { expect(errors).toEqual([]); expect(external).toEqual([]); };
}

test('a wall elevation leaves Escape to open menus, panels and focused fields', async ({ page }) => {
  const check = observe(page); await seed(page);
  const elevation = page.getByRole('button', { name: 'Elevation', exact: true }).first();
  const canvas = page.getByLabel('Wall elevation editor canvas', { exact: true });
  const thickness = page.getByRole('spinbutton', { name: 'Thickness (cm)', exact: true });
  await elevation.click();
  await expect(canvas).toBeVisible();
  await expect(elevation).toHaveAttribute('aria-pressed', 'true');
  await expect(thickness).toHaveValue('20');

  // A top-bar menu closes on Escape while focus stays on its trigger; the elevation and
  // the selected wall (the plan canvas must not act on the key) are kept.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = page.getByRole('button', { name: 'Download JSON', exact: true });
  await expect(download).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(download).toHaveCount(0);
  await expect(canvas).toBeVisible();
  await expect(thickness).toHaveValue('20');

  // The Undo History panel closes from inside and returns focus to its toggle.
  const toggle = page.getByRole('button', { name: 'Toggle Undo History', exact: true });
  const panel = page.getByRole('region', { name: 'Undo History', exact: true });
  await toggle.click();
  await expect(panel.getByRole('button', { name: 'Close history', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(canvas).toBeVisible();

  // A focused field keeps its Escape.
  await thickness.focus();
  await page.keyboard.press('Escape');
  await expect(thickness).toBeFocused();
  await expect(canvas).toBeVisible();
  await expect(elevation).toHaveAttribute('aria-pressed', 'true');

  // With nothing else to close, Escape returns to the plan.
  await toggle.focus();
  await page.keyboard.press('Escape');
  await expect(canvas).toHaveCount(0);
  await expect(elevation).toHaveAttribute('aria-pressed', 'false');
  await expect(thickness).toHaveValue('20');
  check();
});
