import { useState, useMemo } from 'react';
import { Search, Info, HelpCircle } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PageTitle } from '../components/Layout';
import { Panel, Notice, Badge, ExportButton, Filters, RegionDetailDrawer, Stat } from '../components/UI';
import { Bars, colors } from '../components/Charts';
import { cleanCategoryName } from '../utils/categories';
import { number } from '../utils/format';

export default function PcaPage() {
  const { data } = useData();
  const method = data.methods?.pca;
  const result = method?.result;

  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeComponent, setActiveComponent] = useState<'PC1' | 'PC2'>('PC1');
  const [drawerRegion, setDrawerRegion] = useState<string | null>(null);

  if (method?.status !== 'available' || !result) {
    return (
      <>
        <PageTitle
          eyebrow="DIMENSIONALITY REDUCTION"
          title="PCA explorer"
          description="Explore principal component projections of regional crime profiles."
        />
        <Filters fixedYear={2024} hideCategory />
        <div className="empty">
          <h2>Saved PCA result unavailable</h2>
          <p>{method?.reason ?? 'No verified compatible PCA result is available for this dataset.'}</p>
        </div>
      </>
    );
  }

  const variance: number[] = result.explained_variance_ratio ?? [];
  const cumulative: number[] = result.cumulative_variance_ratio ?? [];
  const components: any[] = result.components ?? [];
  const loadings: any[] = result.loadings ?? [];

  const getScore = (row: any, pc: string): number => {
    return Number(row.scores?.find((s: any) => s.component === pc)?.score ?? 0);
  };

  // Compute dynamic bounds with padding so NO points are ever clipped
  const { minX, maxX, minY, maxY, plotPoints } = useMemo(() => {
    if (!components.length) {
      return { minX: -10, maxX: 10, minY: -10, maxY: 10, plotPoints: [] };
    }
    const xs = components.map(c => getScore(c, 'PC1'));
    const ys = components.map(c => getScore(c, 'PC2'));

    const rawMinX = Math.min(...xs), rawMaxX = Math.max(...xs);
    const rawMinY = Math.min(...ys), rawMaxY = Math.max(...ys);

    const padX = (rawMaxX - rawMinX) * 0.08 || 2;
    const padY = (rawMaxY - rawMinY) * 0.08 || 2;

    const bMinX = rawMinX - padX;
    const bMaxX = rawMaxX + padX;
    const bMinY = rawMinY - padY;
    const bMaxY = rawMaxY + padY;

    // SVG canvas size: 760 x 440 with margins (left: 65, right: 30, top: 30, bottom: 50)
    const svgW = 760, svgH = 440;
    const mLeft = 65, mRight = 30, mTop = 30, mBottom = 50;
    const plotW = svgW - mLeft - mRight;
    const plotH = svgH - mTop - mBottom;

    const pts = components.map(c => {
      const x = getScore(c, 'PC1');
      const y = getScore(c, 'PC2');
      const cx = mLeft + ((x - bMinX) / (bMaxX - bMinX)) * plotW;
      const cy = svgH - mBottom - ((y - bMinY) / (bMaxY - bMinY)) * plotH;
      return { ...c, x, y, cx, cy };
    });

    return { minX: bMinX, maxX: bMaxX, minY: bMinY, maxY: bMaxY, plotPoints: pts };
  }, [components]);

  // Handle region search highlight
  const highlightedPoints = searchQuery.trim()
    ? plotPoints.filter(p => p.region.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const activeSelected = selectedPoint || (highlightedPoints.length === 1 ? highlightedPoints[0] : null);

  // Generate numeric axis ticks
  const generateTicks = (min: number, max: number, count = 6) => {
    const step = (max - min) / count;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(Math.round((min + i * step) * 10) / 10);
    }
    return ticks;
  };

  const xTicks = generateTicks(minX, maxX, 7);
  const yTicks = generateTicks(minY, maxY, 6);

  const mLeft = 65, mBottom = 50, plotW = 760 - 65 - 30, plotH = 440 - 30 - 50;

  // Active component feature correlations (loadings)
  const activeLoadingsObj = loadings.find(l => l.component === activeComponent) ?? loadings[0];
  const sortedFeatures = [...(activeLoadingsObj?.features ?? [])].sort((a: any, b: any) => b.loading - a.loading);
  const topPositiveFeatures = sortedFeatures.slice(0, 10);
  const topNegativeFeatures = [...sortedFeatures].reverse().slice(0, 10);

  return (
    <>
      <PageTitle
        eyebrow="DIMENSIONALITY REDUCTION"
        title="Principal Component Analysis (PCA)"
        description={`Explore the 2024 national crime structure across ${result.n_regions} reporting units and ${result.n_categories} crime features.`}
        action={<ExportButton rows={plotPoints.map(p => ({ region: p.region, pc1: p.x, pc2: p.y }))} name="pca_scores_2024" />}
      />

      <Filters fixedYear={2024} hideCategory />

      {/* Variance summary banner */}
      <div className="stats">
        <Stat
          label="PC1 Explained Variance"
          value={`${(variance[0] * 100).toFixed(1)}%`}
          detail="Primary axis; predominantly captures overall reporting volume"
        />
        <Stat
          label="PC2 Explained Variance"
          value={`${(variance[1] * 100).toFixed(1)}%`}
          detail="Secondary axis; distinguishes violent offenses from property crimes"
        />
        <Stat
          label="Cumulative Variance (2 PCs)"
          value={`${((cumulative[1] || (variance[0] + variance[1])) * 100).toFixed(1)}%`}
          detail="22.7% of total feature variance retained in 2D projection"
        />
        <Stat
          label="Feature Input Space"
          value={`${result.n_regions} × ${result.n_categories}`}
          detail="Log1p + per-feature z-score standardisation"
        />
      </div>

      <div className="grid two-one" style={{ marginTop: '1rem' }}>
        {/* Scatter Plot Panel */}
        <Panel
          title="PCA Biplot Projection (PC1 vs PC2)"
          subtitle="Nearby points indicate similar relative crime profiles in the standardized space."
        >
          {/* Search bar inside panel */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: '#9ca3af' }} />
              <input
                type="search"
                placeholder="Search district or state to highlight on plot..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: '32px', fontSize: '0.85rem' }}
              />
            </div>
            {searchQuery && (
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Found {highlightedPoints.length} matching units
              </span>
            )}
          </div>

          <div style={{ position: 'relative', width: '100%', overflowX: 'auto', background: '#fafbfc', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <svg
              viewBox="0 0 760 440"
              style={{ width: '100%', minWidth: '600px', height: 'auto', display: 'block' }}
              role="img"
              aria-label="PCA scatter plot of regional crime profiles"
            >
              {/* Grid lines and ticks */}
              {xTicks.map(t => {
                const cx = mLeft + ((t - minX) / (maxX - minX)) * plotW;
                return (
                  <g key={`xtick-${t}`}>
                    <line x1={cx} y1={30} x2={cx} y2={440 - mBottom} stroke="#e5e7eb" strokeDasharray="3 3" />
                    <text x={cx} y={440 - mBottom + 16} fontSize="10" textAnchor="middle" fill="#6b7280">{t}</text>
                  </g>
                );
              })}

              {yTicks.map(t => {
                const cy = 440 - mBottom - ((t - minY) / (maxY - minY)) * plotH;
                return (
                  <g key={`ytick-${t}`}>
                    <line x1={mLeft} y1={cy} x2={760 - 30} y2={cy} stroke="#e5e7eb" strokeDasharray="3 3" />
                    <text x={mLeft - 8} y={cy + 3} fontSize="10" textAnchor="end" fill="#6b7280">{t}</text>
                  </g>
                );
              })}

              {/* Zero axes */}
              {minX <= 0 && maxX >= 0 && (
                <line
                  x1={mLeft + ((0 - minX) / (maxX - minX)) * plotW}
                  y1={30}
                  x2={mLeft + ((0 - minX) / (maxX - minX)) * plotW}
                  y2={440 - mBottom}
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                />
              )}
              {minY <= 0 && maxY >= 0 && (
                <line
                  x1={mLeft}
                  y1={440 - mBottom - ((0 - minY) / (maxY - minY)) * plotH}
                  x2={760 - 30}
                  y2={440 - mBottom - ((0 - minY) / (maxY - minY)) * plotH}
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                />
              )}

              {/* Data points */}
              {plotPoints.map((p: any) => {
                const isSelected = activeSelected?.region_id === p.region_id;
                const isHighlighted = highlightedPoints.some(h => h.region_id === p.region_id);
                return (
                  <g key={p.region_id}>
                    {isSelected && (
                      <circle cx={p.cx} cy={p.cy} r="12" fill="none" stroke="#ef4444" strokeWidth="2.5" opacity="0.8" />
                    )}
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={isSelected ? 6 : isHighlighted ? 5 : 3.5}
                      fill={isSelected ? '#ef4444' : isHighlighted ? '#f59e0b' : '#0d9488'}
                      opacity={isSelected || isHighlighted ? 1 : 0.65}
                      style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                      onMouseEnter={() => setHoveredPoint(p)}
                      onMouseLeave={() => setHoveredPoint(null)}
                      onClick={() => setSelectedPoint(p)}
                    >
                      <title>{`${p.region}\nPC1: ${p.x.toFixed(2)}, PC2: ${p.y.toFixed(2)}`}</title>
                    </circle>
                  </g>
                );
              })}

              {/* Axis Labels */}
              <text x={mLeft + plotW / 2} y={440 - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#374151">
                Principal Component 1 ({(variance[0] * 100).toFixed(1)}% of variance)
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
                Principal Component 2 ({(variance[1] * 100).toFixed(1)}% of variance)
              </text>
            </svg>
          </div>

          <p className="panel-note" style={{ marginTop: '0.5rem' }}>
            Click any point to inspect its regional profile. Outliers along PC1 record substantially higher overall crime volumes across almost all categories.
          </p>
        </Panel>

        {/* Selected Region / Point Inspector */}
        <div>
          <Panel
            title="Point Details & Inspection"
            subtitle={activeSelected ? activeSelected.region : 'Select a point on the scatter plot'}
          >
            {activeSelected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px' }}>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>{activeSelected.region}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <Badge tone="neutral">PC1: {activeSelected.x.toFixed(2)}</Badge>
                    <Badge tone="neutral">PC2: {activeSelected.y.toFixed(2)}</Badge>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                  <p>
                    <strong>PC1 Interpretation:</strong> Score of {activeSelected.x.toFixed(2)} places this unit in the{' '}
                    {activeSelected.x > 0 ? 'higher volume' : 'lower volume'} half of the national distribution.
                  </p>
                  <p>
                    <strong>PC2 Interpretation:</strong> Score of {activeSelected.y.toFixed(2)} reflects its relative balance between specific property offenses and bodily offenses.
                  </p>
                </div>

                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    const parts = activeSelected.region.split(' · ');
                    setDrawerRegion(parts[1] || parts[0]);
                  }}
                >
                  View Complete Regional Profile
                </button>
              </div>
            ) : (
              <div className="muted" style={{ padding: '2rem 0', textAlign: 'center' }}>
                <Info size={32} style={{ margin: '0 auto 0.5rem auto', color: '#9ca3af' }} />
                <p>Click any point on the biplot or search for a region above to inspect its coordinates and profile.</p>
              </div>
            )}
          </Panel>

          {/* Scree & Cumulative Variance Summary */}
          <Panel title="Variance Decomposition" subtitle="Scree distribution across retained components">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>PC1 (Eigenvalue: {result.eigenvalues?.[0]?.toFixed(2)})</span>
                  <strong>{(variance[0] * 100).toFixed(1)}%</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(variance[0] * 100).toFixed(1)}%`, height: '100%', background: '#0d9488' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>PC2 (Eigenvalue: {result.eigenvalues?.[1]?.toFixed(2)})</span>
                  <strong>{(variance[1] * 100).toFixed(1)}%</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${(variance[1] * 100).toFixed(1)}%`, height: '100%', background: '#14b8a6' }} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Remaining {result.n_categories - 2} components</span>
                <span style={{ color: '#6b7280' }}>{(100 - (variance[0] + variance[1]) * 100).toFixed(1)}%</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* Feature Loadings Definition and Table */}
      <Panel
        title="Feature Loadings & Scaled Components"
        subtitle={`Select component to inspect feature contributions (values are scaled component loadings: lij = vij × √λi).`}
        action={
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              type="button"
              className={`button small ${activeComponent === 'PC1' ? 'primary' : ''}`}
              onClick={() => setActiveComponent('PC1')}
            >
              PC1 ({result.loadings?.[0]?.features?.length} features)
            </button>
            <button
              type="button"
              className={`button small ${activeComponent === 'PC2' ? 'primary' : ''}`}
              onClick={() => setActiveComponent('PC2')}
            >
              PC2 ({result.loadings?.[1]?.features?.length} features)
            </button>
          </div>
        }
      >
        <div style={{ padding: '0.75rem', background: '#eff6ff', borderLeft: '3px solid #3b82f6', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <strong>Mathematical Definition:</strong> The loading values reported here represent scaled component loadings (l_ij = v_ij × √λ_i, where v_ij is the eigenvector component and λ_i is the eigenvalue). Under standardized features, scaled component loadings approximate feature-component associations; however, depending on variance divisor conventions (N vs N-1), they are formally scaled component loadings rather than exact sample Pearson correlations. They quantify the magnitude and direction of association, distinct from normalized eigenvector weights whose sum of squares equals 1.
        </div>

        <div className="grid two-col">
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f766e', fontSize: '0.95rem' }}>
              Largest Positive Associations ({activeComponent})
            </h4>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Category</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>Scaled Loading (v_ij √λ_i)</th>
                </tr>
              </thead>
              <tbody>
                {topPositiveFeatures.map((f: any) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '0.4rem' }}>{cleanCategoryName(f.category)}</td>
                    <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 600, color: '#0f766e' }}>
                      +{Number(f.loading).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#b91c1c', fontSize: '0.95rem' }}>
              Largest Negative Associations ({activeComponent})
            </h4>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Category</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>Scaled Loading (v_ij √λ_i)</th>
                </tr>
              </thead>
              <tbody>
                {topNegativeFeatures.map((f: any) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '0.4rem' }}>{cleanCategoryName(f.category)}</td>
                    <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 600, color: '#b91c1c' }}>
                      {Number(f.loading).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>

      <Notice>
        <strong>Analytical cohort & volume effects:</strong> The PCA model is fitted on 774 administrative districts using log1p-transformed and standardized counts ($\log(1+x)$) across 131 leaf and component crime categories. Because population denominators are not available, PC1 primarily reflects overall reporting volume ($r = -0.88$ with log-volume, $r = -0.71$ with raw volume). Position in PCA space represents profile structure, not a measure of community safety.
      </Notice>

      <RegionDetailDrawer
        regionName={drawerRegion}
        onClose={() => setDrawerRegion(null)}
      />
    </>
  );
}
