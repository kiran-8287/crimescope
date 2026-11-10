import { useState, useMemo } from 'react';
import { Info, X } from 'lucide-react';
import { useAnalytics } from '../context/useAnalytics';
import { useFilters } from '../context/useFilters';
import { PageTitle } from '../components/Layout';
import { Notice, Filters, Panel, Badge, ExportButton, RegionDetailDrawer, Stat } from '../components/UI';
import { DataTable } from '../components/DataTable';
import { categoryContextLabelByRaw, categoryContextStatus } from '../utils/categories';
import { number } from '../utils/format';

type AnomalyFilterType = 'all' | 'rare_category' | 'high_volume' | 'moderate';

export default function AnomaliesPage() {
  const { data, filters } = useAnalytics();
  const { update } = useFilters();
  const method = data.methods?.anomalies;
  const rows: any[] = method?.result ?? [];

  const [activeTab, setActiveTab] = useState<AnomalyFilterType>('all');
  const [search, setSearch] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState<any | null>(null);
  const [drawerRegion, setDrawerRegion] = useState<string | null>(null);

  const labels = new Map(data.meta.categories?.map(c => [c.id, c.label]));

  // 2024 administrative-district cohort the z-scores are computed against. Derived
  // from the loaded data (not hardcoded) so it cannot drift from the saved run.
  const cohortSize = data.regions.filter(r => r.year === 2024 && r.regionType === 'administrative_district').length;
  // Matches the saved z-score convention: anomaly.py standardises with the SAMPLE
  // standard deviation (n-1 denominator). For one positive case among N-1 zeros
  // that evaluates to s = 1/√N and z = (N-1)/√N, not the population form √(N-1)…
  const rareZScore = cohortSize > 1 ? (cohortSize - 1) / Math.sqrt(cohortSize) : 0;
  const rareStd = cohortSize > 0 ? 1 / Math.sqrt(cohortSize) : 0;

  // The categories that actually receive a saved anomaly flag (the analysed
  // feature set for the run). Resolved to stable ids via exact source-label match
  // so the selector can drive the shared category filter without re-deriving.
  const analysedCategories = useMemo(() => {
    const seen = new Map<string, { id: string; label: string; display: string }>();
    for (const r of rows) {
      const meta = (data.meta.categories ?? []).find(c => c.label === r.category && c.years.includes(2024))
        ?? (data.meta.categories ?? []).find(c => c.label === r.category);
      const id = meta?.id;
      if (!id || seen.has(id)) continue;
      seen.set(id, { id, label: r.category, display: categoryContextLabelByRaw(data, r.category, 2024) });
    }
    return [...seen.values()].sort((a, b) => a.display.localeCompare(b.display));
  }, [rows, data]);

  // Process rows with the exact saved flag predicates. These are presentation
  // classifications of the SAVED flags; no threshold or saved value is changed.
  const enrichedRows = useMemo(() => {
    return rows.map((r: any, idx: number) => {
      const val = Number(r.value ?? 0);
      const z = Number(r.z_score ?? 0);
      // Rare predicate, exactly as tabulated below: <= 3 cases AND |z| > 10.
      const isRare = val <= 3 && Math.abs(z) > 10;
      // Higher-count predicate: not rare AND >= 20 cases.
      const isHighVolume = !isRare && val >= 20;
      // Intermediate predicate: everything else (not rare and < 20 cases).
      const isModerate = !isRare && !isHighVolume;
      return {
        ...r,
        id: `${r.region_id}-${r.category_id || r.category}-${idx}`,
        cleanCategory: categoryContextLabelByRaw(data, r.category, 2024),
        cases: val,
        zScore: z,
        referenceMean: r.category_mean,
        referenceStd: r.category_std,
        flagType: isRare ? 'Rare-category flag' : isHighVolume ? 'Higher-count flag' : 'Intermediate flag',
        isRare,
        isHighVolume,
        isModerate,
        cohortSize
      };
    });
  }, [rows, data, cohortSize]);

  const rareCount = enrichedRows.filter((r: any) => r.isRare).length;
  const highCount = enrichedRows.filter((r: any) => r.isHighVolume).length;
  const moderateCount = enrichedRows.filter((r: any) => r.isModerate).length;
  const groupsSum = rareCount + highCount + moderateCount;

  // Apply the shared state/category filters plus the page-local search and tab.
  // These only SELECT saved flags; the national reference distribution is fixed.
  const filteredRows = enrichedRows.filter((r: any) => {
    if (filters.state !== 'all' && r.state_name !== filters.state) return false;
    if (filters.category !== 'all' && r.category !== labels.get(filters.category)) return false;
    if (search.trim()) {
      const hay = `${r.region} ${r.state_name} ${r.category} ${r.cleanCategory}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    if (activeTab === 'rare_category') return r.isRare;
    if (activeTab === 'high_volume') return r.isHighVolume;
    if (activeTab === 'moderate') return r.isModerate;
    return true;
  });

  // Deterministic worked examples located by exact saved-row identity (not by
  // recomputing z). Satara is one of four rare flags tied at the maximum z; the
  // tie is broken by reporting-unit then category name, and Satara is the named
  // research example.
  const sataraRow = enrichedRows.find((r: any) => r.region === 'Satara' && r.isRare);
  const northWestRow = enrichedRows.find(
    (r: any) => r.region === 'North-West' && r.state_name === 'Delhi' && String(r.category).includes('Other Thefts')
  );

  function loadExample(row: any, tab: AnomalyFilterType) {
    if (!row) return;
    update('state', 'all');
    update('category', 'all');
    setActiveTab(tab);
    setSearch(row.region);
    setSelectedAnomaly(row);
  }

  // Export carries the same contextual metadata the table shows: stable category
  // id (resolved from the verified taxonomy by exact source label), original source
  // label, contextual display label, year, reporting-unit identity, the stored
  // reference mean/std and z-score, and the active release reference.
  const exportRows = filteredRows.map((r: any) => {
    const categoryId = data.meta.categories?.find(c => c.label === r.category)?.id ?? '';
    return {
      category_id: categoryId,
      category_source_label: r.category,
      category_display_label: r.cleanCategory,
      category_context_status: categoryId ? categoryContextStatus(data, categoryId, r.year ?? 2024) : 'unavailable',
      year: r.year ?? 2024,
      reporting_unit_id: r.region_id,
      reporting_unit: r.region,
      state_ut: r.state_name,
      reported_cases: r.cases,
      reference_mean: r.referenceMean,
      reference_std: r.referenceStd,
      z_score: r.zScore,
      flag_type: r.flagType,
      release: data.meta.releaseId,
    };
  });

  return (
    <>
      <PageTitle
        eyebrow="STATISTICAL SCREENING"
        title="Unusual observations (2024 Cross-Sectional)"
        description="Saved statistical flags (|z| ≥ 2.5) across the 2024 national administrative-district cohort."
        action={<ExportButton rows={exportRows} name="unusual_observations_2024" />}
      />

      <Filters fixedYear={2024} hideCategory />

      {/* Global cohort statistics are kept visually separate from the currently
          filtered flag counts: the first two cards describe the fixed saved run,
          the third describes the current selection. */}
      <div className="stats">
        <Stat
          label="National reference cohort (fixed)"
          value={`${number(cohortSize)} districts`}
          detail="2024 administrative-district cohort. Per-category reference mean/std are fixed in the saved run."
        />
        <Stat
          label="Saved flags in this run"
          value={number(rows.length)}
          detail="Global flagged records (|z| ≥ 2.5) before any state/category/tab selection."
        />
        <Stat
          label="Matching current selection"
          value={number(filteredRows.length)}
          detail="Subset of the saved flags selected by the filters below. Filters do not recompute z-scores."
        />
        <Stat
          label="Method & threshold"
          value="|z| ≥ 2.5"
          detail={`Sample standard deviation (ddof = 1) across ${number(cohortSize)} districts.`}
        />
      </div>

      <Panel
        title="Filter saved flags"
        subtitle="State, category, search and tab narrow which saved flags are shown. The national reference mean and standard deviation come from the saved 2024 run and are never recalculated from these filters."
      >
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, flex: '1 1 300px', minWidth: 0 }}>
            Analysed category
            <select
              value={filters.category === 'all' ? 'all' : filters.category}
              onChange={e => update('category', e.target.value)}
              style={{ width: '100%', maxWidth: '100%', minWidth: 0, padding: '0.5rem' }}
            >
              <option value="all">All analysed categories ({analysedCategories.length})</option>
              {analysedCategories.map(c => (
                <option key={c.id} value={c.id}>{c.display}</option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', fontWeight: 600, flex: '1 1 260px' }}>
            Search region or category
            <input
              type="search"
              placeholder="e.g. Satara, Other Thefts…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '0.5rem' }}
            />
          </label>

          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSearch('');
              setActiveTab('all');
              update('category', 'all');
              update('state', 'all');
            }}
          >
            Clear filters
          </button>
        </div>

        {/* Tab predicates, kept exact and visible. */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`button ${activeTab === 'all' ? 'primary' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All saved flags ({enrichedRows.length})
          </button>
          <button
            type="button"
            className={`button ${activeTab === 'rare_category' ? 'primary' : ''}`}
            onClick={() => setActiveTab('rare_category')}
          >
            Rare-category flags (≤3 cases &amp; |z| &gt; 10) ({rareCount})
          </button>
          <button
            type="button"
            className={`button ${activeTab === 'high_volume' ? 'primary' : ''}`}
            onClick={() => setActiveTab('high_volume')}
          >
            Higher-count flags (≥20 cases) ({highCount})
          </button>
          <button
            type="button"
            className={`button ${activeTab === 'moderate' ? 'primary' : ''}`}
            onClick={() => setActiveTab('moderate')}
          >
            Intermediate flags (&lt;20 cases, not rare) ({moderateCount})
          </button>
        </div>

        <p style={{ margin: '0.85rem 0 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted, #6b7280)', lineHeight: 1.5 }}>
          The three flag groups are mutually exclusive and, together, exhaustive — every saved flag falls in exactly one of
          them. Rare ({number(rareCount)}) + higher-count ({number(highCount)}) + intermediate ({number(moderateCount)}) ={' '}
          <strong>{number(groupsSum)}</strong>, which equals the {number(enrichedRows.length)} saved flags. The rare predicate
          tests the count and |z| only; it does not itself measure the share of zero-reporting districts, so that share is not
          claimed here.
        </p>
      </Panel>

      {/* Brief visible explanation; the full derivation sits in the expandable details. */}
      <div style={{ margin: '1.25rem 0 1rem 0', padding: '1rem', background: '#fefce8', borderLeft: '4px solid #eab308', borderRadius: '6px' }}>
        <h4 style={{ margin: '0 0 0.35rem 0', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={18} /> Why a single case can produce a z-score of ~{rareZScore.toFixed(2)}
        </h4>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#713f12', lineHeight: 1.5 }}>
          Saved flags use the <strong>sample</strong> standard deviation (n−1 denominator) computed per category across the
          2024 administrative-district cohort. In a sparse category a single positive count makes the cohort variance very
          small, so the resulting z-score is large and <em>mathematically expected</em> rather than evidence of high crime
          volume.
        </p>
        <details style={{ marginTop: '0.6rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: '#854d0e' }}>
            Show the sample-standard-deviation derivation
          </summary>
          <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#713f12', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 0.4rem 0' }}>
              Take a category where N = {number(cohortSize)} districts report and {number(cohortSize - 1)} report <strong>0</strong> cases
              while exactly <strong>1</strong> district reports <strong>1</strong> case.
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              <li>Mean: μ = 1/N ≈ {(1 / (cohortSize || 1)).toFixed(5)}</li>
              <li>Sum of squared deviations: Σ(x−μ)² = (N−1)/N</li>
              <li>Sample variance (n−1 denominator): s² = [(N−1)/N] / (N−1) = 1/N, so s = 1/√N ≈ {rareStd.toFixed(4)}</li>
              <li>Z-score: z = (1 − μ)/s = (N−1)/√N ≈ <strong>{rareZScore.toFixed(4)}</strong></li>
            </ul>
            <p style={{ margin: '0.4rem 0 0 0' }}>
              With N = {number(cohortSize)} this is z ≈ {rareZScore.toFixed(2)}. The saved artifact stores this value directly
              (e.g. z = 27.7849); the reference mean and standard deviation shown per row are the stored values and are never
              recomputed from rounded figures.
            </p>
          </div>
        </details>
      </div>

      {/* Worked examples located through search + tab + detail. */}
      <div style={{ margin: '0 0 1rem 0', padding: '0.85rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
          Worked examples (found by search + tab, then opened in the detail panel)
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button small"
            style={{ whiteSpace: 'normal', textAlign: 'left', maxWidth: '100%', height: 'auto' }}
            disabled={!sataraRow}
            onClick={() => loadExample(sataraRow, 'rare_category')}
          >
            Rare: Satara (Maharashtra) · {sataraRow ? number(sataraRow.cases) : '—'} case
            {sataraRow && sataraRow.cases === 1 ? '' : 's'}, z ≈ {sataraRow ? sataraRow.zScore.toFixed(2) : '—'}
          </button>
          <button
            type="button"
            className="button small"
            style={{ whiteSpace: 'normal', textAlign: 'left', maxWidth: '100%', height: 'auto' }}
            disabled={!northWestRow}
            onClick={() => loadExample(northWestRow, 'high_volume')}
          >
            Higher-count: North-West (Delhi) · Other Thefts · {northWestRow ? number(northWestRow.cases) : '—'} cases,
            z ≈ {northWestRow ? northWestRow.zScore.toFixed(2) : '—'}
          </button>
        </div>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted, #6b7280)', lineHeight: 1.5 }}>
          Satara is one of four rare flags tied at the maximum z ≈ {rareZScore.toFixed(2)}; ties are ordered by reporting-unit
          then category name, and Satara is the named research example. Each button selects the matching saved rows and opens
          the exact row in the detail panel — it locates a saved flag and never re-derives a z-score.
        </p>
      </div>

      {method?.status === 'available' ? (
        <Panel
          title={`Identified statistical flags (${filteredRows.length} matching)`}
          subtitle="Selecting a row opens its stored reference distribution. The reference mean/std are fixed by the saved run; filters only choose which saved flags appear."
        >
          <DataTable
            searchable={false}
            rows={filteredRows}
            columns={[
              {
                key: 'region',
                label: 'Reporting Unit',
                render: (r: any) => (
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontWeight: 600, color: 'var(--color-primary, #0f766e)' }}
                    onClick={() => setSelectedAnomaly(r)}
                  >
                    {String(r.region)}
                  </button>
                )
              },
              { key: 'state_name', label: 'State / UT' },
              {
                key: 'cleanCategory',
                label: 'Crime Category',
                render: (r: any) => (
                  <span title={String(r.category)}>
                    {String(r.cleanCategory)}
                  </span>
                )
              },
              {
                key: 'cases',
                label: 'Reported Cases',
                render: (r: any) => (
                  <strong style={{ color: Number(r.cases) > 50 ? '#b91c1c' : '#374151' }}>
                    {number(r.cases as number)}
                  </strong>
                )
              },
              {
                key: 'zScore',
                label: 'Cohort Z-Score',
                render: (r: any) => (
                  <Badge tone={Math.abs(Number(r.zScore)) > 20 ? 'amber' : 'neutral'}>
                    {Number(r.zScore) >= 0 ? '+' : ''}{Number(r.zScore).toFixed(2)}σ
                  </Badge>
                )
              },
              {
                key: 'flagType',
                label: 'Flag Type',
                render: (r: any) => (
                  <Badge tone={r.isRare ? 'amber' : 'neutral'}>
                    {String(r.flagType)}
                  </Badge>
                )
              },
              {
                key: 'actions',
                label: 'Inspect',
                render: (r: any) => (
                  <button
                    type="button"
                    className="button small"
                    onClick={() => setSelectedAnomaly(r)}
                  >
                    Inspect
                  </button>
                )
              }
            ]}
          />
        </Panel>
      ) : (
        <div className="empty">
          <h2>Anomaly screening results unavailable</h2>
          <p>{method?.reason ?? 'No verified anomaly results found for this cohort.'}</p>
        </div>
      )}

      {/* Selected Observation Inspection Drawer */}
      {selectedAnomaly && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '440px',
            maxWidth: '90vw',
            height: '100vh',
            background: 'var(--color-surface, #ffffff)',
            boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
            zIndex: 100,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem' }}>
            <div>
              <span className="eyebrow" style={{ color: '#b45309' }}>{selectedAnomaly.flagType}</span>
              <h2 style={{ margin: '0.2rem 0', fontSize: '1.3rem' }}>{selectedAnomaly.region}</h2>
              <small style={{ color: '#6b7280' }}>{selectedAnomaly.state_name}</small>
            </div>
            <button className="text-button" onClick={() => setSelectedAnomaly(null)}><X size={20} /></button>
          </div>

          <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Evaluated Category</div>
            <h3 style={{ margin: '0.2rem 0 0.4rem 0', fontSize: '1.1rem' }}>{selectedAnomaly.cleanCategory}</h3>
            <div style={{ fontSize: '0.75rem', color: '#4b5563', fontStyle: 'italic', overflowWrap: 'anywhere' }}>
              Source label: {selectedAnomaly.category}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{ background: '#f9fafb', padding: '0.6rem', borderRadius: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Reported Cases</span>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#b91c1c' }}>
                {number(selectedAnomaly.cases)}
              </div>
            </div>
            <div style={{ background: '#f9fafb', padding: '0.6rem', borderRadius: '4px' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Z-Score</span>
              <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#0f766e' }}>
                {Number(selectedAnomaly.zScore) >= 0 ? '+' : ''}{Number(selectedAnomaly.zScore).toFixed(2)}σ
              </div>
            </div>
          </div>

          <div style={{ background: '#f9fafb', padding: '0.6rem 0.75rem', borderRadius: '4px', fontSize: '0.82rem', color: '#374151' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
              <span>Reference mean (μ)</span>
              <strong>{number(selectedAnomaly.referenceMean, 4)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.2rem' }}>
              <span>Reference sample std (σ)</span>
              <strong>{number(selectedAnomaly.referenceStd, 4)}</strong>
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: '#6b7280', lineHeight: 1.45 }}>
              Stored values from the saved 2024 run across {number(cohortSize)} administrative districts; the z-score is read
              from the artifact rather than recomputed from these rounded figures.
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#374151' }}>
            <h4 style={{ margin: '0.5rem 0 0.3rem 0', fontSize: '0.9rem' }}>Reference Distribution Context</h4>
            {selectedAnomaly.isRare ? (
              <p>
                This flag satisfies the rare-category predicate (≤ 3 cases and |z| &gt; 10): a small positive count in a
                category with a near-zero national mean ({number(selectedAnomaly.referenceMean, 4)}), so the cohort variance is
                tiny. {selectedAnomaly.region}’s record of {number(selectedAnomaly.cases)} case
                {selectedAnomaly.cases === 1 ? '' : 's'} gives z = {Number(selectedAnomaly.zScore).toFixed(2)}σ. The predicate
                tests the count and |z| rather than the share of zero-reporting districts, so that share is not asserted; the
                flag reflects category rarity, not high recorded volume.
              </p>
            ) : (
              <p>
                {selectedAnomaly.region}’s recorded count of {number(selectedAnomaly.cases)} cases sits{' '}
                +{Number(selectedAnomaly.zScore).toFixed(2)} standard deviations above the national category mean (
                {number(selectedAnomaly.referenceMean, 4)}). This indicates an unusually elevated reporting volume in 2024
                relative to the other districts in this cohort.
              </p>
            )}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="button primary"
              style={{ flex: 1 }}
              onClick={() => {
                const parts = String(selectedAnomaly.region).split(' · ');
                setDrawerRegion(parts[1] || parts[0]);
              }}
            >
              Inspect Complete Region Profile
            </button>
            <button className="button" onClick={() => setSelectedAnomaly(null)}>Close</button>
          </div>
        </div>
      )}

      <Notice>
        <strong>Cross-sectional vs temporal changes:</strong> These flags identify statistical deviations within the 2024
        cross-sectional cohort. They are not year-over-year changes or proof of administrative or policing abnormalities, and
        the filters select saved flags rather than recalculating the national reference distribution.
      </Notice>

      <RegionDetailDrawer
        regionName={drawerRegion}
        onClose={() => setDrawerRegion(null)}
      />
    </>
  );
}
