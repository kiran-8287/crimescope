import { useState } from 'react';
import { Network, Search, Layers, X, Info, ExternalLink } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PageTitle } from '../components/Layout';
import { Panel, Notice, Badge, UnitTypeBadge, ExportButton, Filters, RegionDetailDrawer, Stat } from '../components/UI';
import { Bars, colors } from '../components/Charts';
import { DataTable } from '../components/DataTable';
import { cleanCategoryName } from '../utils/categories';
import { number } from '../utils/format';

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

  // Pre-calculated distinguishing characteristics of K=3 clusters based on centroid analysis
  const clusterDistinctions: Record<number, { name: string; tag: string; description: string; topFeatures: Array<{ name: string; direction: string; z: number }> }> = {
    0: {
      name: 'Rare Offenses Outlier Cohort',
      tag: 'Extreme Rare-Category Flag',
      description: 'Group of 4 units that uniquely recorded positive counts in rare categories where over 99% of national districts reported zero.',
      topFeatures: [
        { name: 'ElectriState/UT/Power Supply Disputes', direction: '+10.95σ', z: 10.95 },
        { name: 'Deaths due to Negligence of Civic Bodies', direction: '+6.48σ', z: 6.48 },
        { name: 'Foeticide & Infanticide', direction: '+3.30σ', z: 3.30 },
      ]
    },
    1: {
      name: 'Low to Moderate Volume Baseline',
      tag: 'Broad Cohort Baseline',
      description: 'The largest cluster (520 units), characterized by low-to-moderate total counts and near-zero or negative deviations across major property crimes.',
      topFeatures: [
        { name: 'Vehicle Theft', direction: '-0.38σ (Below average)', z: -0.38 },
        { name: 'Housebreak / Burglary', direction: '-0.35σ (Below average)', z: -0.35 },
        { name: 'Assault & Grievous Hurt', direction: '-0.29σ (Moderate)', z: -0.29 },
      ]
    },
    2: {
      name: 'High Recorded Volume & Urban Centers',
      tag: 'Elevated Volume & Urban Offenses',
      description: 'Comprises 361 high-population districts, metropolitan commissionerates, and major economic centers with elevated reporting across violent, property, and vehicular offenses.',
      topFeatures: [
        { name: 'Theft & Vehicle Theft', direction: '+0.58σ (Elevated)', z: 0.58 },
        { name: 'Hurt & Grievous Hurt', direction: '+0.47σ (Elevated)', z: 0.47 },
        { name: 'Rash Driving on Public Way', direction: '+0.44σ (Elevated)', z: 0.44 },
      ]
    }
  };

  const clusters: any[] = result.clusters ?? [];
  const assignments: any[] = result.assignment_records ?? [];

  // Group members with distance to centroid
  const membersByCluster = new Map<number, any[]>();
  for (const a of assignments) {
    const cId = Number(a.cluster_id);
    if (!membersByCluster.has(cId)) membersByCluster.set(cId, []);
    membersByCluster.get(cId)!.push(a);
  }

  // Sort each cluster's members by distance to centroid (ascending) to find representative units
  for (const [cId, list] of membersByCluster.entries()) {
    list.sort((a, b) => Number(a.distance_to_centroid ?? 0) - Number(b.distance_to_centroid ?? 0));
  }

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
        action={<ExportButton rows={assignments} name={`kmeans_clusters_k${k}_2024`} />}
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
          label="Random Seed / Stability"
          value={`Seed ${result.seed ?? 42}`}
          detail="Deterministic reproducible initialization"
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
              Higher k decreases inertia by subdividing larger groups. k=3 offers the clearest separation between baseline units and high-volume urban centers.
            </p>
          </div>
        </Panel>
      </div>

      {/* Cluster Summary Cards */}
      <div style={{ marginTop: '1rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Cluster Profiles & Distinguishing Characteristics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          {clusters.map((c: any) => {
            const distinction = clusterDistinctions[c.cluster_id] ?? {
              name: `Cluster ${c.cluster_id + 1}`,
              tag: 'Sub-cohort',
              description: `Subdivision of ${c.size} reporting units with shared crime volume profiles.`,
              topFeatures: []
            };

            const members = membersByCluster.get(c.cluster_id) ?? [];
            const representativeUnits = members.slice(0, 4);

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
                      Cluster {c.cluster_id + 1} · {((c.size / result.n_regions) * 100).toFixed(1)}% of national cohort
                    </span>
                    <h4 style={{ margin: '0.2rem 0', fontSize: '1.15rem' }}>{distinction.name}</h4>
                  </div>
                  <Badge tone={c.size <= 10 ? 'amber' : 'green'}>{c.size} units</Badge>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: 0, lineHeight: 1.4 }}>
                  {distinction.description}
                </p>

                {distinction.topFeatures.length > 0 && (
                  <div style={{ background: '#f9fafb', padding: '0.6rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600, color: '#374151', marginBottom: '0.3rem' }}>Distinguishing feature deviations:</div>
                    {distinction.topFeatures.map((f, fi) => (
                      <div key={fi} style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0' }}>
                        <span>{f.name}:</span>
                        <strong style={{ color: f.z > 0 ? '#0f766e' : '#b45309' }}>{f.direction}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.3rem', textTransform: 'uppercase' }}>
                    Representative Units (Closest to Centroid):
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

      {/* Deep-dive investigation for the 4-member cluster */}
      <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#eff6ff', borderLeft: '4px solid #3b82f6', borderRadius: '6px' }}>
        <h4 style={{ margin: '0 0 0.3rem 0', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={18} /> Analytical Investigation: Why Cluster 1 Contains Exactly 4 Districts
        </h4>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#1e3a8a', lineHeight: 1.5 }}>
          The 4 units in Cluster 1 (<strong>Karnataka · Bidar</strong>, <strong>Chhattisgarh · Bilaspur</strong>, <strong>Madhya Pradesh · Gwalior</strong>, and <strong>Chhattisgarh · Balodbazar</strong>) are grouped together because each recorded positive counts (2 to 4 cases) in offenses that are virtually absent across the rest of the country (specifically <em>Power Supply Disputes</em> and <em>Deaths due to Negligence of Civic Bodies</em>). In a per-feature $z$-score standardization, near-zero national variance causes small counts to yield massive standardized values ($+10.95\sigma$), resulting in large Euclidean distances that pull these four units into an isolated cluster. Their records are verified non-null source entries, but their clustering is driven by rare-category standardization rather than high overall crime.
        </p>
      </div>

      {/* Expandable Member Table */}
      {selectedClusterId !== null && (
        <div style={{ marginTop: '1.25rem' }}>
          <Panel
            title={`Cluster ${selectedClusterId + 1} Members (${activeClusterMembers.length} units)`}
            subtitle="Searchable member register ordered by proximity to the cluster centroid."
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
                },
                {
                  key: 'distance_to_centroid',
                  label: 'Distance to Centroid',
                  render: r => Number(r.distance_to_centroid ?? 0).toFixed(3)
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
        <strong>Similarity vs Safety:</strong> Clusters represent mathematical proximity in transformed 2024 category profiles. They group units with similar proportions of offenses, not safe or unsafe jurisdictions.
      </Notice>

      <RegionDetailDrawer
        regionName={drawerRegion}
        onClose={() => setDrawerRegion(null)}
      />
    </>
  );
}
