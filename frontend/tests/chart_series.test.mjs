/**
 * Regression tests for the shared line-series rendering contract and the scope guard.
 *
 * The observed defect was that the annual cross-framework totals were joined into a
 * single continuous line — implying a 2023→2024 trend across the IPC→BNS statutory
 * change. The fix makes the annual series opt out of connecting (`connect: () => false`)
 * and the shared chart path builder must honour that opt-out. These tests exercise the
 * actual path-command decision (`lineCommands`) the component uses, not the caveat text.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { lineCommands } from '../src/utils/chartPath.ts';
import { isSupportedYear, DEFAULT_YEAR, SUPPORTED_YEARS } from '../src/config/scope.ts';

const connecting = commands => commands.filter(command => command === 'L').length;

test('annual cross-framework totals render as isolated points, never a connector', () => {
  // National annual recorded totals for 2021–2024 (authoritative current values).
  const annual = [2909532, 2808408, 2940460, 2740258];
  const commands = lineCommands(annual, () => false);
  assert.deepEqual(commands, ['M', 'M', 'M', 'M']);
  assert.equal(connecting(commands), 0, 'no unsupported 2023→2024 (or any) connector may be drawn');
});

test('a series with no opt-out still connects its adjacent non-null points', () => {
  assert.deepEqual(lineCommands([1, 2, 3]), ['M', 'L', 'L']);
  assert.deepEqual(lineCommands([1, 2, 3], () => true), ['M', 'L', 'L']);
});

test('a matched cohort connects only its own two adjacent endpoints', () => {
  const years = [2021, 2022, 2023, 2024];
  const fromYear = 2022, toYear = 2023;
  const connect = fromIndex => {
    const a = years.indexOf(fromYear), b = years.indexOf(toYear);
    return b === a + 1 && fromIndex === a;
  };
  // The 2022–2023 matched cohort totals sit only at their own two years.
  const values = [null, 2804254, 2892597, null];
  const commands = lineCommands(values, connect);
  assert.deepEqual(commands, [null, 'M', 'L', null]);
  assert.equal(connecting(commands), 1);
});

test('non-adjacent cohort endpoints are never bridged', () => {
  const years = [2021, 2022, 2023, 2024];
  const fromYear = 2021, toYear = 2024; // not adjacent, so connect is always false
  const connect = fromIndex => {
    const a = years.indexOf(fromYear), b = years.indexOf(toYear);
    return b === a + 1 && fromIndex === a;
  };
  const commands = lineCommands([2909532, null, null, 2740258], connect);
  assert.equal(connecting(commands), 0);
});

test('null values break the path instead of being interpolated across', () => {
  assert.deepEqual(lineCommands([5, null, 7], () => true), ['M', null, 'M']);
  assert.deepEqual(lineCommands([null, 7], () => true), [null, 'M']);
});

test('unsupported bookmark year (2020) is rejected by the scope guard', () => {
  assert.equal(isSupportedYear(2020), false);
  assert.equal(isSupportedYear(2021), true);
  assert.equal(isSupportedYear(2024), true);
  assert.deepEqual([...SUPPORTED_YEARS], [2021, 2022, 2023, 2024]);
  assert.equal(DEFAULT_YEAR, 2024);
});
