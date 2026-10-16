import { describe, expect, it } from 'vitest';
import { translate } from '$lib/i18n';
import { SNAP, snap } from '$lib/utils/canvasInteraction';
import { snapStepLabel } from '$lib/utils/snapStep';

describe('the status-bar snap step', () => {
  it('names the grid and the finer step in centimetres', () => {
    expect(snapStepLabel(25, 'metric')).toBe('25 cm');
    expect(snapStepLabel(SNAP, 'metric')).toBe('10 cm');
  });

  it('keeps a tenth of an inch in feet and inches, because the steps stay metric', () => {
    expect(snapStepLabel(25, 'imperial')).toBe('9.8"');
    expect(snapStepLabel(SNAP, 'imperial')).toBe('3.9"');
  });

  it('only changes the step: the finer step still rounds, and only the top-bar switch stops snapping', () => {
    expect(snap(137, true, true, 25)).toBe(125);
    expect(snap(137, true, false, 25)).toBe(140);
    expect(snap(137, false, true, 25)).toBe(137);
  });

  for (const language of ['en', 'pt'] as const) {
    it(`is not labelled as the top-bar Snap to Grid switch (${language})`, () => {
      const hint = translate(language, 'canvasDisplay.snapHint', { grid: '25 cm', fine: '10 cm' });
      const shortcut = translate(language, 'shortcuts.snap');
      const snapSwitch = [translate(language, 'toolbarView.snap'), translate(language, 'commandPalette.toggleSnap')];
      for (const text of [hint, shortcut]) {
        for (const label of snapSwitch) expect(text.toLowerCase()).not.toContain(label.toLowerCase());
      }
      expect(hint).toContain('25 cm');
      expect(hint).toContain('10 cm');
      expect(translate(language, 'canvasDisplay.snap', { step: '10 cm' })).toContain('10 cm');
    });
  }
});
