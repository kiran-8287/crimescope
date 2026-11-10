import { useMemo, useState } from 'react';
import { Search, Info } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PageTitle } from '../components/Layout';
import { Panel, Notice, Badge, ExportButton, Filters, RegionDetailDrawer, Stat } from '../components/UI';
import { categoryContextLabel } from '../utils/categories';
import { number } from '../utils/format';

// One signed formatter for every loading / coordinate value on the page. Values
// pass through the shared number() formatter so a rounded negative zero renders
// as "0" (never "-0.00") and a value never carries a double sign ("+-").
function signed(value: number, digits = 3): string {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${number(rounded, digits)}`;
}

export default function PcaPage() {
  const { data } = useData();
  const method = data.methods?.pca;
  const result = method?.result;

  const [selectedPoint, setSelectedPoint] = useState<any | null>(null);
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
  const eigenvalues: number[] = result.eigenvalues ?? [];

  // Single artifact-derived source for every variance figure on the page:
  // cards, axes, captions, the variance panel and the CSV export all read these
  // values, so they can never drift apart. Only the two saved components exist
  // in the artifact; no additional components are invented.
  const pc1 = Number(variance[0] ?? 0) * 100;
  const pc2 = Number(variance[1] ?? 0) * 100;
  const retained = Number(cumulative[1] ?? (Number(variance[0] ?? 0) + Number(variance[1] ?? 0))) * 100;
  const remainder = Math.max(0, 100 - retained);
  const remainingComponents = Math.max(0, Number(result.n_categories ?? 0) - 2);
  const pct1 = `${pc1.toFixed(2)}%`;
  const pct2 = `${pc2.toFixed(2)}%`;
  const pctRetained = `${retained.toFixed(2)}%`;
  const pctRemainder = `${remainder.toFixed(2)}%`;

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

  // Search matches drive both the SVG highlight and the keyboard-accessible list.
  const searchMatches = searchQuery.trim()
    ? plotPoints.filter(p => String(p.region).toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : [];

  const activeSelected = selectedPoint || (searchMatches.length === 1 ? searchMatches[0] : null);

  const clearSelection = () => {
    setSelectedPoint(null);
    setSearchQuery('');
  };

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

  // Active component scaled loadings. Positive and negative associations are
  // kept strictly separate: a value only appears under the heading matching its
  // sign, and the list simply holds fewer entries when fewer values qualify.
  const activeLoadingsObj = loadings.find(l => l.component === activeComponent) ?? loadings[0];
  const featureList: any[] = activeLoadingsObj?.features ?? [];
  const positiveFeatures = featureList
    .filter((f: any) => Number(f.loading) > 0)
    .sort((a: any, b: any) => Number(b.loading) - Number(a.loading))
    .slice(0, 10);
  const negativeFeatures = featureList
    .filter((f: any) => Number(f.loading) < 0)
    .sort((a: any, b: any) => Number(a.loading) - Number(b.loading))
    .slice(0, 10);

  const exportRows = plotPoints.map((p: any) => ({
    reporting_unit_id: p.region_id,
    region: p.region,
    pc1: p.x,
    pc2: p.y,
    pc1_variance_pct: Number(pc1.toFixed(2)),
    pc2_variance_pct: Number(pc2.toFixed(2)),
    retained_two_components_pct: Number(retained.toFixed(2)),
    year: 2024,
    release: data.meta.releaseId,
  }));

  return (
    <>
      <PageTitle
        eyebrow="DIMENSIONALITY REDUCTION"
        title="Principal Component Analysis (PCA)"
        description={`Explore the 2024 national crime structure across ${result.n_regions} reporting units and ${result.n_categories} crime features.`}
        action={<ExportButton rows={exportRows} name="pca_scores_2024" />}
      />

      <Filters fixedYear={2024} hideCategory />

      <Notice>
        Model fitted nationally in 2024 on the {number(result.n_regions)}-unit analytical cohort. The State/UT and
        reporting-unit controls do not refit or rescope this saved PCA — they affect other pages only.
      </Notice>

      {/* Variance summary banner — one artifact-derived source for every figure */}
      <div className="stats">
        <Stat
          label="PC1 Explained Variance"
          value={pct1}
          detail="Primary reporting-volume axis (Pearson r ≈ −0.88 with log-volume)"
        />
        <Stat
          label="PC2 Explained Variance"
          value={pct2}
          detail="Secondary axis; separates bodily/dowry offences from public-order and property-nuisance offences"
        />
        <Stat
          label="Retained by 2 Components"
          value={pctRetained}
          detail={`Two saved components retain ${pctRetained} of total feature variance; ~${pctRemainder} remains outside this projection`}
        />
        <Stat
          label="Feature Input Space"
          value={`${result.n_regions} × ${result.n_categories}`}
          detail="Log1p(count) then per-feature population standardisation (ddof = 0)"
        />
      </div>

      <div className="grid two-one" style={{ marginTop: '1rem' }}>
        {/* Scatter Plot Panel */}
        <Panel
          title="PCA score plot"
          subtitle={`Unit scores in the standardized feature space. Nearby points have similar scores; this two-component projection retains ${pctRetained} of total variance and does not preserve all high-dimensional similarities.`}
        >
          {/* Search bar inside panel */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '11px', color: '#9ca3af' }} />
              <input
                type="search"
                aria-label="Search reporting units to highlight on the score plot"
                placeholder="Search district or state to highlight…"
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

          {/* Keyboard-accessible alternative to reading points off the scatter */}
          {searchQuery.trim() && (
            <div style={{ marginBottom: '0.75rem' }}>
              {searchMatches.length === 0 ? (
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>No reporting units match “{searchQuery.trim()}”.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }} aria-label="Matching reporting units">
                  {searchMatches.slice(0, 12).map((p: any) => (
                    <li key={p.region_id}>
                      <button
                        type="button"
                        className={`button small${activeSelected?.region_id === p.region_id ? ' primary' : ''}`}
                        onClick={() => setSelectedPoint(p)}
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
              viewBox="0 0 760 440"
              style={{ width: '100%', minWidth: '600px', height: 'auto', display: 'block' }}
              role="img"
              aria-label="PCA score plot of regional crime profiles"
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
                const isHighlighted = searchMatches.some(h => h.region_id === p.region_id);
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
                      onClick={() => setSelectedPoint(p)}
                    >
                      <title>{`${p.region}\nPC1: ${p.x.toFixed(2)}, PC2: ${p.y.toFixed(2)}`}</title>
                    </circle>
                  </g>
                );
              })}

              {/* Axis Labels */}
              <text x={mLeft + plotW / 2} y={440 - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#374151">
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
            Click a point, or search for a unit and pick it from the list, to inspect its profile. Units at the negative
            PC1 extreme record substantially higher overall crime volumes across most categories; positive-PC1 units
            record lower volumes. This plot is not a safety map and does not represent complete similarity.
          </p>
        </Panel>

        {/* Selected Region / Point Inspector */}
        <div>
          <Panel
            title="Point details & inspection"
            subtitle={activeSelected ? activeSelected.region : 'Select a point on the score plot'}
            action={activeSelected ? <button type="button" className="text-button" onClick={clearSelection}>Clear selection</button> : undefined}
          >
            {activeSelected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px' }}>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>{activeSelected.region}</h3>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                    <Badge tone="neutral">PC1: {signed(activeSelected.x, 2)}</Badge>
                    <Badge tone="neutral">PC2: {signed(activeSelected.y, 2)}</Badge>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                  <p>
                    <strong>PC1 interpretation:</strong> Score of {signed(activeSelected.x, 2)} places this unit in the{' '}
                    {activeSelected.x < 0 ? 'higher volume' : 'lower volume'} half of the national distribution, because PC1 is
                    negatively associated with recorded volume (Pearson r ≈ −0.88 with log-volume).
                  </p>
                  <p>
                    <strong>PC2 interpretation:</strong> Score of {signed(activeSelected.y, 2)} reflects a secondary contrast
                    read from the saved loadings: positive scores load on bodily and dowry-related offences (Dowry Death,
                    Kidnapping to compel marriage, voluntarily causing grievous hurt), while negative scores load on
                    public-order and property-nuisance offences (Affray, day burglary, mischief, criminal trespass).
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
                  View complete regional profile
                </button>
              </div>
            ) : (
              <div className="muted" style={{ padding: '2rem 0', textAlign: 'center' }}>
                <Info size={32} style={{ margin: '0 auto 0.5rem auto', color: '#9ca3af' }} />
                <p>Click a point on the score plot, or search for a region above and choose it from the list, to inspect its coordinates and profile.</p>
              </div>
            )}
          </Panel>

          {/* Variance retained by the two saved components */}
          <Panel title="Variance decomposition" subtitle="Variance retained by the two saved components">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>PC1 (eigenvalue {Number(eigenvalues[0] ?? 0).toFixed(2)})</span>
                  <strong>{pct1}</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pc1}%`, height: '100%', background: '#0d9488' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>PC2 (eigenvalue {Number(eigenvalues[1] ?? 0).toFixed(2)})</span>
                  <strong>{pct2}</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${pc2}%`, height: '100%', background: '#14b8a6' }} />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>Retained by the two saved components</span>
                <strong>{pctRetained}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Remaining components, combined</span>
                <span style={{ color: '#6b7280' }}>{pctRemainder}</span>
              </div>

              <p className="panel-note" style={{ margin: 0 }}>
                The {pctRemainder} remainder is the combined variance of the other {remainingComponents} dimensions, not a
                third saved component. Only the two artifact eigenvalues are shown; no additional spectrum is generated.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      {/* Feature Loadings Definition and Table */}
      <Panel
        title="Scaled component loadings by feature"
        subtitle="Feature contributions to the selected component, read from the saved artifact."
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
        <details className="method-details" style={{ background: '#eff6ff', borderLeft: '3px solid #3b82f6', borderRadius: '4px', fontSize: '0.85rem', marginBottom: '1rem', padding: '0.5rem 0.75rem' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>What these loading values are</summary>
          <div style={{ marginTop: '0.5rem', lineHeight: 1.5 }}>
            <p style={{ margin: '0 0 0.4rem 0' }}>
              Each value below is a <strong>scaled component loading</strong>: lᵢⱼ = vᵢⱼ · √λᵢ, where vᵢⱼ is the
              eigenvector entry for feature j on component i and λᵢ is that component's eigenvalue.
            </p>
            <p style={{ margin: 0 }}>
              These are not normalised eigenvector weights (whose squared entries sum to 1) and they are not exact sample
              Pearson correlations. Depending on the variance divisor convention (population vs sample), they are formally
              scaled component loadings; they still indicate the magnitude and direction of each feature's association with
              the component.
            </p>
          </div>
        </details>

        <div className="grid two-col">
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f766e', fontSize: '0.95rem' }}>
              Largest positive scaled loadings ({activeComponent})
            </h4>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Category</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>Scaled loading (vᵢⱼ · √λᵢ)</th>
                </tr>
              </thead>
              <tbody>
                {positiveFeatures.map((f: any) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '0.4rem', whiteSpace: 'normal', overflowWrap: 'anywhere', maxWidth: '240px' }} title={f.category}>
                      {categoryContextLabel(data, f.id, f.category, 2024)}
                    </td>
                    <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 600, color: '#0f766e' }}>
                      {signed(Number(f.loading), 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {positiveFeatures.length < 10 && (
              <p className="panel-note" style={{ margin: '0.4rem 0 0 0' }}>
                {positiveFeatures.length} of the 131 features load positively on {activeComponent}; the list is not padded.
              </p>
            )}
          </div>

          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#b91c1c', fontSize: '0.95rem' }}>
              Largest negative scaled loadings ({activeComponent})
            </h4>
            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.4rem' }}>Category</th>
                  <th style={{ padding: '0.4rem', textAlign: 'right' }}>Scaled loading (vᵢⱼ · √λᵢ)</th>
                </tr>
              </thead>
              <tbody>
                {negativeFeatures.map((f: any) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '0.4rem', whiteSpace: 'normal', overflowWrap: 'anywhere', maxWidth: '240px' }} title={f.category}>
                      {categoryContextLabel(data, f.id, f.category, 2024)}
                    </td>
                    <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: 600, color: '#b91c1c' }}>
                      {signed(Number(f.loading), 3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {negativeFeatures.length === 0 && (
              <p className="panel-note" style={{ margin: '0.4rem 0 0 0' }}>No strictly negative loadings on {activeComponent}.</p>
            )}
          </div>
        </div>
      </Panel>

      <Notice>
        <strong>Analytical cohort &amp; volume effects:</strong> The PCA is fitted on {number(result.n_regions)} administrative
        districts using log1p-transformed counts standardised per feature (population standard deviation, ddof = 0) across{' '}
        {result.n_categories} crime features. Because population denominators are unavailable, PC1 primarily reflects overall
        reporting volume (Pearson r ≈ −0.88 with log-volume, ≈ −0.71 with raw volume). The two saved components retain{' '}
        {pctRetained} of the total feature variance, so positions in this plot summarise partial profile structure — they are
        not a measure of community safety and are not a complete similarity map.
      </Notice>

      <RegionDetailDrawer
        regionName={drawerRegion}
        onClose={() => setDrawerRegion(null)}
      />
    </>
  );
}
