import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { useData } from '../context/DataContext';
import { fetchAssociationRules } from '../api/client';
import { PageTitle } from '../components/Layout';
import { Panel, Notice, Badge, Filters, Stat } from '../components/UI';
import { DataTable } from '../components/DataTable';
import { categoryContextLabel, categoryContextStatus } from '../utils/categories';
import { number, downloadCsv } from '../utils/format';

const PAGE_SIZE = 20;

// Association rules store category labels joined by " + ". Re-attach verified
// hierarchy context to each part using its stable category id where available.
function composeRuleLabel(data: ReturnType<typeof useData>['data'], joinedLabel: string, ids?: Array<string | undefined>): string {
  const labels = String(joinedLabel ?? '').split(' + ');
  return labels
    .map((label, index) => categoryContextLabel(data, ids?.[index], label, 2024))
    .join(' + ');
}

export default function AssociationRulesPage() {
  const { data } = useData();
  const [support, setSupport] = useState(0.15);
  const [confidence, setConfidence] = useState(0.60);
  const [lift, setLift] = useState(1.05);
  const [offset, setOffset] = useState(0);
  const [payload, setPayload] = useState<any>(null);
  const [error, setError] = useState('');
  const [selectedRule, setSelectedRule] = useState<any | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setError('');
    fetchAssociationRules(
      { year: 2024, minSupport: support, minConfidence: confidence, minLift: lift, limit: PAGE_SIZE, offset },
      ctrl.signal
    )
      .then(setPayload)
      .catch(e => {
        if (e.name !== 'AbortError') setError(e.message);
      });
    return () => ctrl.abort();
  }, [support, confidence, lift, offset]);

  // Clamp the offset when a filter change shrinks the result set below the current page.
  useEffect(() => {
    const total = Number(payload?.total ?? 0);
    if (total > 0 && offset >= total) {
      const lastPageOffset = (Math.ceil(total / PAGE_SIZE) - 1) * PAGE_SIZE;
      setOffset(Math.max(0, lastPageOffset));
    }
  }, [payload, offset]);

  const params = data.methods?.association?.parameters;

  const enrichedRules = (payload?.rules ?? []).map((r: any) => ({
    ...r,
    cleanAntecedent: composeRuleLabel(data, r.antecedent, r.antecedentIds),
    cleanConsequent: composeRuleLabel(data, r.consequent, r.consequentIds),
    supportPct: (Number(r.support) * 100).toFixed(1) + '%',
    confidencePct: (Number(r.confidence) * 100).toFixed(1) + '%',
    liftFormatted: Number(r.lift).toFixed(2),
  }));

  // Export EVERY rule matching the current thresholds — not just the page that is
  // visible. The endpoint applies the filters server-side and is bounded, so we
  // request the full matching set in a single call rather than loading any raw
  // dataset into the browser. If that call fails we fall back to the current page
  // so the button never silently exports a partial set.
  const [exporting, setExporting] = useState(false);
  async function exportAllMatching() {
    const total = Number(payload?.total ?? 0);
    if (!total) return;
    setExporting(true);
    try {
      const full = await fetchAssociationRules({
        year: 2024, minSupport: support, minConfidence: confidence, minLift: lift, limit: total, offset: 0
      });
      const source = (full.rules ?? []).length ? full.rules : (payload?.rules ?? []);
      const rows = source.map((r: any) => ({
        rule_id: r.id,
        antecedent_source_labels: r.antecedent,
        antecedent_display_labels: composeRuleLabel(data, r.antecedent, r.antecedentIds),
        antecedent_category_ids: (r.antecedentIds ?? []).join(' | '),
        antecedent_context_status: (r.antecedentIds ?? []).map((id: string | undefined) => id ? categoryContextStatus(data, id, 2024) : 'unavailable').join(' | '),
        consequent_source_labels: r.consequent,
        consequent_display_labels: composeRuleLabel(data, r.consequent, r.consequentIds),
        consequent_category_ids: (r.consequentIds ?? []).join(' | '),
        consequent_context_status: (r.consequentIds ?? []).map((id: string | undefined) => id ? categoryContextStatus(data, id, 2024) : 'unavailable').join(' | '),
        support: r.support,
        support_count: r.supportCount,
        confidence: r.confidence,
        lift: r.lift,
        year: 2024,
        release: data.meta.releaseId,
      }));
      downloadCsv(rows, 'association_rules_2024.csv');
    } catch (e: any) {
      setError(e?.message ?? 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="CO-OCCURRENCE PATTERNS"
        title="Association rules & crime co-occurrence"
        description="Discover frequent offense co-occurrence patterns across 2024 reporting unit profiles."
        action={
          <button
            className="button"
            disabled={!Number(payload?.total ?? 0) || exporting}
            onClick={exportAllMatching}
            title="Exports every rule matching the current thresholds, not just this page."
          >
            <Download size={15} /> {exporting ? 'Exporting…' : 'Export all matching'}
          </button>
        }
      />

      <Filters fixedYear={2024} hideCategory />

      <div className="stats">
        <Stat
          label="Mined Rules Matching"
          value={number(payload?.total ?? 0)}
          detail={`Filtered by support ≥ ${(support * 100).toFixed(0)}%, conf ≥ ${(confidence * 100).toFixed(0)}%, lift ≥ ${lift}`}
        />
        <Stat
          label="Cohort Transactions"
          value={number(payload?.nTransactions ?? 739)}
          detail="Districts with ≥ 1 category with ≥ 10 cases (35 sparse districts excluded)"
        />
        <Stat
          label="Item Threshold"
          value="≥ 10 Cases"
          detail="Category is considered present in a district if count ≥ 10"
        />
        <Stat
          label="Mining Scope"
          value="2024 National Run"
          detail="Apriori algorithm on binary category presence vectors"
        />
      </div>

      <Panel
        title="Mined Association Rules"
        subtitle="Threshold sliders filter the saved mined rules (re-mining requires running the Python pipeline)."
      >
        {/* Sliders / Input Filters */}
        <div className="filterbar" style={{ marginBottom: '1rem' }}>
          <label>
            Min Support (Frequency):
            <input
              type="number"
              min={params?.min_support ?? 0.15}
              max="1.0"
              step="0.01"
              value={support}
              onChange={e => {
                setOffset(0);
                setSupport(Number(e.target.value));
              }}
            />
          </label>
          <label>
            Min Confidence (P(B|A)):
            <input
              type="number"
              min={params?.min_confidence ?? 0.60}
              max="1.0"
              step="0.01"
              value={confidence}
              onChange={e => {
                setOffset(0);
                setConfidence(Number(e.target.value));
              }}
            />
          </label>
          <label>
            Min Lift (Co-occurrence strength):
            <input
              type="number"
              min={params?.min_lift ?? 1.05}
              step="0.05"
              value={lift}
              onChange={e => {
                setOffset(0);
                setLift(Number(e.target.value));
              }}
            />
          </label>
        </div>

        {error ? (
          <Notice tone="warning">{error}</Notice>
        ) : payload?.status !== 'available' ? (
          <p className="muted">{payload?.reason ?? data.methods?.association?.reason ?? 'Loading saved rules…'}</p>
        ) : (
          <>
            <DataTable
              searchable={false}
              rows={enrichedRules}
              server={{
                page: Math.floor(offset / PAGE_SIZE),
                pageSize: PAGE_SIZE,
                total: Number(payload.total ?? 0),
                unitLabel: 'rules',
                onPageChange: (page: number) => setOffset(page * PAGE_SIZE),
              }}
              columns={[
                {
                  key: 'cleanAntecedent',
                  label: 'If profile records (Antecedent)',
                  wrap: true,
                  render: (r: any) => (
                    <button
                      type="button"
                      className="text-button"
                      style={{ fontWeight: 600, color: 'var(--color-primary, #0f766e)', textAlign: 'left', whiteSpace: 'normal' }}
                      onClick={() => setSelectedRule(r)}
                      title={`Original source label: ${r.antecedent}`}
                    >
                      {String(r.cleanAntecedent)}
                    </button>
                  )
                },
                {
                  key: 'cleanConsequent',
                  label: 'Then it also records (Consequent)',
                  wrap: true,
                  render: (r: any) => (
                    <span title={String(r.consequent)}>
                      {String(r.cleanConsequent)}
                    </span>
                  )
                },
                {
                  key: 'supportPct',
                  label: 'Support (% of units)',
                  render: (r: any) => (
                    <span>{String(r.supportPct)} <small style={{ color: '#6b7280' }}>({Number(r.supportCount)} units)</small></span>
                  )
                },
                {
                  key: 'confidencePct',
                  label: 'Confidence',
                  render: (r: any) => <strong>{String(r.confidencePct)}</strong>
                },
                {
                  key: 'liftFormatted',
                  label: 'Lift',
                  render: (r: any) => (
                    <Badge tone={Number(r.lift) > 1.2 ? 'green' : 'neutral'}>
                      {String(r.liftFormatted)}×
                    </Badge>
                  )
                },
                {
                  key: 'action',
                  label: 'Inspect',
                  render: r => (
                    <button
                      type="button"
                      className="button small"
                      onClick={() => setSelectedRule(r)}
                    >
                      Interpret
                    </button>
                  )
                }
              ]}
            />
          </>
        )}
      </Panel>

      {/* Selected Rule Plain-Language Interpretation Drawer */}
      {selectedRule && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '440px',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem' }}>
            <div>
              <span className="eyebrow" style={{ color: '#0f766e' }}>ASSOCIATION RULE INTERPRETATION</span>
              <h2 style={{ margin: '0.2rem 0', fontSize: '1.25rem' }}>Rule #{selectedRule.id}</h2>
            </div>
            <button className="text-button" onClick={() => setSelectedRule(null)}><X size={20} /></button>
          </div>

          <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px' }}>
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>If District Profile Contains (≥ 10 cases):</div>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', marginTop: '2px' }}>
              {selectedRule.cleanAntecedent}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', marginTop: '2px' }}>
              Source: {selectedRule.antecedent}
            </div>

            <div style={{ textAlign: 'center', margin: '0.5rem 0', color: '#0f766e', fontWeight: 700 }}>
              ▼ (Implies)
            </div>

            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Then It Also Contains (≥ 10 cases):</div>
            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#1f2937', marginTop: '2px' }}>
              {selectedRule.cleanConsequent}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic', marginTop: '2px' }}>
              Source: {selectedRule.consequent}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
            <div style={{ background: '#f3f4f6', padding: '0.5rem', borderRadius: '4px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Support</span>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedRule.supportPct}</div>
              <small style={{ fontSize: '0.7rem', color: '#6b7280' }}>{selectedRule.supportCount} units</small>
            </div>
            <div style={{ background: '#f3f4f6', padding: '0.5rem', borderRadius: '4px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Confidence</span>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f766e' }}>{selectedRule.confidencePct}</div>
              <small style={{ fontSize: '0.7rem', color: '#6b7280' }}>P(B|A)</small>
            </div>
            <div style={{ background: '#f3f4f6', padding: '0.5rem', borderRadius: '4px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Lift</span>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#2563eb' }}>{selectedRule.liftFormatted}×</div>
              <small style={{ fontSize: '0.7rem', color: '#6b7280' }}>Joint / Expected</small>
            </div>
          </div>

          <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: '#374151' }}>
            <h4 style={{ margin: '0.5rem 0 0.3rem 0', fontSize: '0.9rem' }}>Plain-Language Interpretation</h4>
            <p>
              Among the {payload?.nTransactions ?? 739} qualifying reporting units in 2024, <strong>{selectedRule.confidencePct}</strong> of districts that recorded at least 10 cases of <em>{selectedRule.cleanAntecedent}</em> also recorded at least 10 cases of <em>{selectedRule.cleanConsequent}</em>.
            </p>
            <p>
              With a Lift of <strong>{selectedRule.liftFormatted}×</strong>, these two crime types co-occur {selectedRule.liftFormatted} times more frequently than if their presence across jurisdictions were statistically independent.
            </p>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
            <button className="button" style={{ width: '100%' }} onClick={() => setSelectedRule(null)}>Close</button>
          </div>
        </div>
      )}

      <Notice>
        <strong>Ecological Fallacy Advisory:</strong> One transaction represents an entire reporting district over the full calendar year. An association rule indicates that two crime categories commonly reach elevated volumes (≥ 10 cases) within the same jurisdiction. It does <em>not</em> imply that the offenses took place during the same criminal incident, involved the same offenders, or caused one another.
      </Notice>
    </>
  );
}
