import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { X, Search, BarChart3, AlertCircle } from 'lucide-react';
import { useAnalytics } from '../context/useAnalytics';
import { PageTitle } from '../components/Layout';
import { Filters, Panel, Notice, ExportButton, Badge } from '../components/UI';
import { Bars, colors } from '../components/Charts';
import { DataTable } from '../components/DataTable';
import { number } from '../utils/format';
import { categoryLabel, cleanCategoryName } from '../utils/categories';
import { getObservationIndex, observationAt } from '../utils/observationIndex';

export default function RegionalComparisonPage() {
  const [params, setParams] = useSearchParams();
  const { data, filters, eligible, officialTotalId } = useAnalytics();
  const [selection, setSelection] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const observationIndex = getObservationIndex(data.observations);

  // Check if a region was passed in the query parameter (e.g. from Overview)
  useEffect(() => {
    const paramRegion = params.get('region');
    if (paramRegion) {
      const match = eligible.find(r => r.name.toLowerCase() === paramRegion.toLowerCase());
      if (match && !selection.includes(match.id)) {
        setSelection(prev => [...prev.filter(id => id !== match.id), match.id].slice(0, 3));
      }
    }
  }, [params, eligible]);

  // Clean selections if eligible units change
  useEffect(() => {
    setSelection(prev => prev.filter(id => eligible.some(r => r.id === id)));
  }, [eligible]);

  const selectedUnits = eligible.filter(r => selection.includes(r.id));
  const categoryId = filters.category === 'all' ? officialTotalId : filters.category;
  const currentCategoryLabel = categoryId ? categoryLabel(data, categoryId) : 'Official reported total';

  // Results for the primary selected category
  const primaryComparisonRows = selectedUnits.map(r => {
    const obs = categoryId ? observationAt(observationIndex, r.id, filters.year, categoryId) : undefined;
    return {
      id: r.id,
      region: r.name,
      state: r.state,
      regionType: r.regionType ?? 'administrative_district',
      categoryId,
      category: currentCategoryLabel,
      cases: obs?.cases ?? null
    };
  });

  // Check if different reporting unit types are being compared
  const unitTypesInSelection = new Set(selectedUnits.map(u => u.regionType));
  const hasMixedUnitTypes = unitTypesInSelection.size > 1;

  // Search filtering
  const searchMatches = search.trim()
    ? eligible.filter(r => `${r.name} ${r.state}`.toLowerCase().includes(search.toLowerCase()) && !selection.includes(r.id)).slice(0, 10)
    : [];

  // Generate factual comparative sentences
  const generateFactualSummary = () => {
    if (primaryComparisonRows.length < 2) return null;
    const valid = primaryComparisonRows.filter(r => typeof r.cases === 'number') as Array<{ region: string; state: string; cases: number }>;
    if (valid.length < 2) return "Insufficient reported data to compute direct numerical difference.";
    const sorted = [...valid].sort((a, b) => b.cases - a.cases);
    const top = sorted[0];
    const second = sorted[1];
    const diff = top.cases - second.cases;
    const ratio = second.cases > 0 ? (top.cases / second.cases).toFixed(1) : null;

    if (diff === 0) {
      return `In ${filters.year}, both ${top.region} (${top.state}) and ${second.region} (${second.state}) recorded identical counts of ${number(top.cases)} cases in ${currentCategoryLabel}.`;
    }
    return `In ${filters.year}, ${top.region} (${top.state}) recorded ${number(top.cases)} cases of ${currentCategoryLabel}, which is ${number(diff)} more cases than ${second.region} (${second.state}, ${number(second.cases)} cases)${ratio ? ` (${ratio}× as many)` : ''}.`;
  };

  const factualSummary = generateFactualSummary();

  // Top multi-category comparison profile
  const comparisonCategories = data.topCategories?.filter(c => c.role !== 'official_total').slice(0, 5) ?? [];

  return (
    <>
      <PageTitle
        eyebrow="SIDE BY SIDE"
        title="Regional comparison"
        description="Select and evaluate reported crime volumes across compatible reporting units."
        action={<ExportButton rows={primaryComparisonRows} name={`comparison_${filters.year}`} />}
      />

      <Filters />

      <Panel
        title="Select reporting units to compare"
        subtitle="Choose up to 3 units. You can search by district or state name."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Selected Unit Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', minHeight: '38px' }}>
            {selectedUnits.length === 0 ? (
              <span className="muted" style={{ fontStyle: 'italic', fontSize: '0.9rem' }}>
                No regions selected. Search below to choose up to three reporting units.
              </span>
            ) : (
              selectedUnits.map((unit, i) => (
                <div
                  key={unit.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.6rem',
                    background: 'var(--color-surface-subtle, #f3f4f6)',
                    border: `2px solid ${colors[i % colors.length]}`,
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    fontWeight: 500
                  }}
                >
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[i % colors.length] }} />
                  <span>{unit.name} <small style={{ color: '#6b7280' }}>({unit.state})</small></span>
                  <Badge tone={unit.regionType === 'administrative_district' ? 'neutral' : 'amber'}>
                    {unit.regionType?.replace('_', ' ')}
                  </Badge>
                  <button
                    type="button"
                    className="text-button"
                    style={{ padding: '0 2px', display: 'flex', alignItems: 'center' }}
                    onClick={() => setSelection(selection.filter(id => id !== unit.id))}
                    aria-label={`Remove ${unit.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
            {selectedUnits.length > 0 && (
              <button
                type="button"
                className="text-button"
                style={{ fontSize: '0.8rem', marginLeft: 'auto' }}
                onClick={() => setSelection([])}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Search Region Input */}
          {selectedUnits.length < 3 && (
            <div style={{ position: 'relative', maxWidth: '480px' }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', color: '#9ca3af' }} />
                <input
                  type="search"
                  value={search}
                  placeholder="Type district or state name (e.g. Pune, Patna, Lucknow)..."
                  onChange={e => {
                    setSearch(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  style={{ width: '100%', paddingLeft: '32px' }}
                />
              </div>

              {isSearchOpen && searchMatches.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    background: 'var(--color-surface, #ffffff)',
                    border: '1px solid var(--color-border, #d1d5db)',
                    borderRadius: '6px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    marginTop: '4px',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}
                >
                  {searchMatches.map(m => (
                    <div
                      key={m.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid #f3f4f6'
                      }}
                      onClick={() => {
                        setSelection([...selection, m.id]);
                        setSearch('');
                        setIsSearchOpen(false);
                      }}
                    >
                      <div>
                        <strong>{m.name}</strong> <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>· {m.state}</span>
                      </div>
                      <Badge tone={m.regionType === 'administrative_district' ? 'neutral' : 'amber'}>
                        {m.regionType?.replace('_', ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>

      {hasMixedUnitTypes && (
        <Notice tone="warning">
          <strong>Non-comparable reporting units:</strong> You have selected both administrative districts and specialized or city-police units. City commissionerates and railway jurisdictions have distinct population densities, specialized remits, and non-coterminous borders.
        </Notice>
      )}

      {selectedUnits.length > 0 ? (
        <>
          <Panel
            title={`Comparison: ${currentCategoryLabel}`}
            subtitle={`${filters.year} reported counts for selected units.`}
          >
            <Bars
              items={primaryComparisonRows.map((r, i) => ({
                label: `${r.region} (${r.state})`,
                value: r.cases,
                color: colors[i % colors.length]
              }))}
              unit="cases"
            />
            {factualSummary && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: 'var(--color-surface-subtle, #f9fafb)',
                  borderLeft: '3px solid var(--color-primary, #0f766e)',
                  borderRadius: '4px',
                  fontSize: '0.9rem'
                }}
              >
                <strong>Comparative finding:</strong> {factualSummary}
              </div>
            )}
          </Panel>

          <Panel title="Reported values and classification summary">
            <DataTable
              searchable={false}
              rows={primaryComparisonRows}
              columns={[
                { key: 'region', label: 'Reporting unit' },
                { key: 'state', label: 'State / UT' },
                {
                  key: 'regionType',
                  label: 'Unit type',
                  render: (r: any) => (
                    <Badge tone={r.regionType === 'administrative_district' ? 'neutral' : 'amber'}>
                      {String(r.regionType).replace('_', ' ')}
                    </Badge>
                  )
                },
                { key: 'category', label: 'Category' },
                {
                  key: 'cases',
                  label: 'Reported cases',
                  render: (r: any) => number(r.cases as number | null)
                }
              ]}
            />
          </Panel>

          {comparisonCategories.length > 0 && (
            <Panel
              title="Multi-category profile comparison"
              subtitle="Recorded cases across top major crime categories in 2024."
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border, #e5e7eb)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Category</th>
                      <th style={{ padding: '0.5rem' }}>Parent Group</th>
                      {selectedUnits.map((u, i) => (
                        <th key={u.id} style={{ padding: '0.5rem', textAlign: 'right', color: colors[i % colors.length] }}>
                          {u.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonCategories.map(cat => {
                      return (
                        <tr key={cat.id} style={{ borderBottom: '1px solid var(--color-border, #f3f4f6)' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>{cat.cleanLabel}</td>
                          <td style={{ padding: '0.5rem', color: '#6b7280' }}>{cat.parentGroup}</td>
                          {selectedUnits.map(u => {
                            const obs = observationAt(observationIndex, u.id, filters.year, cat.id);
                            return (
                              <td key={u.id} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>
                                {number(obs?.cases ?? null)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      ) : (
        <Notice>
          Select one to three reporting units using the search bar above to generate a side-by-side comparison.
        </Notice>
      )}

      <Notice>
        Raw counts reflect recorded volume and do not account for population differences. Valid population denominator data is not published in these NCRB tables.
      </Notice>
    </>
  );
}
