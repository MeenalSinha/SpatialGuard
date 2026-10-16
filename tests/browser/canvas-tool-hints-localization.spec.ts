import { expect, test } from '@playwright/test';

test('Portuguese tool hints guide walls, openings, furniture, measuring, text and dimensions', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('o3d_locale', 'pt');
    localStorage.setItem('o3d_tips_seen', JSON.stringify(['first-wall', 'first-door', 'first-furniture', 'first-export']));
    // The opening ghost and wall snap labels are painted on the plan canvas, not placed in the DOM.
    const painted = new Set<string>();
    (window as any).__painted = painted;
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      if (/^(Floor plan editor canvas|Área de edição da planta baixa)$/.test(this.canvas.getAttribute('aria-label') ?? '')) painted.add(String(args[0]));
      return fill.apply(this, args);
    };
  });
  await page.goto('/editor');
  const canvas = page.getByLabel(/^(?:Floor plan editor canvas|Área de edição da planta baixa)$/, { exact: true });
  await expect(canvas).toHaveAccessibleName('Área de edição da planta baixa');
  const painted = (text: string) => page.evaluate(text => (window as any).__painted.has(text), text);
  const drawWall = page.getByRole('button', { name: /^Desenhar parede W/ });

  await drawWall.click();
  await canvas.click({ position: { x: 100, y: 250 } });
  const wallHint = page.getByText('Clique para adicionar um segmento de parede · Clique duas vezes para concluir · C para fechar o contorno · Esc para cancelar', { exact: true });
  await expect(wallHint).toBeVisible();
  await canvas.click({ position: { x: 700, y: 250 } });
  await page.keyboard.press('Escape');
  await expect(wallHint).toHaveCount(0);

  // A new wall aimed at the middle of the first one, off the 45° angle snaps, snaps onto it.
  await drawWall.click();
  await canvas.click({ position: { x: 373, y: 435 } });
  await canvas.hover({ position: { x: 450, y: 250 } });
  await expect.poll(() => painted('Ajustar à parede')).toBe(true);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Ajustar à tela', exact: true }).click();
  const bounds = (await canvas.boundingBox())!;
  await page.getByRole('button', { name: 'Simples 90cm de abrir', exact: true }).click();
  await canvas.hover({ position: { x: bounds.width * .35, y: bounds.height / 2 } });
  await expect.poll(() => painted('Clique para posicionar a porta')).toBe(true);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Fixa 100×100cm', exact: true }).click();
  await canvas.hover({ position: { x: bounds.width * .65, y: bounds.height / 2 } });
  await expect.poll(() => painted('Clique para posicionar a janela')).toBe(true);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Objetos', exact: true }).click();
  await page.getByRole('button', { name: /^Sof[aá](?: Sof[aá])?(?: 200×90cm)?$/ }).first().click();
  await expect(page.getByText('Clique para posicionar · Role ou pressione R para girar (0°) · Esc para cancelar', { exact: true })).toBeVisible();
  await canvas.press('r');
  const furnitureHint = page.getByText('Clique para posicionar · Role ou pressione R para girar (15°) · Esc para cancelar', { exact: true });
  await expect(furnitureHint).toBeVisible();
  await canvas.press('Escape');
  await expect(furnitureHint).toHaveCount(0);

  await canvas.press('m');
  const measureHint = page.getByText('Clique ou toque em dois pontos para medir · M para sair · Esc para cancelar', { exact: true });
  await expect(measureHint).toBeVisible();
  await canvas.press('Escape');
  await expect(measureHint).toHaveCount(0);

  await canvas.press('t');
  const textHint = page.getByText('Clique para posicionar o rótulo de texto · Esc para cancelar', { exact: true });
  await expect(textHint).toBeVisible();
  await canvas.press('Escape');
  await expect(textHint).toHaveCount(0);

  await canvas.press('n');
  await expect(page.getByText('Clique no primeiro ponto · N para sair · Esc para cancelar', { exact: true })).toBeVisible();
  await canvas.click({ position: { x: bounds.width * .5, y: bounds.height * .25 } });
  const secondPoint = page.getByText('Clique no segundo ponto para criar a anotação · N para sair · Esc para cancelar', { exact: true });
  await expect(secondPoint).toBeVisible();
  await canvas.press('Escape');
  await expect(secondPoint).toHaveCount(0);

  expect(await page.evaluate(() => [...((window as any).__painted as Set<string>)].filter(text => /^(Click to place (door|window)|Snap to wall)$/.test(text)))).toEqual([]);
});
