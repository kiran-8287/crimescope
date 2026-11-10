import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { number } from '../utils/format';

export type ClusterPoint = {
  regionId: string;
  region: string;        // "State · District" as stored in the artifact
  state: string;
  pc1: number;
  pc2: number;
  cluster: number;       // zero-based cluster_id from the saved k run
};

const clusterColors = ['#0f766e', '#2563eb', '#ca8a04', '#7c3aed', '#b45309'];

// Stable cluster palette shared with the centroid heatmap so the same cluster
// keeps the same color across the scatter, size summary, heatmap and table.
export function clusterColor(cluster: number): string {
  return clusterColors[Math.abs(cluster) % clusterColors.length];
}

type ClusterProjectionProps = {
  points: ClusterPoint[];
  error: string | null;
  cohortSize: number;
  k: number;
  pc1Pct: number;
  pc2Pct: number;
  combinedPct: number;
  featureCount: number;
  onSelectUnit: (region: string) => void;
};

// SVG canvas mirrors the PCA explorer (760 × 440) so the two projection pages
// share a consistent coordinate system and axis bounds never rescale when k changes.
const SVG_W = 760, SVG_H = 440;
const M_LEFT = 65, M_RIGHT = 30, M_TOP = 30, M_BOTTOM = 50;
const PLOT_W = SVG_W - M_LEFT - M_RIGHT;
const PLOT_H = SVG_H - M_TOP - M_BOTTOM;

export function ClusterProjection({ points, error, cohortSize, k, pc1Pct, pc2Pct, combinedPct, featureCount, onSelectUnit }: ClusterProjectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<ClusterPoint | null>(null);

  const clusterCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of points) counts.set(p.cluster, (counts.get(p.cluster) ?? 0) + 1);
    return counts;
  }, [points]);

  // Axis bounds are derived from all saved PCA scores and do not depend on k,
  // so switching k never rescales or recentres the axes.
  const { minX, maxX, minY, maxY } = useMemo(() => {
    if (!points.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    const xs = points.map(p => p.pc1);
    const ys = points.map(p => p.pc2);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = (maxX - minX) * 0.08 || 1;
    const padY = (maxY - minY) * 0.08 || 1;
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }, [points]);

  const cx = (x: number) => M_LEFT + ((x - minX) / (maxX - minX)) * PLOT_W;
  const cy = (y: number) => SVG_H - M_BOTTOM - ((y - minY) / (maxY - minY)) * PLOT_H;

  const generateTicks = (min: number, max: number, count = 6) => {
    const step = (max - min) / count;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) ticks.push(Math.round((min + i * step) * 10) / 10);
    return ticks;
  };
  const xTicks = generateTicks(minX, maxX, 7);
  const yTicks = generateTicks(minY, maxY, 6);

  const searchMatches = searchQuery.trim()
    ? points.filter(p => p.region.toLowerCase().includes(searchQuery.trim().toLowerCase()) || p.state.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : [];
  const activeSelected = selectedPoint || (searchMatches.length === 1 ? searchMatches[0] : null);
  const isSelected = (p: ClusterPoint) => activeSelected !== null && activeSelected.regionId === p.regionId;
  const isHighlighted = (p: ClusterPoint) => searchMatches.some(h => h.regionId === p.regionId);

  const clearSelection = () => { setSelectedPoint(null); setSearchQuery(''); };

  const pct1 = `${pc1Pct.toFixed(2)}%`;
  const pct2 = `${pc2Pct.toFixed(2)}%`;

  if (error) {
    return (
      <div className="empty" style={{ padding: '2rem 0', textAlign: 'center' }}>
        <svg style={{ width: 32, height: 32, color: '#b45309', display: 'block', margin: '0 auto 0.5rem auto' }}>{/* info icon placeholder */}</svg>
        <h2 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '1.1rem' }}>Cluster projection unavailable</h2>
        <p style={{ color: '#6b7280', maxWidth: '460px', margin: '0 auto', fontSize: '0.9rem' }}>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '11px', color: '#9ca3af' }} />
          <input
            type="search"
            aria-label="Search reporting units in the cluster projection"
            placeholder="Search district or state…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', height: '38px', boxSizing: 'border-box', paddingLeft: '32px', fontSize: '0.9rem' }}
          />
        </div>
        {searchQuery && (
          <button type="button" className="text-button" onClick={clearSelection}>Clear search</button>
        )}
        {searchQuery && (
          <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>
            {searchMatches.length} matching unit{searchMatches.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {searchQuery.trim() && (
        <div style={{ marginBottom: '0.75rem' }} aria-label="Matching reporting units">
          {searchMatches.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>No reporting units match “{searchQuery.trim()}”.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {searchMatches.slice(0, 12).map((p: ClusterPoint) => (
                <li key={p.regionId}>
                  <button
                    type="button"
                    className={`button small${isSelected(p) ? ' primary' : ''}`}
                    onClick={() => { setSelectedPoint(p); onSelectUnit(p.region); }}
                  >
                    {p.region}
                  </button>
                </li>
              ))}
              {searchMatches.length > 12 && (
                <li className="muted" style={{ fontSize: '0.8rem', alignSelf: 'center' }}>+{searchMatches.length - 12} more — refine the search</li>
              )}
            </ul>
          )}
        </div>
      )}

      <div style={{ position: 'relative', width: '100%', overflowX: 'auto', background: '#fafbfc', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: '100%', minWidth: '600px', height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Cluster membership in PCA space (k = ${k}), ${points.length} reporting units`}
        >
          {/* Grid lines and ticks */}
          {xTicks.map(t => (
            <g key={`xt-${t}`}>
              <line x1={cx(t)} y1={M_TOP} x2={cx(t)} y2={SVG_H - M_BOTTOM} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={cx(t)} y={SVG_H - M_BOTTOM + 16} fontSize="10" textAnchor="middle" fill="#6b7280">{t}</text>
            </g>
          ))}
          {yTicks.map(t => (
            <g key={`yt-${t}`}>
              <line x1={M_LEFT} y1={cy(t)} x2={SVG_W - M_RIGHT} y2={cy(t)} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={M_LEFT - 8} y={cy(t) + 3} fontSize="10" textAnchor="end" fill="#6b7280">{t}</text>
            </g>
          ))}
          {/* Zero axes */}
          {minX <= 0 && maxX >= 0 && (
            <line x1={cx(0)} y1={M_TOP} x2={cx(0)} y2={SVG_H - M_BOTTOM} stroke="#9ca3af" strokeWidth="1.5" />
          )}
          {minY <= 0 && maxY >= 0 && (
            <line x1={M_LEFT} y1={cy(0)} x2={SVG_W - M_RIGHT} y2={cy(0)} stroke="#9ca3af" strokeWidth="1.5" />
          )}

          {/* Legend overlay: cluster swatches with counts (top-left) */}
          <g transform="translate(72, 38)">
            {[...clusterCounts.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([cluster, count]) => (
                <g key={cluster} transform={`translate(${cluster * 126}, 0)`}>
                  <circle cx="0" cy="0" r="6" fill={clusterColor(cluster)} />
                  <text x="11" y="4" fontSize="10" fill="#374151">Cluster {cluster + 1}</text>
                  <text x="11" y="16" fontSize="9" fill="#6b7280">{number(count)} units</text>
                </g>
              ))}
          </g>

          {/* Data points */}
          {points.map((p: ClusterPoint) => {
            const sel = isSelected(p);
            const hl = isHighlighted(p);
            return (
              <g key={p.regionId}>
                {sel && (
                  <circle cx={cx(p.pc1)} cy={cy(p.pc2)} r="11" fill="none" stroke="#ef4444" strokeWidth="2.5" opacity="0.8" />
                )}
                <circle
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.region}, ${p.state}, Cluster ${p.cluster + 1}, PC1 ${number(p.pc1, 2)}, PC2 ${number(p.pc2, 2)}`}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedPoint(p);
                      onSelectUnit(p.region);
                    }
                  }}
                  onClick={() => { setSelectedPoint(p); onSelectUnit(p.region); }}
                  cx={cx(p.pc1)}
                  cy={cy(p.pc2)}
                  r={sel ? 6 : hl ? 5 : 3.5}
                  fill={clusterColor(p.cluster)}
                  stroke={sel ? '#172c28' : 'white'}
                  strokeWidth="2"
                  className="scatter-point"
                  style={{ cursor: 'pointer', transition: 'r 0.15s ease', opacity: sel || hl ? 1 : 0.65 }}
                >
                  <title>{`${p.region}\n${p.state}\nCluster ${p.cluster + 1}\nPC1: ${number(p.pc1, 2)}\nPC2: ${number(p.pc2, 2)}`}</title>
                </circle>
              </g>
            );
          })}

          {/* Axis labels */}
          <text x={M_LEFT + PLOT_W / 2} y={SVG_H - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#374151">
            Principal Component 1 ({pct1} of variance)
          </text>
          <text
            x={-220}
            y={18}
            transform="rotate(-90)"
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="#374151"
          >
            Principal Component 2 ({pct2} of variance)
          </text>
        </svg>
      </div>

      <p className="panel-note" style={{ marginTop: '0.5rem' }}>
        K-means grouped reporting units using all {number(featureCount)} transformed offence features. This chart displays
        those assignments on the first two PCA axes, which explain {combinedPct.toFixed(2)}% of the feature variance
        (PC1 {pct1}, PC2 {pct2}). Units close together here share similar scores, but proximity in this two-axis
        projection does not establish proximity in the full feature space. Clusters are not a safety ranking and do not
        identify safer or less safe districts.
      </p>
    </>
  );
}
