import { useState } from 'react';
import { X, Info } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { PageTitle } from '../components/Layout';
import { Panel, Notice, Badge, UnitTypeBadge, ExportButton, Filters, RegionDetailDrawer, Stat } from '../components/UI';
import { Bars, DivergingBars, colors } from '../components/Charts';
import { ClusterProjection, clusterColor } from '../components/ClusterProjection';
import { CentroidHeatmap } from '../components/CentroidHeatmap';
import { DataTable } from '../components/DataTable';
import { joinPcaAndKmeans } from '../utils/clusterProjection';
import { categoryContextLabelByRaw } from '../utils/categories';
import { number } from '../utils/format';

// The saved k-means artifact stores each cluster centroid as a map of feature
// label → mean standardized value (log1p count + featurewise population z-score
// space, ddof = 0). These are transformed deviations, not raw case counts.
type Centroid = Record<string, number>;

// Signed display for a centroid deviation: "+1.04" / "-1.47" / "0". Uses the
// shared number() formatter so a rounded negative zero never renders as "-0.00"
// and a value never carries a double sign ("+-").
function signed(value: number, digits = 2): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${number(rounded, digits)}`;
}

// Verified k=3 findings (docs/findings.md): median official-total cases per unit
// for the 774-unit 2024 cohort. Keyed by cluster_id and shown ONLY when k = 3,
// because the saved k-means artifact stores no per-unit counts and no other k
// has verified medians. Never rendered as a synthetic feature-based index.
const K3_OFFICIAL_TOTAL_MEDIAN: Record<number, number> = { 0: 5309, 1: 159.5, 2: 2974.5 };

function deriveProfile(centroid: Centroid) {
  const entries = Object.entries(centroid ?? {}).map(([label, value]) => [label, Number(value)] as [string, number]);
  const mean = entries.length ? entries.reduce((sum, [, v]) => sum + v, 0) / entries.length : 0;
  const byValueDesc = [...entries].sort((a, b) => b[1] - a[1]);
  const byMagnitude = [...entries].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const positive = byValueDesc.filter(([, v]) => v > 0).slice(0, 5);
  const negative = byValueDesc.filter(([, v]) => v < 0).reverse().slice(0, 5);
  return { count: entries.length, mean, positive, negative, byMagnitude };
}

// One short sentence driven purely by the selected k's saved centroid. The side
// (elevated vs depressed) is chosen from the largest-magnitude deviations, so a
// cluster whose strongest deviations are negative is described as lower, never
// headlined by a tiny positive value.
function describeCluster(profile: ReturnType<typeof deriveProfile>, labelOf: (raw: string) => string): string {
  const top = profile.byMagnitude.slice(0, 5);
  if (!top.length) return 'No distinguishing features recorded in the saved centroid.';
  const pos = top.filter(([, v]) => v > 0);
  const neg = top.filter(([, v]) => v < 0);
  const posMag = pos.reduce((sum, [, v]) => sum + v, 0);
  const negMag = neg.reduce((sum, [, v]) => sum + Math.abs(v), 0);
  if (posMag === 0 && negMag === 0) return 'Centroid deviations are effectively zero across the standardized features.';
  const elevated = posMag >= negMag;
  const lead = (elevated ? pos : neg).slice(0, 3);
  const names = lead.map(([label]) => labelOf(label));
  if (!names.length) return 'Near the national average across the standardized features.';
  return `Most distinguished by ${elevated ? 'higher' : 'lower'}-than-average values on ${names.join(', ')}.`;
}

// The artifact's assignment records carry a "State · District" display string.
function splitRegion(region: unknown): { name: string; state: string } {
  const value = String(region ?? '');
  const parts = value.split(' · ');
  return parts.length >= 2 ? { state: parts[0], name: parts.slice(1).join(' · ') } : { name: value, state: '—' };
}

export default function ClustersPage() {
  const { data } = useData();
  const [searchParams] = useSearchParams();
  const urlK = Number(searchParams.get('k'));
  const initialK = [3, 4, 5].includes(urlK) ? urlK : 3;
  const [k, setK] = useState<number>(initialK);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [drawerRegion, setDrawerRegion] = useState<string | null>(null);

  // State selection for hierarchical clustering
  const [hierarchicalState, setHierarchicalState] = useState<string>('Andhra Pradesh');

  const km = data.methods?.kmeans;
  const pca = data.methods?.pca;
  const hier = data.methods?.hierarchical;

  if (km?.status !== 'available') {
    return (
      <>
        <PageTitle
          eyebrow="SIMILARITY, NOT RANKING"
          title="Cluster profiles"
          description="Saved groupings of 2024 regional crime profiles."
        />
        <Filters fixedYear={2024} hideCategory />
        <div className="empty">
          <h2>K-means clustering result unavailable</h2>
          <p>{km?.reason ?? 'No verified saved K-means result is available for this cohort.'}</p>
        </div>
      </>
    );
  }

  const result = km.results?.[k];
  if (!result) {
    return (
      <>
        <PageTitle
          eyebrow="SIMILARITY, NOT RANKING"
          title="Cluster profiles"
          description="Saved groupings of 2024 regional crime profiles."
        />
        <Filters fixedYear={2024} hideCategory />
        <div className="empty">
          <h2>K-means result unavailable</h2>
          <p>No saved K-means result is available for k = {k}.</p>
        </div>
      </>
    );
  }

  const clusters: any[] = result.clusters ?? [];
  const assignments: any[] = result.assignment_records ?? [];
  const cohortSize: number = result.n_regions ?? assignments.length;
  const nCategories: number = result.n_categories ?? 0;
  const seed = result.seed ?? 42;

  // Join saved PCA scores with saved K-means assignments by stable unit id.
  // PCA coordinates and axis bounds are independent of k and stay fixed across
  // k = 3, 4, 5. A join failure produces a chart-level error, never a fabricated
  // cluster for an unmatched point.
  const joinResult = joinPcaAndKmeans(pca, km, k);

  const pcaResult = pca?.result;
  const variance = pcaResult?.explained_variance_ratio ?? [];
  const pc1Pct = Number(variance[0] ?? 0) * 100;
  const pc2Pct = Number(variance[1] ?? 0) * 100;
  const combinedPct = pc1Pct + pc2Pct;

  // Heatmap is unavailable only when the saved assignments carry no centroid
  // metadata; the scatter and table remain usable in that case.
  const hasCentroids = clusters.some((c: any) => c.centroid && Object.keys(c.centroid ?? {}).length > 0);
  const centroidUnavailable = hasCentroids
    ? null
    : 'The saved K-means assignments are available but no centroid values were recorded for this run, so the distinguishing-feature heatmap cannot be drawn.';

  // Members grouped by cluster, using real unit names parsed from the artifact.
  const membersByCluster = new Map<number, any[]>();
  for (const a of assignments) {
    const cId = Number(a.cluster_id);
    const { name, state } = splitRegion(a.region);
    if (!membersByCluster.has(cId)) membersByCluster.set(cId, []);
    membersByCluster.get(cId)!.push({ ...a, region_name: a.region_name ?? name, state_name: a.state_name ?? state });
  }

  // Smallest cluster drives the standardization caveat note.
  const smallest = clusters.reduce((min: any, c: any) => (min == null || c.size < min.size ? c : min), null);

  // Active cluster members for the inspection table
  const activeClusterMembers = selectedClusterId !== null
    ? (membersByCluster.get(selectedClusterId) ?? []).filter(m =>
        memberSearch.trim()
          ? `${m.region_name} ${m.state_name}`.toLowerCase().includes(memberSearch.toLowerCase())
          : true
      )
    : [];

  // Inertia across k=3, 4, 5
  const inertiaStats = [3, 4, 5].map(kVal => {
    const res = km.results?.[kVal];
    return { k: kVal, inertia: res?.inertia ?? null };
  });

  // State hierarchical clustering results
  const hierResultsByState = hier?.resultsByState ?? {};
  const hierStates = Object.keys(hierResultsByState).sort();
  const missingHierStates: string[] = hier?.missingStates ?? [];
  const activeStateHier = hierResultsByState[hierarchicalState];

  return (
    <>
      <PageTitle
        eyebrow="SIMILARITY, NOT RANKING"
        title="Cluster profiles & similarity"
        description={`K-means groupings of 2024 regional profiles across ${result.n_regions} reporting units in standardized feature space.`}
        action={<ExportButton rows={assignments.map((a: any) => ({ reporting_unit_id: a.region_id, reporting_unit: a.region, cluster_id: a.cluster_id, cluster_number: Number(a.cluster_id) + 1, k, year: 2024, release: data.meta.releaseId }))} name={`kmeans_clusters_k${k}_2024`} />}
      />

      <Filters fixedYear={2024} hideCategory />

      <Notice>
        Model fitted nationally in 2024 on the {number(result.n_regions)}-unit cohort. The State/UT and reporting-unit
        controls do not refit or rescope these clusters — the fitted model is fixed; the controls affect other pages only.
      </Notice>

      {/* Variance / cohort banner */}
      <div className="stats">
        <Stat
          label="Selected Model"
          value={`K = ${k} Clusters`}
          detail={`K-means · within-cluster squared-distance objective: ${number(result.inertia, 1)}`}
        />
        <Stat
          label="Input Cohort"
          value={`${number(result.n_regions)} Units`}
          detail="2024 national reporting units with valid leaf records"
        />
        <Stat
          label="Feature Dimensions"
          value={`${nCategories} Categories`}
          detail="Log1p count + per-feature population z-score (ddof = 0)"
        />
        <Stat
          label="Initialization Seed"
          value={`Seed ${seed}`}
          detail="Fixed seed for reproducible initialization — reproducibility metadata, not a stability measure"
        />
      </div>

      {/* Run controls: number of clusters (k). Changing k updates the projection,
          heatmap, size summary and membership table together. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Number of clusters (k):</label>
        <select
          value={k}
          onChange={e => {
            setK(Number(e.target.value));
            setSelectedClusterId(null);
            setMemberSearch('');
          }}
          style={{ padding: '0.3rem 0.5rem' }}
        >
          {[3, 4, 5].map(n => (
            <option key={n} value={n}>k = {n}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
          {number(cohortSize)} units · K-means fitted on {number(nCategories)} transformed features · displayed in PCA space
        </span>
      </div>

      {/* 1. Cluster membership in PCA space — first analytical chart */}
      <Panel
        title="Cluster membership in PCA space"
        subtitle={`Saved K-means assignments (k = ${k}) plotted on the first two saved PCA axes. Points are coloured by cluster; the legend shows unit counts per cluster.`}
      >
        <ClusterProjection
          points={joinResult.points}
          error={joinResult.error}
          cohortSize={joinResult.cohortSize}
          k={k}
          pc1Pct={pc1Pct}
          pc2Pct={pc2Pct}
          combinedPct={combinedPct}
          featureCount={nCategories}
          onSelectUnit={region => setDrawerRegion(region)}
        />
      </Panel>

      {/* 2. Centroid heatmap — offence features that distinguish the clusters */}
      <Panel
        title="Offence features that distinguish the clusters"
        subtitle={`Saved k = {k} centroid values for the most distinguishing offence features (standardized σ, not case counts).`}
      >
        <CentroidHeatmap clusters={clusters} k={k} cohortSize={cohortSize} data={data} unavailableReason={centroidUnavailable} />
      </Panel>

      {/* 3. Existing cluster sizes, diagnostics, profiles, membership table */}
      <div className="grid two-one" style={{ marginTop: '1rem' }}>
        <Panel
          title={`Cluster membership sizes (k = ${k})`}
          subtitle="Distribution of reporting units across the selected clusters, read from the saved k artifact."
        >
          <Bars
            items={clusters.map((c, i) => ({
              label: `Cluster ${c.cluster_id + 1} (${number(c.size)} units)`,
              value: c.size,
              color: clusterColor(c.cluster_id),
            }))}
            unit="units"
          />
        </Panel>

        <Panel
          title="Inertia objective across k"
          subtitle="Within-cluster sum of squared distances to each centroid."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            {inertiaStats.map(stat => (
              <div key={stat.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontWeight: stat.k === k ? 700 : 400 }}>
                  k = {stat.k} clusters {stat.k === k ? '★ (Active)' : ''}
                </span>
                <strong>{stat.inertia ? number(stat.inertia, 1) : 'N/A'}</strong>
              </div>
            ))}
            <p className="panel-note" style={{ margin: 0 }}>
              Inertia is the within-cluster sum of squared distances to each centroid (the K-means objective). In general
              this objective is non-increasing as k rises, but independently fitted local K-means runs need not follow that
              ordering. Either way it is not a goodness-of-fit score, and a lower objective alone does not establish an
              optimal k. The saved run provides k = 3, 4 and 5; k = {k} is the selected configuration, not a proven optimum.
            </p>
          </div>
        </Panel>
      </div>

      {/* Cluster cards */}
      <div style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Cluster profiles (k = {k})</h3>
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Cluster numbers are assigned by the algorithm and carry no ordering, size ranking or severity meaning. Every value
          below is read from the saved k = {k} artifact.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {clusters.map((c: any) => {
            const profile = deriveProfile(c.centroid as Centroid);
            const share = cohortSize ? (c.size / cohortSize) * 100 : 0;
            const sentence = describeCluster(profile, raw => categoryContextLabelByRaw(data, raw, 2024));
            const bars = profile.byMagnitude.slice(0, 6).map(([label, value]) => ({ label: categoryContextLabelByRaw(data, label, 2024), value }));
            const median = k === 3 ? K3_OFFICIAL_TOTAL_MEDIAN[c.cluster_id] : undefined;
            const active = selectedClusterId === c.cluster_id;

            return (
              <div
                key={c.cluster_id}
                style={{
                  background: 'var(--color-surface, #ffffff)',
                  border: active ? '2px solid var(--color-primary, #0f766e)' : '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '8px',
                  padding: '1.1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.7rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <span className="eyebrow" style={{ color: clusterColor(c.cluster_id), fontWeight: 700 }}>
                      Cluster {c.cluster_id + 1}
                    </span>
                    <h4 style={{ margin: '0.15rem 0 0 0', fontSize: '1.1rem' }}>
                      {number(c.size)} units · {share.toFixed(1)}% of cohort
                    </h4>
                  </div>
                  <Badge tone={c.size <= 10 ? 'amber' : 'green'}>{number(c.size)} units</Badge>
                </div>

                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0, lineHeight: 1.4 }}>{sentence}</p>

                {median !== undefined && (
                  <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: 0 }}>
                    Median official reported total: {number(median, 1)} cases per unit (k = 3, 774-unit 2024 cohort).
                  </p>
                )}

                <div style={{ background: '#f9fafb', padding: '0.6rem', borderRadius: '4px' }}>
                  <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                    Largest centroid deviations (standardized σ):
                  </div>
                  <DivergingBars items={bars} unit="σ" />
                  <div style={{ color: '#6b7280', marginTop: '0.4rem', fontSize: '0.72rem' }}>
                    Standardized mean offsets (log1p + z-score) from the saved centroid, not raw case counts.
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
                  <button
                    type="button"
                    className={`button small ${active ? 'primary' : ''}`}
                    style={{ width: '100%' }}
                    onClick={() => {
                      setSelectedClusterId(active ? null : c.cluster_id);
                      setMemberSearch('');
                    }}
                  >
                    {active ? 'Hide members' : `View members (${number(c.size)})`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Methodology and interpretation (expandable) */}
      <details
        className="method-details"
        style={{ marginTop: '1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.75rem 1rem' }}
      >
        <summary style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={16} /> Method, interpretation and representative units
        </summary>
        <div style={{ fontSize: '0.85rem', lineHeight: 1.5, color: '#374151', marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <p style={{ margin: 0 }}>
            <strong>Model scope.</strong> K-means is fitted nationally on the {number(result.n_regions)}-unit 2024 cohort on
            log1p(count) then per-feature population standardization (ddof = 0) across {nCategories} features. The
            model is fixed; changing the year, state or reporting-unit controls does not refit or rescope it.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Inertia and k.</strong> Inertia is the within-cluster sum of squared distances to each centroid. A lower
            value alone does not establish an optimal k. Seed {seed} fixes the initialization for reproducibility; it is not a
            stability or robustness measure.
          </p>
          {smallest && (
            <p style={{ margin: 0 }}>
              <strong>Smallest group at k = {k}:</strong> Cluster {smallest.cluster_id + 1} (n = {number(smallest.size)}). Its
              deviations are read from the saved k = {k} centroid. Because each feature is standardized on its own national
              distribution, a category with near-zero national variance can produce a large standardized value from a small
              recorded count. These separations describe a position in the transformed feature space, not overall crime level,
              and do not by themselves indicate a distinct policy or demographic profile.
            </p>
          )}
          <p style={{ margin: 0 }}>
            <strong>Representative units.</strong> The “View members” register lists units in the order stored by the saved
            k = {k} artifact. The artifact records no per-unit distances, so those members are <em>not</em> “nearest centroid”
            units. The findings document derives separate nearest-centroid representatives by recomputing distances in the
            fitted transformed space; that is a different concept and is not computed by this dashboard.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Interpretation.</strong> Clusters are mathematical proximity in the transformed 2024 profiles; they are not
            urban/rural, safe/unsafe or risk categories, and the cluster numbers carry no severity meaning.
          </p>
        </div>
      </details>

      {/* Expandable Member Table */}
      {selectedClusterId !== null && (
        <div style={{ marginTop: '1.25rem' }}>
          <Panel
            title={`Cluster ${selectedClusterId + 1} members (${activeClusterMembers.length} units) · k = ${k}`}
            subtitle="Searchable member register in saved artifact order (not nearest-centroid units)."
            action={
              <button className="text-button" onClick={() => setSelectedClusterId(null)}>
                <X size={16} /> Close
              </button>
            }
          >
            <div style={{ marginBottom: '0.75rem', maxWidth: '380px' }}>
              <input
                type="search"
                aria-label="Search member districts or states"
                placeholder="Search member districts or states…"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                style={{ width: '100%', height: '38px', boxSizing: 'border-box', padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
              />
            </div>

            <DataTable
              rows={activeClusterMembers}
              columns={[
                {
                  key: 'region_name',
                  label: 'Reporting Unit',
                  render: (r: any) => (
                    <button
                      type="button"
                      className="text-button"
                      style={{ fontWeight: 600, color: 'var(--color-primary, #0f766e)' }}
                      onClick={() => setDrawerRegion(String(r.region_name))}
                    >
                      {String(r.region_name)}
                    </button>
                  )
                },
                { key: 'state_name', label: 'State / UT' },
                {
                  key: 'region_type',
                  label: 'Unit Type',
                  render: (r: any) => (
                    <UnitTypeBadge regionType={r.region_type as string} verificationStatus={r.verificationStatus as string} />
                  )
                }
              ]}
            />
          </Panel>
        </div>
      )}

      {/* State-Scoped Hierarchical Clustering Section */}
      <div style={{ marginTop: '1.5rem' }}>
        <Panel
          title="State-scoped hierarchical clustering (Ward linkage)"
          subtitle="Agglomerative Ward linkage fitted separately within each state/UT's district cohort; districts are never merged across state boundaries."
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select State / UT:</label>
              <select
                value={hierarchicalState}
                onChange={e => setHierarchicalState(e.target.value)}
                style={{ padding: '0.3rem 0.5rem', maxWidth: '100%' }}
              >
                {hierStates.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          }
        >
          {activeStateHier ? (
            <div>
              <p style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.5rem' }}>
                Ward clustering for <strong>{hierarchicalState}</strong> ({number(activeStateHier.n_regions)} eligible
                districts, cut into at most {activeStateHier.max_clusters} groups). Preprocessing matches the saved artifact:
                log1p(count) then per-feature population-standard z-score computed within this state's own district cohort
                (ddof = 0) — not the national standardization used for the PCA and k-means above. Ward linkage minimizes the
                within-cluster increase in squared error.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {(activeStateHier.clusters ?? []).map((c: any) => (
                  <div key={c.cluster_id} style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <strong>Sub-cohort {c.cluster_id + 1}</strong>
                      <Badge tone="neutral">{number(c.size)} units</Badge>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                      {(c.regions ?? []).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="muted">
              No Ward result is recorded for {hierarchicalState}.
            </div>
          )}
          <p className="panel-note" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            Ward is fitted only for state/UTs with at least two eligible districts.
            {missingHierStates.length > 0 ? ` No result is recorded for ${missingHierStates.join(', ')} (fewer than two eligible districts).` : ''}
          </p>
        </Panel>
      </div>

      <Notice>
        <strong>Similarity vs safety:</strong> Clusters represent mathematical proximity in transformed 2024 category profiles.
        They group units with similar profiles, not safe or unsafe jurisdictions. Cluster numbers and sizes carry no ordinal or
        severity meaning.
      </Notice>

      <RegionDetailDrawer
        regionName={drawerRegion}
        kmeansK={k}
        onClose={() => setDrawerRegion(null)}
      />
    </>
  );
}
