import { useMemo } from 'react';
import { selectHeatmapFeatures, type HeatmapColumn } from '../utils/clusterProjection';
import { clusterColor } from './ClusterProjection';
import { number } from '../utils/format';

type CentroidHeatmapProps = {
  clusters: any[];        // saved k-means clusters for the selected k (each {cluster_id, size, centroid:{label:value}})
  k: number;
  cohortSize: number;
  data: any;              // Dataset (for category labels and metadata)
  unavailableReason: string | null;
};

// Signed display for a standardized centroid deviation: "+1.04" / "-1.47" / "0".
function signed(value: number, digits = 2): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${number(rounded, digits)}`;
}

const POS_COLOR = '15, 118, 110';   // green (#0f766e)
const NEG_COLOR = '180, 83, 9';     // amber (#b45309)

// Background tint for a centroid cell: diverging, centred at zero. Intensity
// grows with |value| relative to the largest absolute value in the heatmap so
// every cell uses the same scale. Zero renders neutral; when every value is
// zero the scale stays neutral instead of dividing by zero.
function cellTint(value: number, maxAbs: number): string {
  if (maxAbs === 0) return '#f2f6f4';
  const t = Math.min(1, Math.abs(value) / maxAbs);
  const opacity = 0.12 + 0.62 * t; // 12% → 74%
  return value >= 0 ? `rgba(${POS_COLOR},${opacity})` : `rgba(${NEG_COLOR},${opacity})`;
}

function cellTextColor(value: number): string {
  if (value > 0) return '#0f766e';
  if (value < 0) return '#b45309';
  return '#6b7280';
}

export function CentroidHeatmap({ clusters, k, cohortSize, data, unavailableReason }: CentroidHeatmapProps) {
  if (unavailableReason) {
    return (
      <div className="empty" style={{ padding: '2rem 0', textAlign: 'center' }}>
        <h2 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '1.1rem' }}>Centroid heatmap unavailable</h2>
        <p style={{ color: '#6b7280', maxWidth: '460px', margin: '0 auto', fontSize: '0.9rem' }}>{unavailableReason}</p>
      </div>
    );
  }
  if (!clusters?.length) {
    return (
      <div className="empty" style={{ padding: '2rem 0', textAlign: 'center' }}>
        <h2 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '1.1rem' }}>No centroid data</h2>
        <p style={{ color: '#6b7280', maxWidth: '460px', margin: '0 auto', fontSize: '0.9rem' }}>
          The saved k = {k} K-means artifact does not contain usable centroid values for this cohort.
        </p>
      </div>
    );
  }

  // Feature selection: spread of saved centroid values across clusters, capped
  // at 10 readable columns. Same columns for every cluster.
  const columns: HeatmapColumn[] = selectHeatmapFeatures(clusters, data?.meta?.categories, 10);

  // Value matrix: rows = clusters, cols = selected features.
  const cellValues: number[][] = clusters.map((c: any) =>
    columns.map(col => Number(c.centroid?.[col.fullLabel] ?? 0))
  );
  let maxAbs = 0;
  for (const row of cellValues) {
    for (const v of row) {
      const a = Math.abs(v);
      if (a > maxAbs) maxAbs = a;
    }
  }

  return (
    <>
      <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', minWidth: '560px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '560px' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left', padding: '0.55rem 0.65rem', fontSize: '0.78rem', color: '#6b7280',
                  borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0,
                  background: '#fff', zIndex: 2,
                }}
              >
                Cluster
              </th>
              {columns.map(col => (
                <th
                  key={col.fullLabel}
                  style={{
                    textAlign: 'center', padding: '0.5rem 0.4rem', fontSize: '0.72rem', color: '#6b7280',
                    borderBottom: '1px solid #e5e7eb', borderRight: '1px solid #eef1f0', whiteSpace: 'nowrap',
                    minWidth: '78px', position: 'sticky', top: 0, background: '#fff', zIndex: 1,
                  }}
                  title={col.fullLabel}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clusters.map((c: any, ci: number) => {
              const size = Number(c.size ?? 0);
              const share = cohortSize ? (size / cohortSize) * 100 : 0;
              return (
                <tr key={c.cluster_id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td
                    style={{
                      padding: '0.55rem 0.65rem', fontWeight: 700, color: '#374151',
                      borderRight: '1px solid #e5e7eb', position: 'sticky', left: 0, background: '#fff', zIndex: 2,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block', width: '17px', height: '17px', borderRadius: '50%',
                        background: clusterColor(ci), marginRight: '0.5rem', verticalAlign: 'middle',
                      }}
                    />
                    Cluster {ci + 1}
                    <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.35rem' }}>
                      {number(size)} units · {share.toFixed(1)}%
                    </span>
                  </td>
                  {columns.map((_col, colIdx) => {
                    const v = cellValues[ci][colIdx];
                    return (
                      <td
                        key={_col.fullLabel}
                        style={{
                          padding: '0.45rem 0.35rem', textAlign: 'center', borderRight: '1px solid #eef1f0',
                          background: cellTint(v, maxAbs),
                          color: cellTextColor(v), fontWeight: 700, fontSize: '0.75rem', whiteSpace: 'nowrap',
                        }}
                        title={`${_col.fullLabel} · Cluster ${ci + 1}: ${signed(v)} standardized σ`}
                      >
                        {signed(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="panel-note" style={{ marginTop: '0.5rem', fontSize: '0.86rem', lineHeight: 1.45 }}>
        <strong>Offence features that distinguish the clusters.</strong> Rows are the saved k = {k} clusters; columns are
        a deterministic subset of offence features chosen because their saved centroid values spread the most across the
        {clusters.length} clusters (max − min centroid value, tie-broken by feature id). The same columns are shown for
        every cluster so the heatmap is directly comparable across clusters. Each value is a standardized centroid
        deviation (σ) in log1p-count + per-feature population z-score space (ddof = 0), not a case count, percentage or
        per-capita rate: positive is above the national cohort average for that feature, negative is below. Proximity in
        this projection does not establish proximity in the full feature space, and clusters are not a safety ranking.
      </p>
    </>
  );
}
