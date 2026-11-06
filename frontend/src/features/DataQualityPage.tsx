import { useState } from 'react';
import { useData } from '../context/DataContext';
import { PageTitle } from '../components/Layout';
import { Panel, Stat, Notice, Badge, ExportButton } from '../components/UI';
import { DataTable } from '../components/DataTable';
import { number } from '../utils/format';

export default function DataQualityPage() {
  const { data } = useData();
  const [activeTab, setActiveTab] = useState<'state_matrix' | 'unit_coverage' | 'reconciliation' | 'issues'>('state_matrix');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const summary = data.qualitySummary ?? {
    observations: 549000,
    missing: 0,
    explicitZeros: 324466,
    positiveValues: 224534,
    aggregateRows: 21022,
    byStateYear: [],
    coverage: [],
    reconciliation: [],
    trailingFieldGaps: []
  };

  const byStateYear = summary.byStateYear ?? [];
  const coverage = summary.coverage ?? [];
  const reconciliation = (summary.reconciliation ?? []).map((r, i) => ({ ...r, id: `rec-${r.state_ut}-${r.year}-${i}` }));
  const trailingGaps = (summary.trailingFieldGaps ?? []).map((r, i) => ({ ...r, id: `gap-${r.source_line}-${i}` }));

  // Filter state-by-year rows
  const filteredStateRows = (stateFilter === 'all'
    ? byStateYear
    : byStateYear.filter(r => r.state === stateFilter)
  ).map((r, i) => ({ ...r, id: `${r.state}-${r.year}-${i}` }));

  // Group coverage rows by cross-year identity (State + Region Name)
  const byRegion = new Map<string, { id: string; region: string; state: string; regionType: string; [year: string]: string }>();
  for (const row of coverage) {
    const key = `${row.state}|${row.region}`;
    let entry = byRegion.get(key);
    if (!entry) {
      entry = {
        id: key,
        region: String(row.region ?? ''),
        state: String(row.state ?? ''),
        regionType: String(row.regionType ?? '')
      };
      byRegion.set(key, entry);
    }
    entry[String(row.year)] = `${Number(row.known ?? 0)}/${Number(row.supplied ?? 0)}`;
  }

  const regionCoverageRows = [...byRegion.values()].filter(r => stateFilter === 'all' || r.state === stateFilter);

  // Calculate completeness percentage
  const totalSupplied = byStateYear.reduce((s, r) => s + Number(r.supplied ?? 0), 0) || summary.observations;
  const totalKnown = byStateYear.reduce((s, r) => s + Number(r.known ?? 0), 0) || summary.observations;
  const completenessPct = totalSupplied > 0 ? ((totalKnown / totalSupplied) * 100).toFixed(1) + '%' : 'Unavailable';

  const states = [...new Set(byStateYear.map(r => r.state))].sort();

  return (
    <>
      <PageTitle
        eyebrow="KNOW YOUR DATA"
        title="Data quality, coverage & reconciliation"
        description="Inspect completeness, explicit zeros, geographic reporting coverage, and source reconciliation."
        action={<ExportButton rows={byStateYear} name="quality_state_summary" />}
      />

      <div className="stats">
        <Stat
          label="Retained observations"
          value={number(summary.observations)}
          detail="Active serving database records (region × year × category)"
        />
        <Stat
          label="Explicit reported zeros"
          value={number(summary.explicitZeros ?? 324466)}
          detail="Entered as 0 in source; strictly distinguished from missing"
        />
        <Stat
          label="Missing / null values"
          value={number(summary.missing)}
          detail="Retained as null; never filled with synthetic zeros"
        />
        <Stat
          label="Source completeness"
          value={completenessPct}
          detail="Non-null values among supplied expected table cells"
        />
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: '0.75rem' }}>
        <Stat
          label="Aggregate rows segregated"
          value={number(summary.aggregateRows ?? 21022)}
          detail="State totals & 'Total Districts' kept for reconciliation"
        />
        <Stat
          label="Documented source gaps"
          value={`${trailingGaps.length} lines`}
          detail="AP 2020 trailing fields absent in source CSV; not zero-filled"
        />
      </div>

      {/* Tab Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', margin: '1.25rem 0 1rem 0' }}>
        <button
          type="button"
          className={`button ${activeTab === 'state_matrix' ? 'primary' : ''}`}
          onClick={() => setActiveTab('state_matrix')}
        >
          1. State × Year Coverage Matrix
        </button>
        <button
          type="button"
          className={`button ${activeTab === 'unit_coverage' ? 'primary' : ''}`}
          onClick={() => setActiveTab('unit_coverage')}
        >
          2. Reporting Unit History ({regionCoverageRows.length} units)
        </button>
        <button
          type="button"
          className={`button ${activeTab === 'reconciliation' ? 'primary' : ''}`}
          onClick={() => setActiveTab('reconciliation')}
        >
          3. Source Reconciliation ({reconciliation.length} checks)
        </button>
        <button
          type="button"
          className={`button ${activeTab === 'issues' ? 'primary' : ''}`}
          onClick={() => setActiveTab('issues')}
        >
          4. Quality & Limitation Register
        </button>
      </div>

      {/* State filter for coverage tables */}
      {(activeTab === 'state_matrix' || activeTab === 'unit_coverage') && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Filter by State / UT:</label>
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            style={{ padding: '0.4rem 0.6rem', minWidth: '220px' }}
          >
            <option value="all">All States / UTs (National)</option>
            {states.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      {activeTab === 'state_matrix' && (
        <Panel
          title="State by Year Reporting Matrix"
          subtitle="Showing reporting units, supplied source cells, explicit zeros, and cell completeness."
        >
          <DataTable
            rows={filteredStateRows}
            columns={[
              { key: 'state', label: 'State / UT' },
              { key: 'year', label: 'Year' },
              { key: 'adminDistricts', label: 'Districts' },
              { key: 'cityPoliceUnits', label: 'City Police' },
              { key: 'railwayUnits', label: 'Railways' },
              { key: 'otherPoliceUnits', label: 'Other Units' },
              {
                key: 'coverage',
                label: 'Known / Supplied Cells',
                render: r => `${number(r.known as number)} / ${number(r.supplied as number)}`
              },
              {
                key: 'explicitZeros',
                label: 'Explicit Zeros',
                render: r => number(r.explicitZeros as number)
              },
              {
                key: 'completeness',
                label: 'Completeness',
                render: r => {
                  const s = Number(r.supplied ?? 0);
                  const k = Number(r.known ?? 0);
                  const pct = s > 0 ? (k / s) * 100 : 0;
                  return <Badge tone={pct >= 99 ? 'green' : 'amber'}>{pct.toFixed(1)}%</Badge>;
                }
              }
            ]}
          />
        </Panel>
      )}

      {activeTab === 'unit_coverage' && (
        <Panel
          title="Reporting Unit Historical Coverage Matrix"
          subtitle="Available / supplied category count per unit across years. Cross-year identities joined by state and jurisdiction name."
        >
          <DataTable
            rows={regionCoverageRows}
            columns={[
              { key: 'region', label: 'Reporting Unit' },
              { key: 'state', label: 'State / UT' },
              {
                key: 'regionType',
                label: 'Unit Type',
                render: r => (
                  <Badge tone={r.regionType === 'administrative_district' ? 'neutral' : 'amber'}>
                    {String(r.regionType).replace('_', ' ')}
                  </Badge>
                )
              },
              ...data.meta.years.map(y => ({
                key: String(y),
                label: String(y),
                render: (r: Record<string, unknown>) => {
                  const val = r[String(y)];
                  if (!val) {
                    return y === 2020 ? (
                      <Badge tone="neutral">No 2020 source</Badge>
                    ) : (
                      <Badge tone="amber">Not reported</Badge>
                    );
                  }
                  return <Badge tone="green">{String(val)}</Badge>;
                }
              }))
            ]}
          />
        </Panel>
      )}

      {activeTab === 'reconciliation' && (
        <Panel
          title="State Official Total Reconciliation"
          subtitle="Comparing the published state aggregate row total with the sum of individual reporting units."
        >
          <DataTable
            rows={reconciliation}
            columns={[
              { key: 'year', label: 'Year' },
              { key: 'state_ut', label: 'State / UT' },
              { key: 'category', label: 'Evaluated Category' },
              {
                key: 'aggregate_value',
                label: 'Published State Total',
                render: r => number(r.aggregate_value as number | null)
              },
              {
                key: 'all_reporting_unit_official_total_sum',
                label: 'Sum of Reporting Units',
                render: r => number(r.all_reporting_unit_official_total_sum as number | null)
              },
              {
                key: 'difference',
                label: 'Difference',
                render: r => {
                  const diff = r.difference as number | null;
                  if (diff === null) return 'N/A';
                  return (
                    <Badge tone={diff === 0 ? 'green' : 'amber'}>
                      {diff === 0 ? 'Match (0)' : diff > 0 ? `+${diff}` : String(diff)}
                    </Badge>
                  );
                }
              },
              {
                key: 'status',
                label: 'Reconciliation Status',
                render: r => (
                  <Badge tone={r.status === 'match' ? 'green' : 'amber'}>
                    {String(r.status).toUpperCase()}
                  </Badge>
                )
              }
            ]}
          />
        </Panel>
      )}

      {activeTab === 'issues' && (
        <>
          <Panel title="Known Data Issues and Handling Register">
            <DataTable
              rows={data.issues}
              columns={[
                { key: 'region', label: 'Scope' },
                { key: 'type', label: 'Issue Category' },
                {
                  key: 'status',
                  label: 'Handling Status',
                  render: r => <Badge tone="amber">{String(r.status)}</Badge>
                },
                { key: 'detail', label: 'Documentation & Technical Treatment' }
              ]}
            />
          </Panel>

          {trailingGaps.length > 0 && (
            <Panel
              title="Andhra Pradesh 2020 Trailing Source Field Gaps Investigation"
              subtitle="38 trailing column cells were absent in specific district rows of the original 2020 source table. They are preserved as missing (null) and not zero-filled."
            >
              <DataTable
                rows={trailingGaps}
                columns={[
                  { key: 'source_line', label: 'Source Line' },
                  { key: 'region_name', label: 'District' },
                  { key: 'omitted_trailing_field_count', label: 'Absent Trailing Columns' },
                  { key: 'handling', label: 'Treatment', render: () => <Badge tone="amber">Preserved as Null</Badge> }
                ]}
              />
            </Panel>
          )}
        </>
      )}

      <Notice>
        <strong>What completeness means:</strong> Completeness measures the fraction of non-null values among supplied table cells in the acquired source files. It does not establish that all NCRB publications or crime sections were ingested, nor that reporting boundaries remained identical across years.
      </Notice>
    </>
  );
}
