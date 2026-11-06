import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BarChart2, Eye } from 'lucide-react';
import { PageTitle } from '../components/Layout';
import { Panel, Filters, Stat, Notice, Badge, UnitTypeBadge, ExportButton, RegionDetailDrawer } from '../components/UI';
import { Lines, Bars, colors } from '../components/Charts';
import { DataTable } from '../components/DataTable';
import { useAnalytics } from '../context/useAnalytics';
import { number } from '../utils/format';
import { categoryLabel, roleFor, cleanCategoryName } from '../utils/categories';
import { getObservationIndex, observationAt } from '../utils/observationIndex';

export default function OverviewPage() {
  const navigate = useNavigate();
  const { data, filters, total, rows, annual, categories, knownUnits, officialTotalId } = useAnalytics();
  const [selectedDrawerRegion, setSelectedDrawerRegion] = useState<string | null>(null);
  const [selectedDrawerState, setSelectedDrawerState] = useState<string | undefined>(undefined);

  const observationIndex = getObservationIndex(data.observations);
  const labels = data.meta.years.map(String);
  const pairs = data.meta.comparisonPairs?.filter(p => p.status === 'available') ?? [];
  const selectedLabel = filters.category === 'all' ? 'Official reported total' : categoryLabel(data, filters.category);

  // Annual recorded totals series for all available years
  // CRITICAL COMPARABILITY SAFEGUARD: 2020 is partial Andhra Pradesh only.
  // When filters.state === 'all', 2020 must NOT be plotted on the same continuous line
  // as the 2021–2024 national observations.
  const nationalAnnualSeriesValues: (number | null)[] = labels.map(() => null);
  const ap2020StandaloneSeriesValues: (number | null)[] = labels.map(() => null);

  for (const year of data.meta.years) {
    const categoryAtYear = filters.category === 'all'
      ? data.meta.categories?.find(c => c.years.includes(year) && roleFor(data, c.id, year) === 'official_total')?.id
      : (data.meta.categories?.some(c => c.id === filters.category && c.years.includes(year)) ? filters.category : null);

    const yearUnits = data.regions.filter(r => r.year === year && (filters.unitType === 'all' || r.regionType === filters.unitType) && (filters.state === 'all' || r.state === filters.state));
    const nums = yearUnits.map(r => observationAt(observationIndex, r.id, year, categoryAtYear ?? '')?.cases ?? null);
    const known = nums.filter(n => n !== null);
    const sum = known.length ? known.reduce<number>((a, b) => a + (b ?? 0), 0) : null;

    const yearIdx = data.meta.years.indexOf(year);
    if (year === 2020 && filters.state === 'all') {
      // Isolate 2020 AP-only point so it does NOT connect to 2021 national total
      ap2020StandaloneSeriesValues[yearIdx] = sum;
    } else {
      nationalAnnualSeriesValues[yearIdx] = sum;
    }
  }

  // Connected pairwise comparison series for verified stable cohorts
  const totalSeries = pairs.map(pair => {
    const values: (number | null)[] = data.meta.years.map(() => null);
    const categoryAt = (year: number) => filters.category === 'all'
      ? data.meta.categories?.find(c => c.years.includes(year) && roleFor(data, c.id, year) === 'official_total')?.id
      : filters.category;
    const fromCategory = categoryAt(pair.fromYear), toCategory = categoryAt(pair.toYear);
    if (!fromCategory || !toCategory) return { name: `${pair.fromYear}–${pair.toYear} cohort (unavailable)`, values };

    const fromRegions = data.regions.filter(r => r.year === pair.fromYear && r.cohortId?.startsWith(`${pair.id}:`) && (filters.unitType === 'all' || r.regionType === filters.unitType) && (filters.state === 'all' || r.state === filters.state));
    const toIds = new Set(data.regions.filter(r => r.year === pair.toYear && r.cohortId?.startsWith(`${pair.id}:`) && (filters.unitType === 'all' || r.regionType === filters.unitType) && (filters.state === 'all' || r.state === filters.state)).map(r => r.cohortId));
    const candidate = fromRegions.filter(r => toIds.has(r.cohortId));
    const usable = candidate.filter(r => [pair.fromYear, pair.toYear].every(year => {
      const region = data.regions.find(x => x.year === year && x.cohortId === r.cohortId);
      const category = year === pair.fromYear ? fromCategory : toCategory;
      return !!region && !!category && (observationAt(observationIndex, region.id, year, category)?.cases ?? null) !== null;
    }));

    for (const [year, cat] of [[pair.fromYear, fromCategory], [pair.toYear, toCategory]] as const) {
      const index = data.meta.years.indexOf(year);
      const ids = new Set(usable.map(r => r.cohortId));
      const yearRegions = data.regions.filter(r => r.year === year && ids.has(r.cohortId));
      const valuesFor = yearRegions.map(r => observationAt(observationIndex, r.id, year, cat)?.cases ?? null);
      values[index] = valuesFor.length && valuesFor.every(v => v !== null) ? valuesFor.reduce<number>((a, v) => a + (v ?? 0), 0) : null;
    }
    return { name: `Verified ${pair.fromYear}–${pair.toYear} cohort (${usable.length} units)`, values };
  });

  const chartSeries = filters.state === 'all'
    ? [
        { name: `National annual totals (2021–2024) · ${selectedLabel}`, values: nationalAnnualSeriesValues },
        { name: `2020 Andhra Pradesh only · ${selectedLabel}`, values: ap2020StandaloneSeriesValues },
        ...totalSeries
      ]
    : [
        { name: `Annual recorded totals · ${selectedLabel}`, values: nationalAnnualSeriesValues },
        ...totalSeries
      ];

  const detailRows = chartSeries.flatMap(series =>
    series.values.flatMap((value, i) => value === null ? [] : [{
      id: `${series.name}-${labels[i]}`,
      period: series.name,
      year: Number(labels[i]),
      category: selectedLabel,
      cases: value
    }])
  );

  // Top category counts for the category breakdown
  const topCategories = data.topCategories?.filter(c => c.role !== 'official_total').slice(0, 8) ?? [];
  const topCatBars = topCategories.map((c, i) => ({
    label: c.cleanLabel,
    value: c.cases,
    color: colors[i % colors.length]
  }));

  // Sort regional rows descending by cases by default
  const sortedRows = [...rows].sort((a, b) => {
    const valA = typeof a.cases === 'number' ? a.cases : -1;
    const valB = typeof b.cases === 'number' ? b.cases : -1;
    return valB - valA;
  });

  const unitTypeLabel = filters.unitType === 'administrative_district'
    ? 'administrative districts'
    : filters.unitType === 'all'
      ? 'reporting units'
      : filters.unitType.replace('_', ' ');

  return (
    <>
      <PageTitle
        eyebrow="NATIONAL & REGIONAL PERSPECTIVE"
        title="Reported crime overview"
        description="Inspect source-reported recorded crimes, dominant offense categories, and regional reporting profiles."
        action={<ExportButton rows={sortedRows} name={`overview_${filters.year}_${filters.unitType}`} />}
      />

      <Filters />

      {filters.unitType === 'administrative_district' && (
        <Notice tone="neutral">
          <strong>Jurisdiction classification note:</strong> Reporting units in this view are classified as administrative districts via naming heuristics and exclusion rules from source tables. They have not been validated against official state revenue gazetteers or Survey of India / Census district boundary definitions.
        </Notice>
      )}

      <div className="stats">
        <Stat
          label="Reported cases in selected reporting units"
          value={number(total)}
          detail={`${knownUnits} of ${rows.length} ${unitTypeLabel} with reported data`}
        />
        <Stat
          label="Selected reporting units"
          value={number(rows.length)}
          detail={`${filters.year} · ${filters.state === 'all' ? '36 states/UTs' : filters.state}`}
        />
        <Stat
          label="Source categories available"
          value={number(categories.length)}
          detail={`${filters.year} distinct crime categories in dataset`}
        />
        <Stat
          label="Dataset temporal scope"
          value={`${Math.min(...data.meta.years)}–${Math.max(...data.meta.years)}`}
          detail={filters.year === 2020 ? '2020 is AP-only' : '2021–2024 national coverage'}
        />
      </div>

      <div className="grid two-one">
        <Panel
          title="Recorded crimes over time"
          subtitle={`${selectedLabel} across reporting periods. 2022–2023 connected where units are matched.`}
          action={<Link className="text-link" to="/trends">Full trends view <ArrowUpRight size={14} /></Link>}
        >
          <Lines labels={labels} series={chartSeries} unit="cases" />
          <details className="details" style={{ marginTop: '0.75rem' }}>
            <summary>View chart values table</summary>
            <DataTable
              searchable={false}
              rows={detailRows}
              columns={[
                { key: 'period', label: 'Series' },
                { key: 'year', label: 'Year' },
                { key: 'category', label: 'Category' },
                { key: 'cases', label: 'Recorded cases', render: r => number(r.cases as number) }
              ]}
            />
          </details>
        </Panel>

        <Panel
          title={`Top categories in ${filters.year}`}
          subtitle="Actual recorded cases for largest non-aggregate crime categories."
        >
          {topCatBars.length > 0 ? (
            <>
              <Bars items={topCatBars} unit="cases" />
              <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#6b7280' }}>
                Note: Category counts overlap and are not mutually exclusive; shares of grand total are not computed.
              </div>
            </>
          ) : (
            <p className="muted">Category totals unavailable for this selection.</p>
          )}
        </Panel>
      </div>

      <Panel
        title="Regional reporting snapshot"
        subtitle={`Showing ${rows.length} ${unitTypeLabel} sorted by reported cases in ${filters.year}.`}
        action={
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Click Inspect to open region profile or Compare to view side by side
          </span>
        }
      >
        <DataTable
          rows={sortedRows}
          columns={[
            {
              key: 'region',
              label: 'Reporting unit',
              render: (r: any) => (
                <button
                  type="button"
                  className="text-button"
                  style={{ textAlign: 'left', fontWeight: 600, color: 'var(--color-primary, #0f766e)' }}
                  onClick={() => {
                    setSelectedDrawerRegion(r.region);
                    setSelectedDrawerState(r.state);
                  }}
                  title="Click to inspect this region"
                >
                  {r.region}
                </button>
              )
            },
            { key: 'state', label: 'State / UT' },
            {
              key: 'regionType',
              label: 'Unit type',
              render: (r: any) => (
                <UnitTypeBadge regionType={r.regionType} verificationStatus={r.verificationStatus} />
              )
            },
            {
              key: 'cases',
              label: 'Reported cases',
              render: (r: any) => number(r.cases as number | null)
            },
            {
              key: 'coverage',
              label: 'Source status',
              render: (r: any) => (
                <Badge tone={r.cases !== null ? 'green' : 'amber'}>
                  {r.cases !== null ? 'Reported' : 'Missing'}
                </Badge>
              )
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (r: any) => (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="button small"
                    onClick={() => {
                      setSelectedDrawerRegion(r.region);
                      setSelectedDrawerState(r.state);
                    }}
                    title="Inspect profile"
                  >
                    <Eye size={12} /> Inspect
                  </button>
                  <button
                    type="button"
                    className="button small"
                    onClick={() => navigate(`/compare?region=${encodeURIComponent(r.region)}&state=${encodeURIComponent(r.state)}`)}
                    title="Compare this region"
                  >
                    <BarChart2 size={12} /> Compare
                  </button>
                </div>
              )
            }
          ]}
        />
      </Panel>

      <Notice>
        {data.meta.warnings[0]} Aggregate rows are retained for reconciliation and excluded from unit sums. Crime figures reflect recorded offenses and are heavily shaped by population and policing intensity.
      </Notice>

      <RegionDetailDrawer
        regionName={selectedDrawerRegion}
        stateName={selectedDrawerState}
        onClose={() => setSelectedDrawerRegion(null)}
        onCompare={reg => {
          setSelectedDrawerRegion(null);
          navigate(`/compare?region=${encodeURIComponent(reg)}`);
        }}
      />
    </>
  );
}
