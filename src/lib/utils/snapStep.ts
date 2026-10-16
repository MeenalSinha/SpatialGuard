import { formatLength, formatLengthPrecise, type ProjectSettings } from '$lib/stores/settings';

/**
 * The status-bar Snap button (S) only chooses the step that snapping rounds to: the grid size, or
 * the finer step. Turning snapping off is the top-bar Snap to Grid button's job. The steps stay
 * metric (25 cm and 10 cm) in either unit system, so in feet and inches the label keeps a tenth of
 * an inch (25 cm reads 9.8") instead of rounding to a whole inch the plan does not snap to.
 */
export function snapStepLabel(stepCm: number, units: ProjectSettings['units']): string {
  return units === 'imperial' ? formatLengthPrecise(stepCm, units) : formatLength(stepCm, units);
}
