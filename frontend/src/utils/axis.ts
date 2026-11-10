// Pure axis and scale helpers shared by the SVG charts. They live in a plain
// module (no JSX) so the rendering contract — a clean tick ladder, a zero
// baseline that always sits below the data, and tick labels that cannot be
// clipped by the axis gutter — can be unit-tested without a DOM.
//
// A zero page-overflow measurement does not detect a cut-off tick label, so the
// "label fits the gutter" guarantee is encoded here rather than measured in the
// browser.
import { number } from './format.ts';

// Left gutter reserved for the y-axis in each chart, in viewBox units.
export const AXIS_GUTTER_PX = { bars: 78, line: 70 } as const;

// Axis tick label font size (viewBox units) and a rough per-character advance
// ratio for the chart font. Used only to assert that a label cannot overflow.
export const AXIS_FONT_PX = 11;
export const CHAR_ADVANCE_RATIO = 0.62;

export function tickLabelFits(label: string, gutter: number, font = AXIS_FONT_PX): boolean {
  return label.length * CHAR_ADVANCE_RATIO * font + 8 <= gutter;
}

// Compact SI-style suffix for axis ticks so a wide lakh/crore label can never be
// clipped by the plot's left padding (raw grouped values overflowed the gutter at
// national scale). Values keep Indian digit grouping via the shared formatter.
export function compact(v: number): string {
  if (!Number.isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1e7) return number(v / 1e7, 2) + 'Cr';
  if (a >= 1e5) return number(v / 1e5, 2) + 'L';
  if (a >= 1e3) return number(v / 1e3, 1) + 'k';
  return number(v);
}

// Pick up to ~8 "nice" tick values whose top sits at least 8% above the largest
// value, so value labels have headroom above the tallest bar and the axis stays
// readable. The ladder is fixed so the same data always yields the same ticks.
export function niceTicks(maxScaled: number): number[] {
  if (!(maxScaled > 0)) return [0, 1];
  const target = maxScaled * 1.08;
  const ladder = [1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  let step = ladder[ladder.length - 1];
  for (const s of ladder) {
    if (Math.ceil(target / s) <= 7) { step = s; break; }
  }
  const top = Math.ceil(target / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
  return ticks;
}

export type BarScale = { factor: number; scaleWord: string; ticks: number[]; top: number };

// Derive the shared scale for a zero-baseline bar chart: the lakh/thousand/raw
// factor, the axis word, the nice tick ladder and the value at the top tick.
export function barScale(maxValue: number): BarScale {
  const factor = maxValue >= 1e5 ? 1e5 : maxValue >= 1e3 ? 1e3 : 1;
  const scaleWord = factor === 1e5 ? 'lakh' : factor === 1e3 ? 'thousand' : 'cases';
  const ticks = niceTicks(maxValue / factor);
  return { factor, scaleWord, ticks, top: ticks[ticks.length - 1] * factor };
}
