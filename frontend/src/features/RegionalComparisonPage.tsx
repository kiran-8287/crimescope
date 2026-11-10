import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Search, AlertCircle, Copy, Check } from 'lucide-react';
import { useAnalytics } from '../context/useAnalytics';
import { PageTitle } from '../components/Layout';
import { Filters, Panel, Notice, ExportButton, Badge, UnitTypeBadge } from '../components/UI';
import { Bars, colors } from '../components/Charts';
import { DataTable } from '../components/DataTable';
import { number } from '../utils/format';
import { categoryContextLabel, rawCategoryLabel, categoryContextStatus, categoryParentGroup } from '../utils/categories';
import { getObservationIndex, observationAt } from '../utils/observationIndex';

const MAX_UNITS = 3;

// How a single (reporting unit, category) value was obtained from the ONE successful
// API response behind this page. The three states are kept distinct on screen and in
// the export — a missing source cell is never rendered or exported as zero:
//   value   : a real numeric source value (an explicit 0 renders as "0")
//   missing : the observation row exists but the source cell is null (not published)
//   absent  : no observation row for this unit/category was included in the payload
// A *failed* fetch never reaches render; DataProvider reports it at page level with a
// retry action, so it cannot be confused with either of the two above.
type CellStatus = 'value' | 'missing' | 'absent';
type CellReading = { status: CellStatus; cases: number | null };

function readUnitCell(
  index: ReturnType<typeof getObservationIndex>,
  unitId: string,
  year: number,
  categoryId?: string | null
): CellReading {
  if (!categoryId) return { status: 'absent', cases: null };
  const observation = observationAt(index, unitId, year, categoryId);
  if (!observation) return { status: 'absent', cases: null };
  if (observation.cases === null || observation.cases === undefined) return { status: 'missing', cases: null };
  return { status: 'value', cases: observation.cases };
}

function CellValue({ status, cases }: CellReading) {
  if (status === 'value') return <>{number(cases)}</>;
  if (status === 'missing') {
    return (
      <span
        title="This source cell is present but null — the value was not published. It is not treated as zero."
        style={{ color: '#b45309', fontWeight: 500 }}
      >
        Unavailable<small style={{ color: '#9a7b46', fontWeight: 400 }}> · missing source cell</small>
      </span>
    );
  }
  return (
    <span
      title="No observation row for this reporting unit and category was included in the current API response."
      style={{ color: '#8a958d' }}
    >
      Not returned
    </span>
  );
}

export default function RegionalComparisonPage() {
  const [params] = useSearchParams();
  const { data, filters, eligible, isCurrent, officialTotalId } = useAnalytics();
  const [selection, setSelection] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const listId = useId();

  const observationIndex = getObservationIndex(data.observations);

  // Deep-link support. A comparison may be seeded from the URL with either repeated
  // `region` parameters (`?region=<id>&region=<id>`) or an explicit second unit
  // (`?region=<id>&region2=<id>`). Tokens are matched against stable unit IDs first
  // and only fall back to display names (the older Overview entry path), so a unit
  // can be identified reliably even when two states share a district name.
  const requestedTokens = useMemo(() => {
    const tokens = params.getAll('region');
    const second = params.get('region2');
    if (second) tokens.push(second);
    return tokens.map(token => token.trim()).filter(Boolean);
  }, [params]);
  const tokenSignature = requestedTokens.join('\u001f');
  // Records the token set already applied, so the same URL tokens are consumed once
  // and a unit removed by the user is never silently re-added on the next render.
  const handledTokensRef = useRef('');

  useEffect(() => {
    if (!isCurrent) return;
    if (tokenSignature === handledTokensRef.current) return;
    handledTokensRef.current = tokenSignature;
    if (!requestedTokens.length) return;
    const resolved: string[] = [];
    for (const token of requestedTokens) {
      const byId = eligible.find(region => region.id === token);
      const match = byId ?? eligible.find(region => region.name.toLowerCase() === token.toLowerCase());
      if (match && !resolved.includes(match.id)) resolved.push(match.id);
    }
    if (!resolved.length) return;
    setSelection(previous => {
      const next = [...previous];
      for (const id of resolved) {
        if (!next.includes(id) && next.length < MAX_UNITS) next.push(id);
      }
      return next.length === previous.length ? previous : next;
    });
  }, [tokenSignature, isCurrent, eligible, requestedTokens]);

  // Drop only selections that are invalidated by an actual scope change (year,
  // state or reporting-unit type). Valid units are retained. Skipped while the held
  // dataset is stale so a scope change is reconciled against the new scope only.
  useEffect(() => {
    if (!isCurrent) return;
    setSelection(previous => {
      const next = previous.filter(id => eligible.some(region => region.id === id));
      return next.length === previous.length ? previous : next;
    });
  }, [eligible, isCurrent]);

  const selectedUnits = eligible.filter(region => selection.includes(region.id));
  const categoryId = filters.category === 'all' ? officialTotalId : filters.category;
  const currentCategoryLabel = categoryId
    ? categoryContextLabel(data, categoryId, rawCategoryLabel(data, categoryId), filters.year)
    : 'Official reported total';

  // Headline category (the selected official-total or the filtered category).
  const primaryComparisonRows = selectedUnits.map(region => {
    const cell = readUnitCell(observationIndex, region.id, filters.year, categoryId);
    return {
      id: region.id,
      region: region.name,
      state: region.state,
      regionType: region.regionType ?? 'administrative_district',
      verificationStatus: (region as any).verificationStatus,
      categoryId,
      category: currentCategoryLabel,
      cases: cell.cases,
      dataStatus: cell.status
    };
  });

  const unitTypesInSelection = new Set(selectedUnits.map(unit => unit.regionType ?? 'administrative_district'));
  const hasMixedUnitTypes = unitTypesInSelection.size > 1;

  // The multi-category profile is derived from the categories ACTUALLY present in the
  // response for the selected units — not from a wider top-category list that may not
  // have been fetched. This is what keeps a genuinely absent row distinct from a null
  // source cell and prevents inventing values.
  const profileCategories = useMemo(() => {
    const order = new Map<string, number>();
    (data.topCategories ?? []).forEach((category, index) => {
      if (!order.has(category.id)) order.set(category.id, index);
    });
    const selectedSet = new Set(selection);
    const present = new Set<string>();
    for (const observation of data.observations) {
      if (observation.year !== filters.year) continue;
      if (observation.category === categoryId) continue;
      if (!selectedSet.has(observation.regionId)) continue;
      present.add(observation.category);
    }
    const topById = new Map((data.topCategories ?? []).map(category => [category.id, category]));
    return [...present]
      .sort((a, b) => {
        const oa = order.has(a) ? order.get(a)! : Number.MAX_SAFE_INTEGER;
        const ob = order.has(b) ? order.get(b)! : Number.MAX_SAFE_INTEGER;
        return oa - ob || a.localeCompare(b);
      })
      .map(id => {
        const top = topById.get(id);
        const raw = top?.label ?? rawCategoryLabel(data, id);
        return {
          id,
          label: categoryContextLabel(data, id, raw, filters.year),
          parentGroup: top?.parentGroup ?? categoryParentGroup(data, id),
          role: top?.role ?? 'leaf'
        };
      });
  }, [data.observations, data.topCategories, filters.year, categoryId, selection, data]);

  // Export the whole displayed comparison, not just the headline category: one row per
  // (unit, category) with a status column so missing/absent values stay distinguishable.
  const comparisonExportRows = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    const push = (unit: typeof selectedUnits[number], catId: string, label: string, parentGroup: string, cell: CellReading) => {
      rows.push({
        year: filters.year,
        reporting_unit_id: unit.id,
        reporting_unit: unit.name,
        state_ut: unit.state,
        unit_type: unit.regionType ?? 'administrative_district',
        category_id: catId,
        category_source_label: rawCategoryLabel(data, catId),
        category_display_label: label,
        category_context_status: categoryContextStatus(data, catId, filters.year),
        parent_group: parentGroup,
        reported_cases: cell.status === 'value' ? cell.cases : '',
        data_status: cell.status,
        release: data.meta.releaseId
      });
    };
    if (categoryId) {
      const parentGroup = categoryParentGroup(data, categoryId);
      for (const unit of selectedUnits) {
        push(unit, categoryId, currentCategoryLabel, parentGroup, readUnitCell(observationIndex, unit.id, filters.year, categoryId));
      }
    }
    for (const category of profileCategories) {
      for (const unit of selectedUnits) {
        push(unit, category.id, category.label, category.parentGroup, readUnitCell(observationIndex, unit.id, filters.year, category.id));
      }
    }
    return rows;
  }, [selectedUnits, categoryId, currentCategoryLabel, profileCategories, observationIndex, filters.year, data]);

  const searchMatches = search.trim()
    ? eligible
        .filter(region => `${region.name} ${region.state}`.toLowerCase().includes(search.toLowerCase()) && !selection.includes(region.id))
        .slice(0, 10)
    : [];
  const activeIndexClamped = Math.min(activeIndex, Math.max(0, searchMatches.length - 1));

  const addUnit = (id: string) => {
    setSelection(previous => (previous.includes(id) || previous.length >= MAX_UNITS ? previous : [...previous, id]));
    setSearch('');
    setIsSearchOpen(false);
    setActiveIndex(0);
  };
  const removeUnit = (id: string) => setSelection(previous => previous.filter(x => x !== id));

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') setIsSearchOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(index => Math.min(index + 1, Math.max(0, searchMatches.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      const match = searchMatches[activeIndexClamped];
      if (match) {
        event.preventDefault();
        addUnit(match.id);
      }
    } else if (event.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  const copyComparisonLink = async () => {
    const next = new URLSearchParams(params);
    next.delete('region');
    next.delete('region2');
    selectedUnits.forEach(unit => next.append('region', unit.id));
    const url = `${window.location.origin}${window.location.pathname}?${next.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 2500);
  };

  // Factual comparative sentence for the headline category only. Counts and a numeric
  // difference — no percentage composition and no safety ranking.
  const generateFactualSummary = () => {
    if (primaryComparisonRows.length < 2) return null;
    const valid = primaryComparisonRows.filter(row => row.dataStatus === 'value' && typeof row.cases === 'number') as Array<{ region: string; state: string; cases: number }>;
    if (valid.length < 2) return 'Insufficient reported data to compute a direct numerical difference.';
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

  return (
    <>
      <PageTitle
        eyebrow="SIDE BY SIDE"
        title="Regional comparison"
        description="Select and evaluate reported crime volumes across compatible reporting units."
        action={<ExportButton rows={comparisonExportRows} name={`comparison_${filters.year}`} />}
      />

      <Filters />

      <Panel
        title="Select reporting units to compare"
        subtitle={`Choose up to ${MAX_UNITS} units — search by district or state name, or open a saved comparison link. ${selectedUnits.length} of ${MAX_UNITS} selected.`}
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
                  <span>
                    {unit.name} <small style={{ color: '#6b7280' }}>({unit.state})</small>
                  </span>
                  <UnitTypeBadge regionType={unit.regionType} verificationStatus={(unit as any).verificationStatus} />
                  <button
                    type="button"
                    className="text-button"
                    style={{ padding: '0 2px', display: 'flex', alignItems: 'center' }}
                    onClick={() => removeUnit(unit.id)}
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

          {/* Searchable picker — a keyboard-operable combobox honouring the three-unit limit */}
          {selectedUnits.length < MAX_UNITS ? (
            <div style={{ position: 'relative', maxWidth: '480px' }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', color: '#9ca3af' }} aria-hidden="true" />
                <input
                  type="search"
                  role="combobox"
                  aria-label="Search reporting units to compare"
                  aria-autocomplete="list"
                  aria-expanded={isSearchOpen}
                  aria-controls={listId}
                  aria-activedescendant={isSearchOpen && searchMatches[activeIndexClamped] ? `${listId}-opt-${activeIndexClamped}` : undefined}
                  value={search}
                  placeholder="Type district or state name (e.g. Pune, Patna, Lucknow)..."
                  onChange={event => {
                    setSearch(event.target.value);
                    setIsSearchOpen(true);
                    setActiveIndex(0);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={onSearchKeyDown}
                  style={{ width: '100%', paddingLeft: '32px' }}
                />
              </div>

              {isSearchOpen && (
                <div
                  id={listId}
                  role="listbox"
                  aria-label="Matching reporting units"
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
                  {searchMatches.length === 0 ? (
                    <div style={{ padding: '0.6rem 0.75rem', color: '#6b7280', fontSize: '0.85rem' }}>
                      No matching reporting units in the current scope.
                    </div>
                  ) : (
                    searchMatches.map((match, index) => (
                      <div
                        key={match.id}
                        id={`${listId}-opt-${index}`}
                        role="option"
                        aria-selected={index === activeIndexClamped}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={event => {
                          event.preventDefault();
                          addUnit(match.id);
                        }}
                        style={{
                          padding: '0.5rem 0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid #f3f4f6',
                          background: index === activeIndexClamped ? 'var(--color-surface-hover, #eef4ef)' : 'transparent'
                        }}
                      >
                        <div>
                          <strong>{match.name}</strong> <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>· {match.state}</span>
                        </div>
                        <Badge tone={match.regionType === 'administrative_district' ? 'neutral' : 'amber'}>
                          {match.regionType?.replace('_', ' ')}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Maximum of {MAX_UNITS} reporting units selected. Remove one to add another.
            </div>
          )}

          {selectedUnits.length > 0 && (
            <button type="button" className="button small" style={{ alignSelf: 'flex-start' }} onClick={copyComparisonLink}>
              {copyState === 'copied' ? (
                <>
                  <Check size={14} /> Link copied
                </>
              ) : copyState === 'error' ? (
                <>
                  <AlertCircle size={14} /> Copy failed
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy comparison link
                </>
              )}
            </button>
          )}
        </div>
      </Panel>

      {hasMixedUnitTypes && (
        <Notice tone="warning">
          <strong>Non-comparable reporting units:</strong> You have selected different reporting-unit types (for example administrative districts alongside city-police, railway or other specialized units). City commissionerates and railway jurisdictions have distinct population densities, specialized remits and non-coterminous borders, so their recorded counts are not on a like-for-like basis.
        </Notice>
      )}

      {selectedUnits.length > 0 ? (
        <>
          <Panel
            title={`Comparison: ${currentCategoryLabel}`}
            subtitle={`${filters.year} reported counts for the selected units.`}
          >
            <Bars
              items={primaryComparisonRows.map((row, i) => ({
                label: `${row.region} (${row.state})`,
                value: row.cases,
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
                  render: (row: any) => (
                    <UnitTypeBadge regionType={row.regionType} verificationStatus={row.verificationStatus} />
                  )
                },
                { key: 'category', label: 'Category' },
                {
                  key: 'cases',
                  label: 'Reported cases',
                  render: (row: any) => <CellValue status={row.dataStatus} cases={row.cases} />
                }
              ]}
            />
          </Panel>

          <Panel
            title="Multi-category profile comparison"
            subtitle={`${filters.year} reported counts across the profile categories returned for the selected units.`}
          >
            {profileCategories.length === 0 ? (
              <Notice>
                The current response includes only the selected category for these units, so there are no additional profile
                categories to compare. Use the Crime Category filter to choose another category, or select units from a different
                state or reporting-unit type.
              </Notice>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border, #e5e7eb)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Category</th>
                        <th style={{ padding: '0.5rem' }}>Parent group</th>
                        {selectedUnits.map((unit, i) => (
                          <th key={unit.id} style={{ padding: '0.5rem', textAlign: 'right', color: colors[i % colors.length] }}>
                            {unit.name}
                            <small style={{ display: 'block', color: '#6b7280', fontWeight: 400 }}>{unit.state}</small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {profileCategories.map(category => (
                        <tr key={category.id} style={{ borderBottom: '1px solid var(--color-border, #f3f4f6)' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>{category.label}</td>
                          <td style={{ padding: '0.5rem', color: '#6b7280' }}>{category.parentGroup}</td>
                          {selectedUnits.map(unit => {
                            const cell = readUnitCell(observationIndex, unit.id, filters.year, category.id);
                            return (
                              <td key={unit.id} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 500 }}>
                                <CellValue status={cell.status} cases={cell.cases} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#8a958d', marginTop: '0.75rem', lineHeight: 1.6 }}>
                  Categories listed are those actually returned for the selected units in the current API response. An explicit
                  zero is shown as 0. <strong>Unavailable</strong> marks a source cell that is present but null (not published);
                  it is never shown as zero. <strong>Not returned</strong> marks a unit/category row absent from the response. A
                  failed request is reported at page level with a retry action, so no value here is ever synthesised.
                </p>
              </>
            )}
          </Panel>
        </>
      ) : (
        <Notice>
          Select one to three reporting units using the search above to generate a side-by-side comparison. You can also open a
          comparison directly with <code>?region=&lt;unit-id&gt;&amp;region2=&lt;unit-id&gt;</code>.
        </Notice>
      )}

      <Notice>
        Raw counts reflect recorded volume and do not account for population differences. Valid population denominator data is
        not published in these NCRB tables, so no rate, share or safety ranking is implied.
      </Notice>
    </>
  );
}
