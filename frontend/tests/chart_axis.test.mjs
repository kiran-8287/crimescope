/**
 * Regression tests for the zero-baseline bar axis contract used by the overview
 * and trends annual charts.
 *
 * Observed defect: the previous annual charts rendered four standalone values as
 * isolated dots on a line axis whose raw grouped tick labels (e.g. "32,93,315")
 * overflowed the 56px left gutter, so the axis labels were silently cut off — a
 * zero page-overflow measurement cannot detect a clipped tick label. The fix
 * widens the gutter and switches ticks to compact lakh/thousand suffixes, and the
 * tick ladder is now chosen so the tallest bar always sits below the top gridline.
 *
 * These tests exercise the pure axis helpers the component uses (not the caveat
 * text), so they fail if the scale, the zero baseline, or the label widths regress.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { niceTicks, barScale, compact, tickLabelFits, AXIS_GUTTER_PX } from '../src/utils/axis.ts';
import { number } from '../src/utils/format.ts';

// Authoritative national annual recorded totals (2021–2024) and the matched cohort
// endpoints, reused from the trend fixtures.
const NATIONAL = [2_909_532, 2_808_408, 2_940_460, 2_740_258];
const MATCHED = [2_804_254, 2_892_597];

test('national annual bars use a clean lakh ladder from a zero baseline', () => {
  const scale = barScale(Math.max(...NATIONAL));
  assert.equal(scale.factor, 100_000, 'national scale must be in lakhs');
  assert.equal(scale.scaleWord, 'lakh');
  assert.deepEqual(scale.ticks, [0, 5, 10, 15, 20, 25, 30, 35],
    'national ticks must be exactly the clean lakh ladder 0…35');
  assert.equal(scale.ticks[0], 0, 'the axis must start at a true zero baseline');
  assert.ok(scale.top >= Math.max(...NATIONAL),
    'the top tick must sit at or above the tallest bar so value labels have headroom');
  assert.ok(scale.ticks.length <= 8, 'the tick ladder must stay readable (<= 8 ticks)');
});

test('the matched two-bar chart shares the same zero-baseline scale', () => {
  const scale = barScale(Math.max(...MATCHED));
  assert.equal(scale.factor, 100_000);
  assert.equal(scale.ticks[0], 0, 'matched bars must also rise from zero');
  for (const value of MATCHED) {
    assert.ok(value >= 0 && value <= scale.top,
      `matched value ${value} must sit within the zero..${scale.top} range so it is never clipped`);
  }
});

test('tick ladders are strictly ascending and start at zero', () => {
  for (const max of [35, 922, 2_940_460, 12_000_000]) {
    const ticks = niceTicks(max >= 1e5 ? max / 1e5 : max >= 1e3 ? max / 1e3 : max);
    assert.equal(ticks[0], 0);
    for (let i = 1; i < ticks.length; i++) {
      assert.ok(ticks[i] > ticks[i - 1], `ticks must ascend (${ticks.join(',')})`);
    }
  }
});

test('compact axis labels fit the gutter where raw grouped values did not', () => {
  // Widest raw y-tick the line chart would draw at national scale.
  const rawWidest = number(3_293_315);
  assert.equal(rawWidest, '32,93,315', 'sanity: raw grouping overflows wider than a suffix label');

  // The original 56px gutter could not hold the raw label — this is the defect.
  assert.equal(tickLabelFits(rawWidest, 56), false,
    'raw grouped lakh labels overflow the old 56px gutter (the reported clipping)');

  // The compact labels the charts now emit fit the widened gutters.
  assert.equal(compact(3_293_315), '32.93L');
  assert.ok(tickLabelFits(compact(3_293_315), AXIS_GUTTER_PX.line),
    'compact line-axis label must fit the widened line gutter');
});

test('every national and matched tick label fits the bar gutter', () => {
  for (const value of [...NATIONAL, ...MATCHED]) {
    const scale = barScale(value);
    for (const tick of scale.ticks) {
      const label = scale.factor === 1 ? number(tick) : number(tick, 1);
      assert.ok(tickLabelFits(label, AXIS_GUTTER_PX.bars),
        `tick label "${label}" must fit the ${AXIS_GUTTER_PX.bars}px bar gutter`);
    }
  }
});

test('a small state-scoped selection still renders a valid zero-baseline axis', () => {
  // e.g. a single district total well under one lakh.
  const scale = barScale(3_922);
  assert.equal(scale.factor, 1_000);
  assert.equal(scale.scaleWord, 'thousand');
  assert.equal(scale.ticks[0], 0);
  assert.ok(scale.top >= 3_922);
});
