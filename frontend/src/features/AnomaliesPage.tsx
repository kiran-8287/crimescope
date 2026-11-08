import { useState, useMemo } from 'react';
import { TriangleAlert, Info, X, HelpCircle } from 'lucide-react';
import { useAnalytics } from '../context/useAnalytics';
import { PageTitle } from '../components/Layout';
import { Notice, Filters, Panel, Badge, ExportButton, RegionDetailDrawer, Stat } from '../components/UI';
import { DataTable } from '../components/DataTable';
import { categoryContextLabelByRaw, categoryContextStatus } from '../utils/categories';
import { number } from '../utils/format';

type AnomalyFilterType = 'all' | 'rare_category' | 'high_volume' | 'moderate';

export default function AnomaliesPage() {
  const { data, filters } = useAnalytics();
  const method = data.methods?.anomalies;
  const rows: any[] = method?.result ?? [];

  const [activeTab, setActiveTab] = useState<AnomalyFilterType>('all');
  const [selectedAnomaly, setSelectedAnomaly] = useState<any | null>(null);
  const [drawerRegion, setDrawerRegion] = useState<string | null>(null);

  const labels = new Map(data.meta.categories?.map(c => [c.id, c.label]));

  // 2024 administrative-district cohort the z-scores are computed against. Derived
  // from the loaded data (not hardcoded) so it cannot drift from the saved run.
  const cohortSize = data.regions.filter(r => r.year === 2024 && r.regionType === 'administrative_district').length;
  // Matches the saved z-score convention: anomaly.py standardises with the SAMPLE
  // standard deviation (n-1 denominator). For one positive case among N-1 zeros
  // that evaluates to (N-1)/√N, not the population form √(N-1).
  const rareZScores = cohortSize > 1 ? (cohortSize - 1) / Math.sqrt(cohortSize) : 0;

  // Process rows with distribution context
  const enrichedRows = useMemo(() => {
    return rows.map((r: any, idx: number) => {
      const val = Number(r.value ?? 0);
      const z = Number(r.z_score ?? 0);
      // Rare category: 1 to 3 cases with high z-score (|z| > 10) indicates sparse category where almost all units reported zero
      const isRare = val <= 3 && Math.abs(z) > 10;
      const isHighVolume = !isRare && val >= 20;
      const isModerate = !isRare && !isHighVolume;
      return {
        ...r,
        id: `${r.region_id}-${r.category_id || r.category}-${idx}`,
        cleanCategory: categoryContextLabelByRaw(data, r.category, 2024),
        cases: val,
        zScore: z,
        flagType: isRare ? 'Rare Category Report' : isHighVolume ? 'High Recorded Volume' : 'Moderate Volume Outlier',
        isRare,
        isHighVolume,
        isModerate,
        cohortSize,
        zeroPctEstimate: isRare ? '> 99.5%' : val > 100 ? '< 50%' : '~ 85%'
      };
    });
  }, [rows, data, cohortSize]);

  // Apply frontend filters
  const filteredRows = enrichedRows.filter((r: any) => {
    if (filters.state !== 'all' && r.state_name !== filters.state) return false;
    if (filters.category !== 'all' && r.category !== labels.get(filters.category)) return false;
    if (activeTab === 'rare_category') return r.isRare;
    if (activeTab === 'high_volume') return r.isHighVolume;
    if (activeTab === 'moderate') return r.isModerate;
    return true;
  });

  // Export carries the same contextual metadata the table shows: stable category
  // id (resolved from the verified taxonomy by exact source label), original source
  // label, contextual display label, year, reporting-unit identity, the z-score
  // inputs, and the active release reference.
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
      cohort_mean: r.category_mean,
      cohort_std: r.category_std,
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
        description="Statistically elevated observations (|z| ≥ 2.5) across the 2024 national district cohort."
        action={<ExportButton rows={exportRows} name="unusual_observations_2024" />}
      />

      <Filters fixedYear={2024} />

      <div className="stats">
        <Stat
          label="Total Flagged Observations"
          value={number(rows.length)}
          detail="2024 cohort records with |z| ≥ 2.5 against category cohort"
        />
        <Stat
          label="Rare-Category Flags"
          value={number(enrichedRows.filter(r => r.isRare).length)}
          detail="Small positive counts in categories where > 99% of units report zero"
        />
        <Stat
          label="High-Volume Outliers"
          value={number(enrichedRows.filter(r => !r.isRare && r.cases >= 20).length)}
          detail="Large case counts in established, widely-reported offenses"
        />
        <Stat
          label="Methodology & Threshold"
          value="|z| ≥ 2.5"
          detail={`Sample mean and standard deviation across ${number(cohortSize)} administrative districts`}
        />
      </div>

      {/* Mathematical callout explaining how a single case can yield a large z-score */}
      <div style={{ margin: '1.25rem 0 1rem 0', padding: '1rem', background: '#fefce8', borderLeft: '4px solid #eab308', borderRadius: '6px' }}>
        <h4 style={{ margin: '0 0 0.3rem 0', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={18} /> Mathematical Note: Why 1 Case Can Produce a Z-Score of ~{rareZScores.toFixed(2)}
        </h4>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#713f12', lineHeight: 1.5 }}>
          In a national cohort of N = {number(cohortSize)} administrative districts, if {number(cohortSize - 1)} districts report <strong>0</strong> cases and exactly <strong>1</strong> district reports <strong>1</strong> case, the cohort mean is μ = 1/N ≈ {(1 / (cohortSize || 1)).toFixed(5)} and the standard deviation (sample, n−1 denominator) is σ = √(1/N) ≈ {(cohortSize > 0 ? 1 / Math.sqrt(cohortSize) : 0).toFixed(4)}. The resulting z-score is z = (1 − μ) / σ = (N − 1)/√N ≈ {rareZScores.toFixed(2)}. Thus, extreme z-scores with small positive counts are <em>mathematically expected for sparse categories</em> and reflect category rarity rather than high crime volume.
        </p>
      </div>

      {/* Tab Filter Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`button ${activeTab === 'all' ? 'primary' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Flagged Observations ({enrichedRows.length})
        </button>
        <button
          type="button"
          className={`button ${activeTab === 'rare_category' ? 'primary' : ''}`}
          onClick={() => setActiveTab('rare_category')}
        >
          Rare-Category Flags (≤3 cases, |z| &gt; 10) ({enrichedRows.filter(r => r.isRare).length})
        </button>
        <button
          type="button"
          className={`button ${activeTab === 'high_volume' ? 'primary' : ''}`}
          onClick={() => setActiveTab('high_volume')}
        >
          High-Volume Outliers (≥20 cases) ({enrichedRows.filter(r => r.isHighVolume).length})
        </button>
        <button
          type="button"
          className={`button ${activeTab === 'moderate' ? 'primary' : ''}`}
          onClick={() => setActiveTab('moderate')}
        >
          Intermediate / Moderate (4–19 cases) ({enrichedRows.filter(r => r.isModerate).length})
        </button>
      </div>

      {method?.status === 'available' ? (
        <Panel
          title={`Identified Statistical Flags (${filteredRows.length} matching)`}
          subtitle="Showing observations differing from their national category distribution. Click any row to inspect reference distribution."
        >
          <DataTable
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
                    +{Number(r.zScore).toFixed(2)}σ
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
            <div style={{ fontSize: '0.75rem', color: '#4b5563', fontStyle: 'italic' }}>
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
                +{selectedAnomaly.zScore.toFixed(2)}σ
              </div>
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#374151' }}>
            <h4 style={{ margin: '0.5rem 0 0.3rem 0', fontSize: '0.9rem' }}>Reference Distribution Context</h4>
            {selectedAnomaly.isRare ? (
              <p>
                This category is virtually unrecorded across the nation: over 99% of the {number(cohortSize)} administrative districts reported exactly <strong>0</strong> cases in 2024. Because national variance is extremely small, {selectedAnomaly.region}’s record of {selectedAnomaly.cases} case{selectedAnomaly.cases > 1 ? 's' : ''} creates a $z$-score of +{selectedAnomaly.zScore.toFixed(2)}σ. This reflects category rarity rather than high recorded volume.
              </p>
            ) : (
              <p>
                In this category, reporting is widespread nationally. {selectedAnomaly.region}’s reported count of {number(selectedAnomaly.cases)} cases exceeds the cohort mean by +{selectedAnomaly.zScore.toFixed(2)} standard deviations, indicating unusually elevated reporting volume in 2024.
              </p>
            )}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="button primary"
              style={{ flex: 1 }}
              onClick={() => {
                const parts = selectedAnomaly.region.split(' · ');
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
        <strong>Cross-sectional vs temporal changes:</strong> These flags identify statistical deviations within the 2024 cross-sectional cohort. They are not year-over-year changes or proof of administrative or policing abnormalities.
      </Notice>

      <RegionDetailDrawer
        regionName={drawerRegion}
        onClose={() => setDrawerRegion(null)}
      />
    </>
  );
}
