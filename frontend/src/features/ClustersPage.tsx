import { useState } from 'react';
import { X, Info } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PageTitle } from '../components/Layout';
import { Panel, Notice, Badge, UnitTypeBadge, ExportButton, Filters, RegionDetailDrawer, Stat } from '../components/UI';
import { Bars, colors } from '../components/Charts';
import { DataTable } from '../components/DataTable';
import { categoryContextLabelByRaw } from '../utils/categories';

// The saved k-means artifact stores each cluster's centroid as a map of feature
// label → mean standardized value (log1p + per-feature z-score space). These are
// transformed deviations, not raw case counts.
type Centroid = Record<string, number>;

function deriveProfile(centroid: Centroid) {
  const entries = Object.entries(centroid ?? {});
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const mean = entries.length ? entries.reduce((sum, [, v]) => sum + v, 0) / entries.length : 0;
  return {
    count: entries.length,
    mean,
    positive: sorted.slice(0, 3),
    negative: sorted.slice(-3).reverse(),
  };
}

// The artifact's assignment records carry a "State · District" display string.
function splitRegion(region: unknown): { name: string; state: string } {
  const value = String(region ?? '');
  const parts = value.split(' · ');
  return parts.length >= 2 ? { state: parts[0], name: parts.slice(1).join(' · ') } : { name: value, state: '—' };
}

export default function ClustersPage() {
  const { data } = useData();
  const [k, setK] = useState<number>(3);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [drawerRegion, setDrawerRegion] = useState<string | null>(null);

  // State selection for hierarchical clustering
  const [hierarchicalState, setHierarchicalState] = useState<string>('Andhra Pradesh');

  const km = data.methods?.kmeans;
  const result = km?.results?.[k];
  const hier = data.methods?.hierarchical;

  if (km?.status !== 'available' || !result) {
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

  const clusters: any[] = result.clusters ?? [];
  const assignments: any[] = result.assignment_records ?? [];
  const cohortSize: number = result.n_regions ?? assignments.length;

  // Members grouped by cluster, using real unit names parsed from the artifact.
  const membersByCluster = new Map<number, any[]>();
  for (const a of assignments) {
    const cId = Number(a.cluster_id);
    const { name, state } = splitRegion(a.region);
    if (!membersByCluster.has(cId)) membersByCluster.set(cId, []);
    membersByCluster.get(cId)!.push({ ...a, region_name: a.region_name ?? name, state_name: a.state_name ?? state });
  }

  // Smallest cluster drives the standardization caveat note below.
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

      {/* Model Diagnostics Banner */}
      <div className="stats">
        <Stat
          label="Selected Model"
          value={`K = ${k} Clusters`}
          detail={`K-means algorithm · Inertia: ${Number(result.inertia).toFixed(1)}`}
        />
        <Stat
          label="Input Cohort"
          value={`${result.n_regions} Units`}
          detail="2024 national reporting units with valid leaf records"
        />
        <Stat
          label="Feature Dimensions"
          value={`${result.n_categories} Categories`}
          detail="Log1p + per-feature z-score standardisation"
        />
        <Stat
          label="Initialization Seed"
          value={`Seed ${result.seed ?? 42}`}
          detail="Fixed seed for reproducible initialization (reproducibility metadata, not a stability measure)"
        />
      </div>

      {/* K Selector & Cluster Size Distribution */}
      <div className="grid two-one" style={{ marginTop: '1rem' }}>
        <Panel
          title="Cluster Membership Sizes"
          subtitle="Distribution of reporting units across the selected clusters."
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Number of Clusters (k):</label>
              <select
                value={k}
                onChange={e => {
                  setK(Number(e.target.value));
                  setSelectedClusterId(null);
                }}
                style={{ padding: '0.3rem 0.5rem' }}
              >
                {[3, 4, 5].map(n => (
                  <option key={n} value={n}>k = {n}</option>
                ))}
              </select>
            </div>
          }
        >
          <Bars
            items={clusters.map((c, i) => ({
              label: `Cluster ${c.cluster_id + 1} (${c.size} units)`,
              value: c.size,
              color: colors[i % colors.length]
            }))}
            unit="units"
          />
        </Panel>

        <Panel
          title="Elbow Diagnostics (Inertia)"
          subtitle="Sum of squared distances to cluster centroids."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            {inertiaStats.map(stat => (
              <div key={stat.k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ fontWeight: stat.k === k ? 700 : 400 }}>
                  k = {stat.k} clusters {stat.k === k ? '★ (Active)' : ''}
                </span>
                <strong>{stat.inertia ? Number(stat.inertia).toFixed(1) : 'N/A'}</strong>
              </div>
            ))}
            <p className="panel-note" style={{ margin: 0 }}>
              Inertia (sum of squared distances to centroids) always falls as k rises, because more clusters subdivide the same
              data; it is not a goodness-of-fit score. The saved run provides k=3, 4, and 5. k=3 is shown here as the selected
              configuration rather than a proven optimum.
            </p>
          </div>
        </Panel>
      </div>

      {/* Cluster Summary Cards */}
      <div style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Cluster Profiles & Distinguishing Characteristics</h3>
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          Cluster numbers are assigned by the algorithm and do not imply an ordering, size ranking, or severity. Sizes and
          distinguishing features below are read from the saved {`k=${k}`} artifact.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {clusters.map((c: any) => {
            const profile = deriveProfile(c.centroid as Centroid);
            const members = membersByCluster.get(c.cluster_id) ?? [];
            const representativeUnits = members.slice(0, 4);
            const pct = cohortSize ? ((c.size / cohortSize) * 100).toFixed(1) : '0.0';
            const posNames = profile.positive.map(([label]) => categoryContextLabelByRaw(data, label, 2024));
            const negNames = profile.negative.map(([label]) => categoryContextLabelByRaw(data, label, 2024));

            return (
              <div
                key={c.cluster_id}
                style={{
                  background: 'var(--color-surface, #ffffff)',
                  border: selectedClusterId === c.cluster_id ? '2px solid var(--color-primary, #0f766e)' : '1px solid var(--color-border, #e5e7eb)',
                  borderRadius: '8px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="eyebrow" style={{ color: colors[c.cluster_id % colors.length], fontWeight: 700 }}>
                      Cluster {c.cluster_id + 1} · {pct}% of cohort
                    </span>
                    <h4 style={{ margin: '0.2rem 0', fontSize: '1.15rem' }}>
                      {c.size} units{posNames[0] ? ` · elevated on ${posNames[0]}` : ''}
                    </h4>
                  </div>
                  <Badge tone={c.size <= 10 ? 'amber' : 'green'}>{c.size} units</Badge>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: 0, lineHeight: 1.4 }}>
                  This cluster holds {c.size} of the {cohortSize} reporting units ({pct}%). Aggregated over the {profile.count} standardized
                  features, its members sit {profile.mean >= 0 ? 'above' : 'below'} the national average (mean standardized deviation{' '}
                  {profile.mean >= 0 ? '+' : ''}{profile.mean.toFixed(2)}σ). It is most distinguished by high standardized values in{' '}
                  {posNames.slice(0, 2).join(' and ') || 'no features'} and relatively low values in{' '}
                  {negNames.slice(0, 2).join(' and ') || 'no features'}.
                </p>

                <div style={{ background: '#f9fafb', padding: '0.6rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Distinguishing feature deviations:</div>
                  {profile.positive.map(([label, value], fi) => (
                    <div key={`p${fi}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', margin: '2px 0' }} title={label}>
                      <span style={{ overflowWrap: 'anywhere' }}>{categoryContextLabelByRaw(data, label, 2024)}</span>
                      <strong style={{ color: '#0f766e', whiteSpace: 'nowrap' }}>{value >= 0 ? '+' : ''}{value.toFixed(2)}σ</strong>
                    </div>
                  ))}
                  {profile.negative.map(([label, value], fi) => (
                    <div key={`n${fi}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', margin: '2px 0' }} title={label}>
                      <span style={{ overflowWrap: 'anywhere' }}>{categoryContextLabelByRaw(data, label, 2024)}</span>
                      <strong style={{ color: '#b45309', whiteSpace: 'nowrap' }}>{value >= 0 ? '+' : ''}{value.toFixed(2)}σ</strong>
                    </div>
                  ))}
                  <div style={{ color: '#6b7280', marginTop: '0.4rem', fontSize: '0.72rem' }}>
                    Values are standardized mean deviations (log1p + z-score) from the saved centroid, not raw case counts.
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Example member units (saved cohort order):
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {representativeUnits.map((u: any) => (
                      <button
                        key={u.region_id}
                        type="button"
                        className="badge neutral"
                        style={{ cursor: 'pointer', border: '1px solid #d1d5db' }}
                        onClick={() => setDrawerRegion(u.region_name)}
                        title="Click to view district profile"
                      >
                        {u.region_name} ({u.state_name})
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#8b958d', marginTop: '0.3rem' }}>
                    Listed in the order stored in the clustering artifact; the artifact does not include per-unit centroid distances.
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <button
                    type="button"
                    className={`button small ${selectedClusterId === c.cluster_id ? 'primary' : ''}`}
                    style={{ width: '100%' }}
                    onClick={() => {
                      setSelectedClusterId(selectedClusterId === c.cluster_id ? null : c.cluster_id);
                      setMemberSearch('');
                    }}
                  >
                    {selectedClusterId === c.cluster_id ? 'Hide Member List' : `View All ${c.size} Members`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data-driven note about the smallest cluster and standardization effects */}
      {smallest && (
        <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 0.3rem 0', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Info size={18} /> Smallest cluster in this configuration: {smallest.size} unit{smallest.size === 1 ? '' : 's'}
          </h4>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e3a8a', lineHeight: 1.5 }}>
            With k={k}, the smallest cluster (Cluster {smallest.cluster_id + 1}, n={smallest.size}) is separated in the
            standardized space by its highest values in{' '}
            {deriveProfile(smallest.centroid as Centroid).positive.map(([label]) => categoryContextLabelByRaw(data, label, 2024)).join(', ') || 'no features'}{' '}
            and its lowest values in{' '}
            {deriveProfile(smallest.centroid as Centroid).negative.map(([label]) => categoryContextLabelByRaw(data, label, 2024)).join(', ') || 'no features'}.
            The smallest cluster is not necessarily the most elevated one: at k=3 the smallest group (C2, n=168) is
            distinguished by low values on the largest volume offences rather than high ones. Because each feature is
            standardized on its own national distribution, categories with near-zero national variance can produce large
            standardized values from very small recorded counts. Such separations therefore reflect a position in the
            transformed feature space rather than overall crime level, and do not by themselves indicate a distinct policy or
            demographic profile.
          </p>
        </div>
      )}

      {/* Expandable Member Table */}
      {selectedClusterId !== null && (
        <div style={{ marginTop: '1.25rem' }}>
          <Panel
            title={`Cluster ${selectedClusterId + 1} Members (${activeClusterMembers.length} units)`}
            subtitle="Searchable member register in saved cohort order."
            action={
              <button className="text-button" onClick={() => setSelectedClusterId(null)}>
                <X size={16} /> Close
              </button>
            }
          >
            <div style={{ marginBottom: '0.75rem', maxWidth: '380px' }}>
              <input
                type="search"
                placeholder="Search member districts or states..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
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
          title="State-Scoped Hierarchical Clustering (Ward's Method)"
          subtitle="Agglomerative Ward clustering computed strictly within individual state cohorts to preserve constitutional and geographic boundaries."
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select State / UT:</label>
              <select
                value={hierarchicalState}
                onChange={e => setHierarchicalState(e.target.value)}
                style={{ padding: '0.3rem 0.5rem' }}
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
              <p style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.75rem' }}>
                Ward clustering for <strong>{hierarchicalState}</strong> ({activeStateHier.n_regions} reporting units, max {activeStateHier.max_clusters} clusters). Ward's method minimizes within-cluster variance.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                {(activeStateHier.clusters ?? []).map((c: any) => (
                  <div key={c.cluster_id} style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <strong>Sub-cohort {c.cluster_id + 1}</strong>
                      <Badge tone="neutral">{c.size} units</Badge>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#4b5563' }}>
                      {c.regions.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="muted">
              Hierarchical clustering was computed only for states with at least 2 eligible reporting units.
            </div>
          )}
        </Panel>
      </div>

      <Notice>
        <strong>Similarity vs Safety:</strong> Clusters represent mathematical proximity in transformed 2024 category profiles. They group units with similar profiles, not safe or unsafe jurisdictions. Cluster numbers and sizes carry no ordinal or severity meaning.
      </Notice>

      <RegionDetailDrawer
        regionName={drawerRegion}
        kmeansK={k}
        onClose={() => setDrawerRegion(null)}
      />
    </>
  );
}
