import { useState } from 'react';
import { PageTitle } from '../components/Layout';
import { Panel, Filters, Notice, ExportButton, Badge } from '../components/UI';
import { Lines, Bars, colors } from '../components/Charts';
import { DataTable } from '../components/DataTable';
import { useAnalytics } from '../context/useAnalytics';
import { number } from '../utils/format';
import { categoryLabel, roleFor, cleanCategoryName } from '../utils/categories';
import { getObservationIndex, observationAt } from '../utils/observationIndex';

type TrendMode = 'annual_totals' | 'comparable_cohorts' | 'single_region';

export default function TrendsPage() {
  const { data, filters } = useAnalytics();
  const [mode, setMode] = useState<TrendMode>('annual_totals');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');

  const observationIndex = getObservationIndex(data.observations);
  const labels = data.meta.years.map(String);
  const selectedCategoryLabel = filters.category === 'all' ? 'Official reported total' : categoryLabel(data, filters.category);

  // 1. Annual recorded totals mode
  const annualValues: (number | null)[] = labels.map(() => null);
  const annualDetail: any[] = [];
  for (const year of data.meta.years) {
    const category = filters.category === 'all'
      ? data.meta.categories?.find(c => c.years.includes(year) && roleFor(data, c.id, year) === 'official_total')?.id
      : (data.meta.categories?.some(c => c.id === filters.category && c.years.includes(year)) ? filters.category : null);

    const units = data.regions.filter(r => r.year === year && (filters.unitType === 'all' || r.regionType === filters.unitType) && (filters.state === 'all' || r.state === filters.state));
    const nums = units.map(r => observationAt(observationIndex, r.id, year, category ?? '')?.cases ?? null);
    const known = nums.filter(n => n !== null);
    const value = known.length ? known.reduce<number>((s, n) => s + (n ?? 0), 0) : null;
    const index = data.meta.years.indexOf(year);
    annualValues[index] = value;
    annualDetail.push({
      id: `annual-${year}`,
      period: `Annual · ${year}`,
      year,
      category: category ? categoryLabel(data, category) : 'Unavailable',
      units: units.length,
      candidateUnits: units.length,
      cases: value,
      framework: year <= 2023 ? 'IPC' : 'BNS',
      coverageNote: year === 2020 ? 'Andhra Pradesh only' : 'National 36 States/UTs'
    });
  }

  // 2. Connected pairwise comparison mode
  const pairs = (data.meta.comparisonPairs ?? []).filter(p => p.status === 'available');
  const pairSeries: { name: string; values: (number | null)[] }[] = [];
  const pairDetail: any[] = [];

  for (const pair of pairs) {
    const valueAt = (year: number) => filters.category === 'all'
      ? data.meta.categories?.find(c => c.years.includes(year) && roleFor(data, c.id, year) === 'official_total')?.id
      : (data.meta.categories?.some(c => c.id === filters.category && c.years.includes(year)) ? filters.category : null);

    const catA = valueAt(pair.fromYear), catB = valueAt(pair.toYear);
    if (!catA || !catB) continue;

    const a = data.regions.filter(r => r.year === pair.fromYear && r.cohortId?.startsWith(`${pair.id}:`) && (filters.unitType === 'all' || r.regionType === filters.unitType) && (filters.state === 'all' || r.state === filters.state));
    const b = new Map(data.regions.filter(r => r.year === pair.toYear && r.cohortId?.startsWith(`${pair.id}:`) && (filters.unitType === 'all' || r.regionType === filters.unitType) && (filters.state === 'all' || r.state === filters.state)).map(r => [r.cohortId!, r]));
    const candidates = a.filter(r => b.has(r.cohortId!));
    const usable = candidates.filter(r => {
      const other = b.get(r.cohortId!)!;
      return [[r, pair.fromYear, catA], [other, pair.toYear, catB]].every(([unit, year, cat]) => {
        const observation = observationAt(observationIndex, (unit as typeof r).id, year as number, cat as string);
        return observation?.cases !== null && observation !== undefined;
      });
    });

    const values: (number | null)[] = labels.map(() => null);
    let fromSum: number | null = null, toSum: number | null = null;
    for (const [year, cat] of [[pair.fromYear, catA], [pair.toYear, catB]] as const) {
      const index = data.meta.years.indexOf(year);
      const yearUnits = usable.map(r => year === pair.fromYear ? r : b.get(r.cohortId!)!);
      const nums = yearUnits.map(r => observationAt(observationIndex, r.id, year, cat)?.cases ?? null);
      const v = nums.length && nums.every(n => n !== null) ? nums.reduce<number>((s, n) => s + (n ?? 0), 0) : null;
      values[index] = v;
      if (year === pair.fromYear) fromSum = v;
      if (year === pair.toYear) toSum = v;
      pairDetail.push({
        id: `${pair.id}-${year}`,
        period: `${pair.fromYear}–${pair.toYear}`,
        year,
        category: categoryLabel(data, cat),
        units: usable.length,
        candidateUnits: candidates.length,
        cases: v,
        framework: 'IPC (Standardised)'
      });
    }
    const pctChange = fromSum !== null && toSum !== null && fromSum > 0
      ? (((toSum - fromSum) / fromSum) * 100).toFixed(1) + '%'
      : 'N/A';

    pairSeries.push({
      name: `${pair.fromYear}–${pair.toYear} · ${usable.length} matched units (${pctChange} change)`,
      values
    });
  }

  // 3. Single region history mode
  const eligibleRegions = [...new Map(data.regions.map(r => [`${r.state}|${r.name}`, r])).values()]
    .sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));

  const targetRegion = selectedRegionId
    ? eligibleRegions.find(r => `${r.state}|${r.name}` === selectedRegionId) || eligibleRegions[0]
    : eligibleRegions[0];

  const singleRegionValues: (number | null)[] = labels.map(() => null);
  const singleRegionDetail: any[] = [];
  if (targetRegion) {
    for (const year of data.meta.years) {
      const cat = filters.category === 'all'
        ? data.meta.categories?.find(c => c.years.includes(year) && roleFor(data, c.id, year) === 'official_total')?.id
        : (data.meta.categories?.some(c => c.id === filters.category && c.years.includes(year)) ? filters.category : null);

      const regInYear = data.regions.find(r => r.year === year && r.name === targetRegion.name && r.state === targetRegion.state);
      const obs = regInYear && cat ? observationAt(observationIndex, regInYear.id, year, cat) : null;
      const index = data.meta.years.indexOf(year);
      singleRegionValues[index] = obs?.cases ?? null;
      singleRegionDetail.push({
        id: `single-${targetRegion.name}-${year}`,
        year,
        region: targetRegion.name,
        state: targetRegion.state,
        category: cat ? categoryLabel(data, cat) : 'Unavailable',
        cases: obs?.cases ?? null,
        status: obs?.cases !== null && obs?.cases !== undefined ? 'Reported' : 'Not reported in source table',
        framework: year <= 2023 ? 'IPC' : 'BNS'
      });
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="ACROSS TIME"
        title="Yearly trends & comparability"
        description="Inspect recorded trends across years. Only source-verified geography and legal category cohorts are connected."
        action={
          <ExportButton
            rows={mode === 'annual_totals' ? annualDetail : mode === 'comparable_cohorts' ? pairDetail : singleRegionDetail}
            name={`trends_${mode}_${filters.year}`}
          />
        }
      />

      <Filters />

      {/* Mode Selector Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button
          type="button"
          className={`button ${mode === 'annual_totals' ? 'primary' : ''}`}
          onClick={() => setMode('annual_totals')}
        >
          1. Annual Recorded Totals
        </button>
        <button
          type="button"
          className={`button ${mode === 'comparable_cohorts' ? 'primary' : ''}`}
          onClick={() => setMode('comparable_cohorts')}
        >
          2. Verified Comparable Cohorts
        </button>
        <button
          type="button"
          className={`button ${mode === 'single_region' ? 'primary' : ''}`}
          onClick={() => setMode('single_region')}
        >
          3. Single-Region History
        </button>
      </div>

      {mode === 'annual_totals' && (
        <>
          <Panel
            title="Annual recorded crime volume"
            subtitle={`${selectedCategoryLabel} · sum of reporting units with valid records in each year.`}
          >
            <Lines
              labels={labels}
              series={[{ name: `Annual totals · ${selectedCategoryLabel}`, values: annualValues }]}
              unit="cases"
            />
            <p className="panel-note">
              Annual totals represent the sum of all reporting units available in each source publication. 2020 covers Andhra Pradesh only; 2021–2024 cover 36 states/UTs.
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
                { key: 'coverageNote', label: 'Geographic Scope' },
                { key: 'units', label: 'Reporting units' },
                { key: 'category', label: 'Category evaluated' },
                {
                  key: 'cases',
                  label: 'Recorded cases',
                  render: r => number(r.cases as number | null)
                }
              ]}
            />
          </Panel>
        </>
      )}

      {mode === 'comparable_cohorts' && (
        <>
          {pairSeries.length > 0 ? (
            <Panel
              title="Verified comparable cohorts (matched geography & category)"
              subtitle="Units present in both years with identical legal definitions. Cohorts are bounded and never interpolated."
            >
              <Lines labels={labels} series={pairSeries} unit="cases" />
              <p className="panel-note">
                Connected lines show strictly matched units that existed in both years with unchanged administrative boundaries and identical category definitions.
              </p>
            </Panel>
          ) : (
            <div className="empty">
              <h2>No pairwise cohort available for this selection</h2>
              <p>
                {filters.state === 'all'
                  ? 'At national scope, 2020–2021 is unavailable because 2020 covers Andhra Pradesh only. Select Andhra Pradesh to view the verified 2020–2021 cohort.'
                  : 'No verified stable cohort was found for this specific state/category combination.'}
              </p>
            </div>
          )}

          <Panel title="Cohort verification register">
            <DataTable
              searchable={false}
              rows={pairDetail}
              columns={[
                { key: 'period', label: 'Comparison Period' },
                { key: 'year', label: 'Year' },
                { key: 'category', label: 'Category' },
                { key: 'units', label: 'Matched units' },
                { key: 'candidateUnits', label: 'Eligible candidates' },
                {
                  key: 'cases',
                  label: 'Cohort cases',
                  render: r => number(r.cases as number | null)
                }
              ]}
            />
          </Panel>
        </>
      )}

      {mode === 'single_region' && (
        <>
          <Panel
            title="Single-region historical trajectory"
            subtitle="Explore available recorded history for a specific reporting unit."
          >
            <div style={{ marginBottom: '1rem', maxWidth: '420px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                Select reporting unit:
              </label>
              <select
                value={selectedRegionId || `${targetRegion?.state}|${targetRegion?.name}`}
                onChange={e => setSelectedRegionId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem' }}
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
                  series={[{ name: `${targetRegion.name} (${targetRegion.state}) · ${selectedCategoryLabel}`, values: singleRegionValues }]}
                  unit="cases"
                />
                <p className="panel-note">
                  Trajectory indicates recorded counts for this reporting unit. Note the legal transition from IPC to BNS between 2023 and 2024.
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
        <strong>Comparability boundaries:</strong> 2020 covers Andhra Pradesh only; 2021–2022 includes district reorganization in Andhra Pradesh; 2022–2023 has 749 matched administrative districts under IPC; 2023–2024 transitions to the Bharatiya Nyaya Sanhita (BNS) framework.
      </Notice>
    </>
  );
}
