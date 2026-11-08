import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Info, Download, X, Layers, ExternalLink } from 'lucide-react';
import { useFilters } from '../context/useFilters';
import { useData } from '../context/DataContext';
import { downloadCsv, number } from '../utils/format';
import { cleanCategoryName, categoryParentGroup, rawCategoryLabel, categoryContextLabel, categoryContextLabelByRaw } from '../utils/categories';

export function Panel({ title, subtitle, action, children, className = '' }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Notice({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warning' | 'amber' }) {
  return (
    <div className={`notice ${tone !== 'neutral' ? tone : ''}`}>
      <Info size={16} />
      <span>{children}</span>
    </div>
  );
}

export function Empty({ children = 'No records match this selection.' }: { children?: ReactNode }) {
  return (
    <div className="empty">
      <Info size={24} />
      <p>{children}</p>
    </div>
  );
}

export function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <span className="stat-detail">{detail}</span>
    </div>
  );
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: string; title?: string }) {
  return <span className={`badge ${tone}`} title={title}>{children}</span>;
}

export function UnitTypeBadge({ regionType, verificationStatus }: { regionType?: string; verificationStatus?: string }) {
  const type = regionType ?? 'administrative_district';
  if (type === 'administrative_district') {
    const isVerified = verificationStatus === 'source_verified';
    return (
      <Badge
        tone={isVerified ? 'green' : 'neutral'}
        title={isVerified ? 'Source-verified administrative district' : 'Inferred from source naming patterns; not verified against state gazetteers'}
      >
        {isVerified ? 'district (verified)' : 'district (inferred)'}
      </Badge>
    );
  }
  return (
    <Badge tone="amber">
      {String(type).replace('_', ' ')}
    </Badge>
  );
}

export function ExportButton({ rows, name = 'crimescope' }: { rows: Record<string, unknown>[]; name?: string }) {
  const { isDemo } = useData();
  return (
    <button className="button" disabled={!rows.length} onClick={() => downloadCsv(rows, `${isDemo ? 'DEMO_' : ''}${name}.csv`)}>
      <Download size={15} />
      Export CSV
    </button>
  );
}

export function Filters({ fixedYear, hideCategory = false }: { fixedYear?: number; hideCategory?: boolean }) {
  const { data } = useData();
  const { filters, update, reset, states, categories, years, unitTypes } = useFilters();

  const unitTypeLabels: Record<string, string> = {
    all: 'All reporting units',
    administrative_district: 'Administrative districts (inferred)',
    city_police: 'City-police commissionerates',
    railway: 'Railway police units',
    other_police_unit: 'Specialized & rural police units',
  };

  const selectedCategory = categories.find(c => c.id === filters.category);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Group categories by parent group for structured exploration
  const categorized = categories.map(c => ({
    id: c.id,
    cleanName: cleanCategoryName(c.label),
    contextLabel: categoryContextLabel(data, c.id, c.label, filters.year),
    rawLabel: c.label,
    parent: categoryParentGroup(data, c.id),
    role: (c.rolesByYear?.[String(filters.year)] ?? ['leaf'])[0],
  })).sort((a, b) => a.parent.localeCompare(b.parent) || a.cleanName.localeCompare(b.cleanName));

  const filteredCategories = searchTerm.trim()
    ? categorized.filter(c => `${c.cleanName} ${c.parent} ${c.rawLabel}`.toLowerCase().includes(searchTerm.toLowerCase()))
    : categorized;

  return (
    <div className="filterbar">
      {fixedYear ? (
        <label>
          Analysis Run
          <select disabled value={fixedYear}>
            <option value={fixedYear}>{fixedYear} National Run</option>
          </select>
        </label>
      ) : (
        <label>
          Reporting Year
          <select value={filters.year} onChange={e => update('year', e.target.value)}>
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
      )}

      <label>
        State / UT
        <select value={filters.state} onChange={e => update('state', e.target.value)}>
          <option value="all">All states / UTs (National)</option>
          {states.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <label>
        Reporting Units
        <select value={filters.unitType} onChange={e => update('unitType', e.target.value)}>
          <option value="all">All reporting units</option>
          {unitTypes.map(t => (
            <option key={t} value={t}>{unitTypeLabels[t] ?? t}</option>
          ))}
        </select>
      </label>

      {!hideCategory && (
        <div className="category-filter-group" style={{ position: 'relative' }}>
          <label>
            Crime Category
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <select
                value={filters.category === 'all' ? 'all' : 'custom'}
                onChange={e => {
                  if (e.target.value === 'all') {
                    update('category', 'all');
                    setIsDropdownOpen(false);
                  } else {
                    setIsDropdownOpen(true);
                  }
                }}
              >
                <option value="all">Official Reported Total</option>
                <option value="custom">Select a crime category...</option>
              </select>
              {filters.category !== 'all' && (
                <button
                  type="button"
                  className="button small"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  title={rawCategoryLabel(data, filters.category)}
                >
                  {selectedCategory ? categoryContextLabel(data, filters.category, selectedCategory.label, filters.year) : 'Choose category'} ▾
                </button>
              )}
            </div>
          </label>

          {isDropdownOpen && (
            <div
              className="category-dropdown-panel"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 50,
                minWidth: '340px',
                maxWidth: '460px',
                background: 'var(--color-surface, #ffffff)',
                border: '1px solid var(--color-border, #d1d5db)',
                borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                padding: '0.5rem',
                marginTop: '4px'
              }}
            >
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
                <input
                  type="search"
                  autoFocus
                  placeholder="Search categories or parent groups..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.875rem' }}
                />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setIsDropdownOpen(false)}
                  style={{ padding: '0 0.4rem' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                <div
                  style={{
                    padding: '0.4rem 0.5rem',
                    cursor: 'pointer',
                    fontWeight: filters.category === 'all' ? 'bold' : 'normal',
                    backgroundColor: filters.category === 'all' ? 'var(--color-surface-hover, #f3f4f6)' : 'transparent',
                    borderBottom: '1px solid var(--color-border, #e5e7eb)'
                  }}
                  onClick={() => {
                    update('category', 'all');
                    setIsDropdownOpen(false);
                  }}
                >
                  ★ Official Reported Total (All Crimes)
                </div>
                {filteredCategories.map(cat => (
                  <div
                    key={cat.id}
                    style={{
                      padding: '0.4rem 0.5rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      backgroundColor: filters.category === cat.id ? 'var(--color-surface-hover, #f3f4f6)' : 'transparent',
                      borderBottom: '1px solid #f9fafb'
                    }}
                    onClick={() => {
                      update('category', cat.id);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{cat.contextLabel}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted, #6b7280)' }}>
                      {cat.parent} · {cat.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {data.meta.categoryDisplay?.compositionSharesAvailable && (
        <label>
          Metric
          <select value={filters.metric} onChange={e => update('metric', e.target.value)}>
            <option value="count">Reported cases</option>
            <option value="share">Category share (%)</option>
          </select>
        </label>
      )}

      <button className="text-button" onClick={reset}>Reset</button>
    </div>
  );
}

export function RegionDetailDrawer({
  regionName,
  stateName,
  kmeansK,
  onClose,
  onCompare
}: {
  regionName: string | null;
  stateName?: string;
  // Which saved K-means model to read the cluster membership from. When omitted
  // the drawer shows the documented default model (k = 3) and says so explicitly.
  kmeansK?: number;
  onClose: () => void;
  onCompare?: (regionName: string) => void;
}) {
  const { data } = useData();
  const { filters } = useFilters();

  if (!regionName) return null;

  // Find region in 2024
  const regionObj = data.regions.find(r => r.name.toLowerCase() === regionName.toLowerCase() && (!stateName || r.state.toLowerCase() === stateName.toLowerCase()));
  const state = regionObj?.state ?? stateName ?? 'Unknown';
  const regionType = regionObj?.regionType ?? 'administrative_district';

  // Find observations for this region in the current view
  const observations = data.observations.filter(o => o.region.toLowerCase() === regionName.toLowerCase() && (!stateName || o.state.toLowerCase() === stateName.toLowerCase()));

  // Read the saved cluster membership for the requested model. No clustering is
  // recomputed in the browser; membership comes directly from the saved artifact.
  const kForDrawer = kmeansK ?? 3;
  const kmeansAvailable = data.methods?.kmeans?.status === 'available';
  const km = data.methods?.kmeans?.results?.[kForDrawer];
  const clusterAssignment = km?.assignment_records?.find((r: any) =>
    (regionObj?.id ? r.region_id === regionObj.id : false) ||
    (!regionObj?.id && r.region?.toLowerCase().includes(regionName.toLowerCase()))
  );

  // Find PCA scores if available
  const pcaMethod = data.methods?.pca?.result;
  const pcaScore = pcaMethod?.components?.find((c: any) => c.region?.toLowerCase().includes(regionName.toLowerCase()));

  // Find any anomalies for this region
  const anomalies = (data.methods?.anomalies?.result ?? []).filter((a: any) => a.region?.toLowerCase().includes(regionName.toLowerCase()));

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '420px',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border, #e5e7eb)', paddingBottom: '0.75rem' }}>
        <div>
          <span className="eyebrow" style={{ textTransform: 'uppercase', fontSize: '0.75rem', color: '#6b7280' }}>
            {regionType.replace('_', ' ')} · {state}
          </span>
          <h2 style={{ margin: '0.2rem 0', fontSize: '1.4rem' }}>{regionName}</h2>
        </div>
        <button className="text-button" onClick={onClose}><X size={20} /></button>
      </div>

      <div>
        <h4 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.85rem', color: '#4b5563' }}>Analytical Profile (2024 National Cohort)</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div style={{ background: 'var(--color-surface-subtle, #f9fafb)', padding: '0.6rem', borderRadius: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>K-Means Cluster (k = {kForDrawer})</span>
            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
              {!kmeansAvailable
                ? 'Unavailable'
                : clusterAssignment
                  ? `Cluster ${Number(clusterAssignment.cluster_id) + 1}`
                  : 'Not in this cohort'}
            </div>
          </div>
          <div style={{ background: 'var(--color-surface-subtle, #f9fafb)', padding: '0.6rem', borderRadius: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>PCA Coordinates</span>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {pcaScore ? `PC1: ${pcaScore.scores[0]?.score?.toFixed(1)}, PC2: ${pcaScore.scores[1]?.score?.toFixed(1)}` : 'Calculated'}
            </div>
          </div>
        </div>
        <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '0.4rem 0 0 0' }}>
          {kmeansK == null
            ? `Cluster membership read from the default saved model (k = 3). Open this unit from the Clusters page to view its currently selected k.`
            : `Cluster membership read from the saved k = ${kForDrawer} model selected on the Clusters page.`}
        </p>
      </div>

      {anomalies.length > 0 && (
        <div>
          <h4 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.85rem', color: '#b45309' }}>
            Flagged Statistical Observations ({anomalies.length})
          </h4>
          <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #fde68a', borderRadius: '4px', background: '#fffbeb', padding: '0.4rem' }}>
            {anomalies.map((a: any, idx: number) => (
              <div key={idx} style={{ fontSize: '0.8rem', padding: '0.2rem 0', borderBottom: idx < anomalies.length - 1 ? '1px solid #fef3c7' : 'none' }}>
                <strong>{categoryContextLabelByRaw(data, a.category, 2024)}</strong>: {a.value} cases (z-score: {Number(a.z_score).toFixed(2)})
              </div>
            ))}
          </div>
        </div>
      )}

      {observations.length > 0 && (
        <div>
          <h4 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.85rem', color: '#4b5563' }}>Recorded Observations in Current View</h4>
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                <th style={{ padding: '0.3rem' }}>Year</th>
                <th style={{ padding: '0.3rem' }}>Category</th>
                <th style={{ padding: '0.3rem', textAlign: 'right' }}>Cases</th>
              </tr>
            </thead>
            <tbody>
              {observations.map((o, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.3rem' }}>{o.year}</td>
                  <td style={{ padding: '0.3rem' }}>{categoryContextLabel(data, o.category, o.categoryLabel, o.year)}</td>
                  <td style={{ padding: '0.3rem', textAlign: 'right', fontWeight: 500 }}>{number(o.cases)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '0.5rem' }}>
        {onCompare && (
          <button className="button primary" style={{ flex: 1 }} onClick={() => onCompare(regionName)}>
            Compare this region
          </button>
        )}
        <button className="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
