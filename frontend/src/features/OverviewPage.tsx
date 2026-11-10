import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BarChart2, Eye } from 'lucide-react';
import { PageTitle } from '../components/Layout';
import { Panel, Filters, Stat, Notice, Badge, UnitTypeBadge, ExportButton, RegionDetailDrawer } from '../components/UI';
import { AnnualBars, Bars, colors, type AnnualBarDatum } from '../components/Charts';
import { DataTable } from '../components/DataTable';
import { useAnalytics } from '../context/useAnalytics';
import { number } from '../utils/format';
import { categoryLabel, roleFor, categoryContextLabel, rawCategoryLabel, categoryContextStatus } from '../utils/categories';
import { getObservationIndex, observationAt } from '../utils/observationIndex';

export default function OverviewPage() {
  const navigate = useNavigate();
  const { data, filters, total, rows, annual, categories, knownUnits, officialTotalId } = useAnalytics();
  const [selectedDrawerRegion, setSelectedDrawerRegion] = useState<string | null>(null);
  const [selectedDrawerState, setSelectedDrawerState] = useState<string | undefined>(undefined);

  const observationIndex = getObservationIndex(data.observations);
  const labels = data.meta.years.map(String);
  const selectedLabel = filters.category === 'all' ? 'Official reported total' : categoryLabel(data, filters.category);

  // Annual recorded totals for every available year. Each year is an independent
  // snapshot of the eligible reporting units for that year; each total is the sum
  // over the selected unit cohort (not the official all-India published total).
  // The years are never connected, because 2023 is reported under the IPC and 2024
  // under the BNS.
  const annualValues: (number | null)[] = labels.map(() => null);
  const annualUnitCounts: number[] = labels.map(() => 0);

  for (const year of data.meta.years) {
    const categoryAtYear = filters.category === 'all'
      ? data.meta.categories?.find(c => c.years.includes(year) && roleFor(data, c.id, year) === 'official_total')?.id
      : (data.meta.categories?.some(c => c.id === filters.category && c.years.includes(year)) ? filters.category : null);

    const yearUnits = data.regions.filter(r => r.year === year && (filters.unitType === 'all' || r.regionType === filters.unitType) && (filters.state === 'all' || r.state === filters.state));
    const nums = yearUnits.map(r => observationAt(observationIndex, r.id, year, categoryAtYear ?? '')?.cases ?? null);
    const known = nums.filter(n => n !== null);
    const sum = known.length ? known.reduce<number>((a, b) => a + (b ?? 0), 0) : null;

    const yearIdx = data.meta.years.indexOf(year);
    annualValues[yearIdx] = sum;
    annualUnitCounts[yearIdx] = yearUnits.length;
  }

  const annualBars: AnnualBarDatum[] = data.meta.years.map((year, i) => ({
    label: String(year),
    value: annualValues[i],
    units: annualUnitCounts[i],
    framework: year <= 2023 ? 'IPC' : 'BNS'
  }));

  // The 2024 bar follows a reporting-framework change (IPC → BNS), so the chart
  // divides the last two years rather than implying a comparable decline.
  const frameworkBreak = data.meta.years.indexOf(2023);

  // Exact annual values shown beside the chart. The visible scope and unit count
  // travel with the numbers so the table matches what the chart displays.
  const annualTableRows = data.meta.years.map((year, i) => ({
    id: `annual-${year}`,
    year,
    framework: year <= 2023 ? 'IPC' : 'BNS',
    units: annualUnitCounts[i],
    scope: filters.state === 'all' ? 'National · 36 States/UTs' : filters.state,
    cases: annualValues[i]
  }));

  // Top category counts for the category breakdown
  const topCategories = data.topCategories?.filter(c => c.role !== 'official_total').slice(0, 8) ?? [];
  const topCatBars = topCategories.map((c, i) => ({
    label: categoryContextLabel(data, c.id, c.label, filters.year),
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

  // Export rows carry the contextual metadata that the on-screen table shows:
  // stable category id, the original source label, the contextual display label,
  // year, reporting-unit identifiers, and the active release reference.
  const exportCategoryId = filters.category === 'all' ? (officialTotalId ?? '') : filters.category;
  const exportRows = sortedRows.map(r => ({
    category_id: exportCategoryId,
    category_source_label: exportCategoryId ? rawCategoryLabel(data, exportCategoryId) : '',
    category_display_label: selectedLabel,
    category_context_status: exportCategoryId ? categoryContextStatus(data, exportCategoryId, filters.year) : '',
    year: filters.year,
    reporting_unit_id: r.id,
    reporting_unit: r.region,
    state_ut: r.state,
    unit_type: r.regionType,
    recorded_cases: r.cases,
    source_status: r.coverage,
    release: data.meta.releaseId,
  }));

  return (
    <>
      <PageTitle
        eyebrow="NATIONAL & REGIONAL PERSPECTIVE"
        title="Reported crime overview"
        description="Inspect source-reported recorded crimes, dominant offense categories, and regional reporting profiles."
        action={<ExportButton rows={exportRows} name={`overview_${filters.year}_${filters.unitType}`} />}
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
          detail={'2021–2024 national coverage'}
        />
      </div>

      <div className="grid two-col">
        <Panel
          title="Reported cases by year"
          subtitle="Separate annual snapshots of eligible reporting units."
          action={
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <ExportButton rows={annualTableRows} name="overview_annual_totals" />
              <Link className="text-link" to="/trends">Compare the same named units <ArrowUpRight size={14} /></Link>
            </div>
          }
        >
          <AnnualBars
            bars={annualBars}
            unit="cases"
            height={320}
            breakAfterIndex={frameworkBreak}
            breakLabel="2024 framework change"
            callout={`Each bar is that year's own source total for the eligible units — the four bars are separate snapshots, not a continuous series. 2024 is reported under the BNS, a different legal framework from the IPC used through 2023, so the 2023→2024 change is not a like-for-like comparison and no comparable decline is claimed. To compare the same jurisdiction names, use the name-matched cohort in the trends view.`}
            ariaLabel="Reported cases by year from 2021 to 2024 with a zero baseline. Each year is a separate snapshot and 2024 uses a different reporting framework."
          />
          <details className="details" style={{ marginTop: '0.75rem' }}>
            <summary>View exact annual values</summary>
            <DataTable
              searchable={false}
              rows={annualTableRows}
              columns={[
                { key: 'year', label: 'Year' },
                { key: 'framework', label: 'Law framework', render: r => <Badge tone={r.framework === 'IPC' ? 'neutral' : 'amber'}>{String(r.framework)}</Badge> },
                { key: 'scope', label: 'Geographic scope' },
                { key: 'units', label: 'Reporting units' },
                { key: 'cases', label: 'Recorded cases', render: r => number(r.cases as number | null) }
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
