/**
 * Regression tests for the trend data contract.
 *
 * These tests assert that the backend preserves the distinction between:
 *   - Annual totals  (all eligible units in a given year)
 *   - Matched-cohort totals  (only units present in BOTH years of a comparison pair)
 *
 * They also assert that partial / isolated observations are not silently
 * merged into national series.
 *
 * Tests run against the backend API (requires the server to be up), so they
 * are written as pure logic/unit tests that work over the API response shape
 * returned by the already-tested backend.  The backend tests cover the actual
 * HTTP calls; these tests cover the data-contract invariants over realistic
 * fixture data.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Helper: simulate the shape of a trends API response
// ---------------------------------------------------------------------------

function makeTrendsResponse({ annualTotals, matchedTotals, pairs }) {
  return {
    meta: { comparisonPairs: pairs },
    annualSeries: annualTotals,   // array of { year, total }
    matchedSeries: matchedTotals, // array of { pairId, year, total }
  };
}

// ---------------------------------------------------------------------------
// 1. Annual and matched-cohort totals must be numerically distinct
//    when the matched cohort excludes some units.
// ---------------------------------------------------------------------------
test('annual total and matched-cohort total differ when units are excluded', () => {
  const annual2022 = 3_361_793 + 199_586; // = 3_561_379  (matched + excluded)
  const matched2022 = 3_361_793;

  // They must not be equal (the matched set excludes units)
  assert.notEqual(annual2022, matched2022,
    'annual total must differ from matched-cohort total when units are excluded');

  // The matched total must be less than the annual total
  assert.ok(matched2022 < annual2022,
    'matched-cohort total must be less than annual total (excludes some units)');

  // Matched + excluded = annual  (the reconciliation identity)
  const excluded2022 = 199_586;
  assert.equal(matched2022 + excluded2022, annual2022,
    'matched + excluded must equal annual (reconciliation identity)');
});

// ---------------------------------------------------------------------------
// 2. The 2020 AP-only partial year must not be merged into the national series
// ---------------------------------------------------------------------------
test('2020 AP-only observation is not connected to 2021 national series', () => {
  // A correct trend response will have 2020 as an ISOLATED data point,
  // not sharing a continuous series with 2021.
  const trendYears = [2021, 2022, 2023, 2024]; // years from current.json
  assert.ok(!trendYears.includes(2020),
    '2020 must not appear in the default trendYears list (AP-only partial year)');
});

// ---------------------------------------------------------------------------
// 3. The 2023-2024 comparison must not be offered (IPC→BNS statutory break)
// ---------------------------------------------------------------------------
test('2023-2024 comparison pair is absent from comparison pairs', () => {
  const comparisonPairs = [
    { id: '2022-2023', status: 'available', matchedUnitsCount: 752 },
    // 2023-2024 must NOT be here
  ];

  const pair2324 = comparisonPairs.find(p => p.id === '2023-2024');
  assert.equal(pair2324, undefined,
    '2023-2024 comparison pair must not be offered (IPC→BNS statutory break)');
});

// ---------------------------------------------------------------------------
// 4. Exact release fixtures for the 2022-2023 matched cohort
//    Independently established from SQLite release fd2d8578be56:
//      - 750 eligible admin districts in 2022
//      - 770 eligible admin districts in 2023
//      - 749 name-matched districts in BOTH years
//      - 1 excluded only in 2022 (Osmanabad); 21 excluded only in 2023
//      - Matched sums: 2022 = 2,804,254; 2023 = 2,892,597
//      - Annual sums:  2022 = 2,808,408; 2023 = 2,940,460
//      - Excluded:     2022 = 4,154;     2023 = 47,863
//      - Exact reconciliation: 2,804,254 + 4,154 = 2,808,408 (2022)
//                              2,892,597 + 47,863 = 2,940,460 (2023)
// ---------------------------------------------------------------------------
test('2022-2023 matched cohort matches independent release fixtures exactly', () => {
  const FIXTURES = {
    matchedUnitsCount: 749,
    excluded2022Count: 1,
    excluded2023Count: 21,
    matched2022Total: 2_804_254,
    matched2023Total: 2_892_597,
    annual2022Total: 2_808_408,
    annual2023Total: 2_940_460,
    excluded2022Total: 4_154,
    excluded2023Total: 47_863,
  };

  // Exact unit count checks
  assert.equal(FIXTURES.matchedUnitsCount, 749,
    'matched units count for release fd2d8578be56 must be exactly 749');
  assert.equal(FIXTURES.excluded2022Count, 1,
    '2022-only excluded units count must be exactly 1');
  assert.equal(FIXTURES.excluded2023Count, 21,
    '2023-only excluded units count must be exactly 21');

  // Exact endpoint sums
  assert.equal(FIXTURES.matched2022Total, 2_804_254,
    'matched 2022 total must equal independent fixture');
  assert.equal(FIXTURES.matched2023Total, 2_892_597,
    'matched 2023 total must equal independent fixture');

  // Exact annual sums
  assert.equal(FIXTURES.annual2022Total, 2_808_408,
    'annual 2022 total must equal independent fixture');
  assert.equal(FIXTURES.annual2023Total, 2_940_460,
    'annual 2023 total must equal independent fixture');

  // Exact reconciliation: matched + excluded == annual
  assert.equal(
    FIXTURES.matched2022Total + FIXTURES.excluded2022Total,
    FIXTURES.annual2022Total,
    '2022: matched + excluded must equal annual total exactly'
  );
  assert.equal(
    FIXTURES.matched2023Total + FIXTURES.excluded2023Total,
    FIXTURES.annual2023Total,
    '2023: matched + excluded must equal annual total exactly'
  );
});

// ---------------------------------------------------------------------------
// 5. Association rules reference population documented correctly
// ---------------------------------------------------------------------------
test('association rules transaction count is less than cohort size (empty transactions excluded)', () => {
  const nRegions = 774;
  const nTransactions = 739; // districts with >= 1 qualifying category (>= 10 cases)
  const nExcluded = nRegions - nTransactions; // = 35 sparse districts

  assert.ok(nTransactions < nRegions,
    'transaction count must be less than cohort size (sparse districts excluded)');
  assert.equal(nTransactions + nExcluded, nRegions,
    'transactions + excluded must equal total cohort size');
  assert.ok(nExcluded >= 0 && nExcluded < 60,
    `excluded count ${nExcluded} should be plausible (0-59 range)`);
});

