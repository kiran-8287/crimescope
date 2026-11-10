import { useState } from 'react';
import { PageTitle } from '../components/Layout';
import { Panel, Filters, Notice, ExportButton, Badge, Stat } from '../components/UI';
import { Lines, AnnualBars, type AnnualBarDatum, type Series } from '../components/Charts';
import { DataTable } from '../components/DataTable';
import { useAnalytics } from '../context/useAnalytics';
import { number } from '../utils/format';
import { categoryLabel, roleFor, rawCategoryLabel } from '../utils/categories';
import { getObservationIndex, observationAt } from '../utils/observationIndex';

type TrendMode = 'annual_totals' | 'name_matched' | 'single_region';

// Two-decimal precision is required for the key 2022–2023 findings. The sign is
// rendered once so a value can never display with a double sign.
const pct = (value: number | null) =>
  value === null || !Number.isFinite(value) ? 'Not available' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

type KeyFinding = {
  matchedUnits: number;
  excludedFrom: number;
  excludedTo: number;
  annualUnitsFrom: number;
  annualUnitsTo: number;
  fromMatched: number | null;
  toMatched: number | null;
  fromAnnual: number | null;
  toAnnual: number | null;
  fromExcludedCases: number | null;
  toExcludedCases: number | null;
  matchedChange: number | null;
  annualChange: number | null;
};

export default function TrendsPage() {
  const { data, filters } = useAnalytics();
  const [mode, setMode] = useState<TrendMode>('annual_totals');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');

  const observationIndex = getObservationIndex(data.observations);
  const labels = data.meta.years.map(String);
  const selectedCategoryLabel = filters.category === 'all' ? 'Official reported total' : categoryLabel(data, filters.category);

  const inScope = (regionType?: string, state?: string) =>
    (filters.unitType === 'all' || regionType === filters.unitType) &&
    (filters.state === 'all' || state === filters.state);

  // Resolve the official-total id (default) or the selected category id for a given year.
  const categoryForYear = (year: number): string | null => {
    if (filters.category === 'all') {
      return data.meta.categories?.find(c => c.years.includes(year) && roleFor(data, c.id, year) === 'official_total')?.id ?? null;
    }
    return data.meta.categories?.some(c => c.id === filters.category && c.years.includes(year)) ? filters.category : null;
  };

  const sumCases = (regions: typeof data.regions, year: number, category: string | null): number | null => {
    if (!category) return null;
    const nums = regions.map(r => observationAt(observationIndex, r.id, year, category)?.cases ?? null);
    const known = nums.filter((n): n is number => n !== null);
    return known.length ? known.reduce((s, n) => s + n, 0) : null;
  };

  // 1. Annual recorded totals mode — standalone per-year totals shown as separate
  // bars from a shared zero baseline. They are never joined, because 2023 uses IPC
  // and 2024 uses BNS and no matched cohort connects them.
  const annualDetail: any[] = [];
  for (const year of data.meta.years) {
    const category = categoryForYear(year);
    const units = data.regions.filter(r => r.year === year && inScope(r.regionType, r.state));
    const value = sumCases(units, year, category);
    annualDetail.push({
      id: `annual-${year}`,
      period: `Annual · ${year}`,
      year,
      category_id: category ?? '',
      category_source_label: category ? rawCategoryLabel(data, category) : '',
      category: category ? categoryLabel(data, category) : 'Unavailable',
      units: units.length,
      cases: value,
      framework: year <= 2023 ? 'IPC' : 'BNS',
      geographic_scope: filters.state === 'all' ? 'National · 36 States/UTs' : filters.state,
      release: data.meta.releaseId
    });
  }

  // The 2024 bar follows the IPC → BNS change; the chart marks that boundary so
  // the last two years are not read as a continuous, comparable series.
  const frameworkBreak = data.meta.years.indexOf(2023);

  const annualBars: AnnualBarDatum[] = annualDetail.map(d => ({
    label: String(d.year),
    value: d.cases,
    units: d.units,
    framework: d.framework
  }));

  // 2. Name-matched cohort mode. Only the 2022–2023 pair is available; the join is
  // an operational jurisdiction-name match, so the matched series is joined only
  // between its own two adjacent years.
  const pairs = (data.meta.comparisonPairs ?? []).filter(p => p.status === 'available');
  const pairSeries: Series[] = [];
  const reconciliationRows: any[] = [];
  let keyFinding: KeyFinding | null = null;

  for (const pair of pairs) {
    const catA = categoryForYear(pair.fromYear);
    const catB = categoryForYear(pair.toYear);
    if (!catA || !catB) continue;

    const cohortPrefix = `${pair.id}:`;
    const yearScope = (year: number) => data.regions.filter(r => r.year === year && inScope(r.regionType, r.state));

    const fromRegions = yearScope(pair.fromYear);
    const toRegions = yearScope(pair.toYear);
    const fromMatchedRegions = fromRegions.filter(r => r.cohortId?.startsWith(cohortPrefix));
    const toMatchedRegions = toRegions.filter(r => r.cohortId?.startsWith(cohortPrefix));
    const fromExcludedRegions = fromRegions.filter(r => !r.cohortId?.startsWith(cohortPrefix));
    const toExcludedRegions = toRegions.filter(r => !r.cohortId?.startsWith(cohortPrefix));

    const fromMatchedCases = sumCases(fromMatchedRegions, pair.fromYear, catA);
    const toMatchedCases = sumCases(toMatchedRegions, pair.toYear, catB);
    const fromAnnualCases = sumCases(fromRegions, pair.fromYear, catA);
    const toAnnualCases = sumCases(toRegions, pair.toYear, catB);
    const fromExcludedCases = fromAnnualCases !== null && fromMatchedCases !== null ? fromAnnualCases - fromMatchedCases : null;
    const toExcludedCases = toAnnualCases !== null && toMatchedCases !== null ? toAnnualCases - toMatchedCases : null;

    const matchedChange = fromMatchedCases !== null && toMatchedCases !== null && fromMatchedCases > 0
      ? ((toMatchedCases - fromMatchedCases) / fromMatchedCases) * 100 : null;
    const annualChange = fromAnnualCases !== null && toAnnualCases !== null && fromAnnualCases > 0
      ? ((toAnnualCases - fromAnnualCases) / fromAnnualCases) * 100 : null;

    const values: (number | null)[] = labels.map(() => null);
    values[data.meta.years.indexOf(pair.fromYear)] = fromMatchedCases;
    values[data.meta.years.indexOf(pair.toYear)] = toMatchedCases;

    pairSeries.push({
      name: `Name-matched ${pair.fromYear}–${pair.toYear} cohort · ${fromMatchedRegions.length} units (${pct(matchedChange)} matched change)`,
      values,
      connect: (fromIndex: number) => {
        const a = data.meta.years.indexOf(pair.fromYear);
        const b = data.meta.years.indexOf(pair.toYear);
        return b === a + 1 && fromIndex === a;
      }
    });

    const rowFor = (
      year: number,
      cat: string,
      annualUnits: number,
      matchedUnits: number,
      excludedUnits: number,
      annualCases: number | null,
      matchedCases: number | null,
      excludedCases: number | null
    ) => ({
      id: `${pair.id}-${year}`,
      period: `${pair.fromYear}–${pair.toYear}`,
      year,
      category_id: cat,
      category_source_label: rawCategoryLabel(data, cat),
      category: categoryLabel(data, cat),
      framework: year <= 2023 ? 'IPC' : 'BNS',
      annual_units: annualUnits,
      matched_units: matchedUnits,
      excluded_units: excludedUnits,
      annual_cases: annualCases,
      matched_cases: matchedCases,
      excluded_cases: excludedCases,
      matched_change_pct: matchedChange,
      annual_change_pct: annualChange,
      release: data.meta.releaseId
    });

    reconciliationRows.push(
      rowFor(pair.fromYear, catA, fromRegions.length, fromMatchedRegions.length, fromExcludedRegions.length, fromAnnualCases, fromMatchedCases, fromExcludedCases),
      rowFor(pair.toYear, catB, toRegions.length, toMatchedRegions.length, toExcludedRegions.length, toAnnualCases, toMatchedCases, toExcludedCases)
    );

    if (pair.fromYear === 2022 && pair.toYear === 2023) {
      keyFinding = {
        matchedUnits: fromMatchedRegions.length,
        excludedFrom: fromExcludedRegions.length,
        excludedTo: toExcludedRegions.length,
        annualUnitsFrom: fromRegions.length,
        annualUnitsTo: toRegions.length,
        fromMatched: fromMatchedCases,
        toMatched: toMatchedCases,
        fromAnnual: fromAnnualCases,
        toAnnual: toAnnualCases,
        fromExcludedCases,
        toExcludedCases,
        matchedChange,
        annualChange
      };
    }
  }

  // Exact change quantities for the matched cohort. The signed delta is derived
  // from the two full-precision totals so the callout can never disagree with the
  // chart; the gap between the two change measures is stated in percentage points
  // and is explicitly non-causal.
  const matchedDelta = keyFinding && keyFinding.fromMatched !== null && keyFinding.toMatched !== null
    ? keyFinding.toMatched - keyFinding.fromMatched
    : null;
  const changeGap = keyFinding && keyFinding.matchedChange !== null && keyFinding.annualChange !== null
    ? Math.abs(keyFinding.annualChange - keyFinding.matchedChange)
    : null;

  // 3. Single-region history mode
  const eligibleRegions = [...new Map(data.regions.map(r => [`${r.state}|${r.name}`, r])).values()]
    .sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));

  const targetRegion = selectedRegionId
    ? eligibleRegions.find(r => `${r.state}|${r.name}` === selectedRegionId) || eligibleRegions[0]
    : eligibleRegions[0];

  const singleRegionValues: (number | null)[] = labels.map(() => null);
  const singleRegionDetail: any[] = [];
  if (targetRegion) {
    for (const year of data.meta.years) {
      const cat = categoryForYear(year);
      const regInYear = data.regions.find(r => r.year === year && r.name === targetRegion.name && r.state === targetRegion.state);
      const obs = regInYear && cat ? observationAt(observationIndex, regInYear.id, year, cat) : undefined;
      const index = data.meta.years.indexOf(year);
      singleRegionValues[index] = obs ? obs.cases : null;

      // Absence (no cell, or the category not defined that year) is kept distinct
      // from a genuine reported zero.
      const status = !cat
        ? 'Category not defined this year'
        : !regInYear
          ? 'Unit not present in this year'
          : obs === undefined
            ? 'No source cell (absent, not zero)'
            : obs.cases === null
              ? 'Missing value (null, not zero)'
              : obs.cases === 0
                ? 'Reported as an explicit zero'
                : 'Reported';

      singleRegionDetail.push({
        id: `single-${targetRegion.name}-${year}`,
        year,
        region: targetRegion.name,
        state: targetRegion.state,
        category_id: cat ?? '',
        category_source_label: cat ? rawCategoryLabel(data, cat) : '',
        category: cat ? categoryLabel(data, cat) : 'Unavailable',
        cases: obs ? obs.cases : null,
        status,
        framework: year <= 2023 ? 'IPC' : 'BNS',
        release: data.meta.releaseId
      });
    }
  }

  const exportRows = mode === 'annual_totals' ? annualDetail : mode === 'name_matched' ? reconciliationRows : singleRegionDetail;

  return (
    <>
      <PageTitle
        eyebrow="ACROSS TIME"
        title="Yearly trends & comparability"
        description="Annual recorded totals are shown as separate bars from a zero baseline. Only the source-verified 2022–2023 name-matched cohort is compared as a fixed set, and only between its own two years."
        action={<ExportButton rows={exportRows} name={`trends_${mode}_${filters.year}`} />}
      />

      <Filters />

      {/* Mode Selector Tabs */}
      <div className="tabs" role="tablist" aria-label="Trend view" style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'annual_totals'}
          className={mode === 'annual_totals' ? 'active' : ''}
          onClick={() => setMode('annual_totals')}
        >
          1. Annual recorded totals
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'name_matched'}
          className={mode === 'name_matched' ? 'active' : ''}
          onClick={() => setMode('name_matched')}
        >
          2. Name-matched cohorts
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'single_region'}
          className={mode === 'single_region' ? 'active' : ''}
          onClick={() => setMode('single_region')}
        >
          3. Single-region history
        </button>
      </div>

      {mode === 'annual_totals' && (
        <>
          <Panel
            title="Reported cases by year"
            subtitle={`${selectedCategoryLabel} · sum of reporting units with valid records in each year. Each bar is a separate annual snapshot; the years are not connected.`}
          >
            <AnnualBars
              bars={annualBars}
              unit="cases"
              height={320}
              breakAfterIndex={frameworkBreak}
              breakLabel="2024 framework change"
              ariaLabel="Annual reported cases by year with a zero baseline. Each bar is a separate annual snapshot for the units eligible that year."
            />
            <p className="panel-note">
              Each year is an independent, standalone total from its own source publication and its own set of eligible units
              ({annualDetail.map(d => `${d.year}: ${d.units} units`).join(', ')}). The bars are deliberately not connected: 2023 is
              reported under the IPC and 2024 under the BNS, and no matched cohort supports a 2023–2024 change figure.
              {filters.state === 'all' ? ' Coverage: national, 36 States/UTs.' : ` Coverage: ${filters.state}.`}
            </p>
          </Panel>

          <Panel title="Annual observations and source coverage">
            <DataTable
              searchable={false}
              rows={annualDetail}
              columns={[
                { key: 'year', label: 'Year' },
                {
                  key: 'framework',
                  label: 'Law Framework',
                  render: r => <Badge tone={r.framework === 'IPC' ? 'neutral' : 'amber'}>{String(r.framework)}</Badge>
                },
                { key: 'geographic_scope', label: 'Geographic Scope' },
                { key: 'units', label: 'Reporting units' },
                { key: 'category', label: 'Category evaluated' },
                {
                  key: 'cases',
                  label: 'Recorded cases',
                  render: r => number(r.cases as number | null)
                }
              ]}
            />
            <p className="panel-note">
              “Reporting units” is the count of eligible units of the selected type in that year — the coverage of each annual snapshot,
              not a fixed panel. It is also carried into the CSV export so the exported value and denominator always match this table.
            </p>
          </Panel>
        </>
      )}

      {mode === 'name_matched' && (
        <>
          {pairSeries.length > 0 ? (
            <>
              {keyFinding && (
                <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <Stat
                    label="Name-matched units (2022–2023)"
                    value={number(keyFinding.matchedUnits)}
                    detail="Units whose jurisdiction names match in both years"
                  />
                  <Stat
                    label="Matched cases (2022 → 2023)"
                    value={`${number(keyFinding.fromMatched)} → ${number(keyFinding.toMatched)}`}
                    detail="Reported cases for the same named units"
                  />
                  <Stat
                    label="Excluded units (2022 / 2023)"
                    value={`${keyFinding.excludedFrom} / ${keyFinding.excludedTo}`}
                    detail="Units without a name match, omitted from the cohort"
                  />
                </div>
              )}

              <Panel
                title="The same named units in 2022 and 2023"
                subtitle={`${keyFinding?.matchedUnits ?? 0} jurisdiction names appear in both years. Both bars rise from a shared zero baseline, so the change is shown at true scale relative to the level.`}
              >
                <AnnualBars
                  bars={[
                    { label: '2022', value: keyFinding?.fromMatched ?? null, units: keyFinding?.matchedUnits, framework: 'IPC' },
                    { label: '2023', value: keyFinding?.toMatched ?? null, units: keyFinding?.matchedUnits, framework: 'IPC' }
                  ]}
                  unit="cases"
                  height={290}
                  callout={matchedDelta !== null && keyFinding?.fromMatched != null && keyFinding?.toMatched != null
                    ? `Same ${keyFinding.matchedUnits} named units in both years: ${number(keyFinding.fromMatched)} → ${number(keyFinding.toMatched)} matched cases, a change of ${matchedDelta >= 0 ? '+' : ''}${number(matchedDelta)} cases (${pct(keyFinding.matchedChange)}). Because the bars share one zero baseline, the difference reads honestly as small next to the volume.`
                    : 'Matched-cohort totals are unavailable for this selection.'}
                  ariaLabel={`Matched-cohort reported cases for the same ${keyFinding?.matchedUnits ?? 0} named units in 2022 and 2023, drawn from a zero baseline.`}
                />

                <div className="change-compare" style={{ marginTop: '1rem' }}>
                  <article>
                    <span className="eyebrow">Annual unit sets</span>
                    <strong>{pct(keyFinding?.annualChange ?? null)}</strong>
                    <p>
                      Every eligible unit in each year ({keyFinding?.annualUnitsFrom ?? 0} units in 2022 → {keyFinding?.annualUnitsTo ?? 0} in 2023):
                      {' '}{number(keyFinding?.fromAnnual ?? null)} → {number(keyFinding?.toAnnual ?? null)} annual cases. The two years use different
                      unit sets, so this compares two annual snapshots rather than a fixed panel.
                    </p>
                  </article>
                  <article>
                    <span className="eyebrow">Name-matched cohort</span>
                    <strong>{pct(keyFinding?.matchedChange ?? null)}</strong>
                    <p>
                      The same {keyFinding?.matchedUnits ?? 0} named units in both years: {number(keyFinding?.fromMatched ?? null)} → {number(keyFinding?.toMatched ?? null)} matched cases.
                      Membership is an operational name match, which does not establish unchanged administrative boundaries, population or coding practice.
                    </p>
                  </article>
                </div>

                <p className="panel-note">
                  These are two distinct change measures with different denominators: the annual change ({pct(keyFinding?.annualChange ?? null)}) uses the full
                  2022 annual total for the eligible unit set ({keyFinding?.annualUnitsFrom ?? 0} → {keyFinding?.annualUnitsTo ?? 0} units), while the matched
                  change ({pct(keyFinding?.matchedChange ?? null)}) uses the {keyFinding?.matchedUnits ?? 0}-unit name-matched 2022 total
                  ({keyFinding?.matchedUnits ?? 0} → {keyFinding?.matchedUnits ?? 0} units). Name matching controls which units are compared; it does not
                  establish unchanged boundaries, populations or coding practice.
                  {changeGap !== null && <> The {changeGap.toFixed(2)} pp difference between the two measures is not evidence that name matching caused the difference, and neither figure is a causal estimate.</>}
                </p>
              </Panel>
            </>
          ) : (
            <div className="empty">
              <h2>No name-matched cohort available for this selection</h2>
              <p>
                {filters.state === 'all'
                  ? 'No name-matched cohort is available for this national selection. Only the 2022–2023 period has a name-matched jurisdiction cohort.'
                  : 'No name-matched cohort was found for this specific state/category combination.'}
              </p>
            </div>
          )}

          <details className="details" open>
            <summary>Reconciliation: annual = matched + excluded, for each year</summary>
            <DataTable
              searchable={false}
              rows={reconciliationRows}
              columns={[
                { key: 'period', label: 'Comparison Period' },
                { key: 'year', label: 'Year' },
                {
                  key: 'framework',
                  label: 'Framework',
                  render: r => <Badge tone={r.framework === 'IPC' ? 'neutral' : 'amber'}>{String(r.framework)}</Badge>
                },
                { key: 'annual_units', label: 'Annual units' },
                { key: 'matched_units', label: 'Matched units' },
                { key: 'excluded_units', label: 'Excluded units' },
                { key: 'annual_cases', label: 'Annual cases', render: r => number(r.annual_cases as number | null) },
                { key: 'matched_cases', label: 'Matched cases', render: r => number(r.matched_cases as number | null) },
                { key: 'excluded_cases', label: 'Excluded cases', render: r => number(r.excluded_cases as number | null) }
              ]}
            />
            <p className="panel-note">
              The reconciliation identity holds for each year: annual cases = matched cases + excluded cases (and annual units = matched units + excluded units).
              {' '}2022 — {keyFinding?.excludedFrom ?? 0} excluded unit / {number(keyFinding?.fromExcludedCases ?? null)} cases; 2023 — {keyFinding?.excludedTo ?? 0} excluded units / {number(keyFinding?.toExcludedCases ?? null)} cases.
              {' '}“Matched units” is the name-matched subset, not the full annual candidate pool, so it is intentionally smaller than the annual unit count —
              the remainder is the excluded set.
            </p>
          </details>
        </>
      )}

      {mode === 'single_region' && (
        <>
          <Panel
            title="Single-region historical trajectory"
            subtitle="Explore the recorded history of one named reporting unit. Points are isolated — a shared name across years is not treated as proof of a stable unit."
          >
            <div style={{ marginBottom: '1rem', maxWidth: '420px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Select reporting unit:
              </label>
              <select
                value={selectedRegionId || `${targetRegion?.state}|${targetRegion?.name}`}
                onChange={e => setSelectedRegionId(e.target.value)}
                style={{ width: '100%' }}
              >
                {eligibleRegions.map(r => (
                  <option key={`${r.state}|${r.name}`} value={`${r.state}|${r.name}`}>
                    {r.name} ({r.state}) · {r.regionType?.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {targetRegion && (
              <>
                <Lines
                  labels={labels}
                  series={[{ name: `${targetRegion.name} (${targetRegion.state}) · ${selectedCategoryLabel}`, values: singleRegionValues, connect: () => false }]}
                  unit="cases"
                />
                <p className="panel-note">
                  Points are drawn independently. This unit is tracked by jurisdiction name across years, so a matching name does not by itself
                  establish unchanged boundaries, an identical reporting scope, or a comparable category. The unit is also not joined across the
                  2023–2024 IPC→BNS transition. Absent years and explicit zeros are labelled separately in the table below.
                </p>
              </>
            )}
          </Panel>

          <Panel title={`${targetRegion?.name ?? 'Region'} annual record history`}>
            <DataTable
              searchable={false}
              rows={singleRegionDetail}
              columns={[
                { key: 'year', label: 'Year' },
                {
                  key: 'framework',
                  label: 'Framework',
                  render: r => <Badge tone={r.framework === 'IPC' ? 'neutral' : 'amber'}>{String(r.framework)}</Badge>
                },
                { key: 'category', label: 'Category' },
                {
                  key: 'cases',
                  label: 'Reported cases',
                  render: r => number(r.cases as number | null)
                },
                {
                  key: 'status',
                  label: 'Availability',
                  render: r => (
                    <Badge tone={r.cases !== null ? 'green' : 'amber'}>
                      {String(r.status)}
                    </Badge>
                  )
                }
              ]}
            />
          </Panel>
        </>
      )}

      <Notice>
        <strong>Comparability boundaries:</strong> Annual totals are shown as separate bars and the 2023–2024 legal-framework break is marked,
        so the last two years are never read as a continuous series. Only the 2022–2023 name-matched cohort is compared as a fixed set, and
        only between its own two years. 2021–2022 includes district reorganisation in Andhra Pradesh.
      </Notice>

      <details className="details">
        <summary>Methodology &amp; context</summary>
        <ul className="notes">
          <li>
            <strong>Name matching, not verified boundaries.</strong> Cohort membership is decided by an operational jurisdiction-name match
            (state + unit name). It controls which units are compared; it does not verify unchanged administrative boundaries, populations or
            coding practice.
          </li>
          <li>
            <strong>Legal-framework break (2023–2024).</strong> 2023 records are reported under the IPC and 2024 under the BNS. Because the
            two frameworks are not equivalent, no 2023–2024 percent-change is claimed and the annual series is not connected across that year.
          </li>
          <li>
            <strong>Archived 2020 slice.</strong> A partial 2020 Andhra Pradesh-only source table is preserved in the archive but excluded
            from the active 2021–2024 scope. A request for an unsupported year (for example <code>?year=2020</code>) is normalised to the active
            default and the API rejects unsupported years; the 2020 slice is never merged into these charts.
          </li>
        </ul>
      </details>
    </>
  );
}
