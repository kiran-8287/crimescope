import { useState } from 'react';
import { useData } from '../context/DataContext';
import { PageTitle } from '../components/Layout';
import { Panel, Stat, Notice, Badge, UnitTypeBadge, ExportButton } from '../components/UI';
import { DataTable } from '../components/DataTable';
import { number } from '../utils/format';

export default function DataQualityPage() {
  const { data } = useData();
  const [activeTab, setActiveTab] = useState<'state_matrix' | 'unit_coverage' | 'reconciliation' | 'issues'>('state_matrix');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const summary = data.qualitySummary ?? {
    observations: 0,
    missing: 0,
    explicitZeros: 0,
    positiveValues: 0,
    aggregateRows: 0,
    byStateYear: [],
    coverage: [],
    reconciliation: [],
    trailingFieldGaps: []
  };

  const byStateYear = summary.byStateYear ?? [];
  const coverage = summary.coverage ?? [];
  const reconciliation = (summary.reconciliation ?? []).map((r, i) => ({ ...r, id: `rec-${r.state_ut}-${r.year}-${i}` }));
  const trailingGaps = (summary.trailingFieldGaps ?? []).map((r, i) => ({ ...r, id: `gap-${r.source_line}-${i}` }));

  // Release-wide totals. `sourceRows` is the canonical reconciliation total across
  // all rows; eligible + aggregate partitions it without mixing scopes.
  const eligibleObservations = summary.observations ?? 0;
  const aggregateObservations = summary.aggregateRows ?? 0;
  const canonicalObservations = data.meta.sourceRows ?? (eligibleObservations + aggregateObservations);
  const sourceFileCount = (data.meta as unknown as { sourceFiles?: number }).sourceFiles ?? null;

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

  // Calculate completeness percentage — the fraction of non-null values among
  // supplied expected table cells. This is a supplied-cell measure only.
  const totalSupplied = byStateYear.reduce((s, r) => s + Number(r.supplied ?? 0), 0) || summary.observations;
  const totalKnown = byStateYear.reduce((s, r) => s + Number(r.known ?? 0), 0) || summary.observations;
  const completenessPct = totalSupplied > 0 ? ((totalKnown / totalSupplied) * 100).toFixed(1) + '%' : 'Unavailable';

  const states = [...new Set(byStateYear.map(r => r.state))].sort();

  // Reconciliation: distinguish checks available vs passed vs mismatched vs unavailable.
  // A record existing is not the same as a confirmed reconciliation.
  const diffOf = (r: any) => (r.difference === null || r.difference === undefined ? null : Number(r.difference));
  const reconciliationUnavailable = reconciliation.filter(r => diffOf(r) === null || !r.status || r.status === 'unavailable').length;
  const reconciliationMismatch = reconciliation.filter(r => diffOf(r) !== null && (Number(r.difference) !== 0 || r.status === 'mismatch')).length;
  const reconciliationPassed = reconciliation.filter(r => diffOf(r) === 0 && r.status === 'match').length;
  const reconciliationChecks = reconciliation.length;
  const reconciliationAvailable = reconciliationPassed + reconciliationMismatch;

  const exportRows = activeTab === 'state_matrix'
    ? filteredStateRows
    : activeTab === 'unit_coverage'
      ? regionCoverageRows
      : activeTab === 'reconciliation'
        ? reconciliation
        : (data.issues as unknown as Record<string, unknown>[]);

  return (
    <>
      <PageTitle
        eyebrow="KNOW YOUR DATA"
        title="Data quality, coverage & reconciliation"
        description="Inspect eligible observations, explicit zeros, geographic reporting coverage, and per-record source reconciliation."
        action={<ExportButton rows={exportRows} name={`quality_${activeTab}_${stateFilter}`} />}
      />

      <Notice>
        <strong>Card scope:</strong> The summary cards below describe the whole active release (2021–2024, all States/UTs). The State/UT filter
        applies only to the coverage tables, not to these release-wide totals.
      </Notice>

      <div className="stats">
        <Stat
          label="Eligible observations"
          value={number(eligibleObservations)}
          detail="Non-aggregate observations in the active release (excludes aggregate rows)"
        />
        <Stat
          label="Eligible explicit zeros"
          value={number(summary.explicitZeros ?? 0)}
          detail="Zeros recorded among eligible non-aggregate observations; kept distinct from missing"
        />
        <Stat
          label="Retained nulls"
          value={number(summary.missing ?? 0)}
          detail="Nulls retained after preparation; never filled with synthetic zeros"
        />
        <Stat
          label="Non-null supplied cells"
          value={completenessPct}
          detail="Non-null values among supplied table cells — see the note below"
        />
      </div>

      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: '0.75rem' }}>
        <Stat
          label="Aggregate observations"
          value={number(aggregateObservations)}
          detail="State/UT totals & 'Total Districts' rows kept for reconciliation, excluded from unit views"
        />
        <Stat
          label="Canonical observations (all rows)"
          value={number(canonicalObservations)}
          detail={`Reconciliation total = ${number(eligibleObservations)} eligible + ${number(aggregateObservations)} aggregate`}
        />
        <Stat
          label="Source files"
          value={sourceFileCount === null ? 'Unavailable' : number(sourceFileCount)}
          detail="36 state/UT fragments × 4 active years"
        />
        <Stat
          label="Documented source gaps"
          value={`${trailingGaps.length} lines`}
          detail="Trailing source fields absent from the active files; not zero-filled (see note below)"
        />
      </div>

      {/* Tab Controls */}
      <div className="tabs" role="tablist" aria-label="Data quality view" style={{ margin: '1.25rem 0 1rem 0' }}>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'state_matrix'}
          className={activeTab === 'state_matrix' ? 'active' : ''}
          onClick={() => setActiveTab('state_matrix')}
        >
          1. State × Year Coverage Matrix
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'unit_coverage'}
          className={activeTab === 'unit_coverage' ? 'active' : ''}
          onClick={() => setActiveTab('unit_coverage')}
        >
          2. Reporting Unit History ({regionCoverageRows.length} units)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reconciliation'}
          className={activeTab === 'reconciliation' ? 'active' : ''}
          onClick={() => setActiveTab('reconciliation')}
        >
          3. Source Reconciliation ({reconciliationPassed}/{reconciliationChecks} passed · {reconciliationMismatch} mismatched · {reconciliationUnavailable} unavailable)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'issues'}
          className={activeTab === 'issues' ? 'active' : ''}
          onClick={() => setActiveTab('issues')}
        >
          4. Quality & Limitation Register
        </button>
      </div>

      {/* State filter for coverage tables */}
      {(activeTab === 'state_matrix' || activeTab === 'unit_coverage') && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Filter by State / UT:</label>
          <select
            value={stateFilter}
            onChange={e => setStateFilter(e.target.value)}
            style={{ minWidth: '220px' }}
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
          subtitle="Available / supplied category count per unit across the active years. Cross-year identities are joined by state and jurisdiction name; this is a name-based count, not a gazetteer-verified unit list."
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
                  <UnitTypeBadge regionType={String(r.regionType)} />
                )
              },
              ...data.meta.years.map(y => ({
                key: String(y),
                label: String(y),
                render: (r: Record<string, unknown>) => {
                  const val = r[String(y)];
                  if (!val) {
                    return <Badge tone="amber">Not reported</Badge>;
                  }
                  return <Badge tone="green">{String(val)}</Badge>;
                }
              }))
            ]}
          />
        </Panel>
      )}

      {activeTab === 'reconciliation' && (
        <>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <Stat
              label="Checks available"
              value={number(reconciliationAvailable)}
              detail="Records with a comparable published total and unit sum"
            />
            <Stat
              label="Checks passed"
              value={number(reconciliationPassed)}
              detail="Difference is exactly zero"
            />
            <Stat
              label="Mismatches"
              value={number(reconciliationMismatch)}
              detail="Non-zero difference or non-match status"
            />
            <Stat
              label="Unavailable checks"
              value={number(reconciliationUnavailable)}
              detail="No comparable difference could be computed"
            />
          </div>

          <Panel
            title="State Official Total Reconciliation"
            subtitle="Comparing each state's published aggregate row total with the sum of its individual reporting units for one year. A record existing is not itself a confirmed reconciliation."
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
                    if (diff === null || diff === undefined) return <Badge tone="neutral">Unavailable</Badge>;
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
                  render: r => {
                    const status = String(r.status ?? 'unavailable');
                    const tone = status === 'match' ? 'green' : status === 'mismatch' ? 'amber' : 'neutral';
                    return <Badge tone={tone}>{status.toUpperCase()}</Badge>;
                  }
                }
              ]}
            />
            <p className="panel-note">
              {number(reconciliationChecks)} records are the checks attempted across 36 States/UTs × 4 active years.
              Of these, {number(reconciliationPassed)} passed, {number(reconciliationMismatch)} mismatched and {number(reconciliationUnavailable)} were unavailable.
              A count of {number(reconciliationChecks)} records is therefore not automatically {number(reconciliationChecks)} successful reconciliations.
            </p>
          </Panel>
        </>
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
        </>
      )}

      <Notice>
        <strong>What completeness means:</strong> “Non-null supplied cells” measures the fraction of non-null values among the table cells that
        were actually supplied in the acquired source files. It does not prove that every NCRB publication, crime section or reporting unit was
        published or ingested, nor that reporting boundaries were identical across years. It is a supplied-cell measure, not a measure of complete
        publication coverage or of actual crime coverage.
      </Notice>

      <Notice>
        <strong>What “0 documented source gaps” means:</strong> No trailing fields were absent from the trailing columns of the {sourceFileCount === null ? 'active' : number(sourceFileCount)} active
        source files, so no cells were left zero-filled for that reason in the active 2021–2024 release. This describes the active release only; it
        is not evidence of perfect source data, and the historical Andhra Pradesh 2020 missing-field issues belong to the archived-scope
        documentation, outside this release.
      </Notice>
    </>
  );
}
