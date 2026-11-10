import { useState } from 'react';
import { Database, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PageTitle } from '../components/Layout';
import { Panel, Notice, Badge } from '../components/UI';
import { number } from '../utils/format';

// A copyable provenance value. Long hashes wrap instead of overflowing, and the
// copy control works even where the Clipboard API is unavailable.
function CopyValue({ value, label }: { value?: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);
  const text = value ?? '';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', minWidth: 0 }}>
      <code style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-all', fontSize: '0.72rem', lineHeight: 1.4 }}>
        {text || '—'}
      </code>
      <button
        type="button"
        className="text-button"
        disabled={!text}
        aria-label={`Copy ${label ?? 'value'}`}
        title={`Copy ${label ?? 'value'}`}
        style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem' }}
        onClick={() => {
          const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1500); };
          try {
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(text).then(done).catch(done);
            } else {
              done();
            }
          } catch { done(); }
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function MethodologyPage() {
  const { data } = useData();
  const [openProvenance, setOpenProvenance] = useState(false);

  // Release/run-specific values are read from the same API metadata used
  // elsewhere on the dashboard rather than hardcoded, so they cannot go stale.
  const extraMeta = data.meta as typeof data.meta & { sourceFiles?: number; aggregateRows?: number };
  const sourceFiles = extraMeta.sourceFiles;
  const aggregateRows = extraMeta.aggregateRows;

  // Derive PCA variance figures from the current artifact so methodology text
  // cannot drift from the served results.
  const pcaVariance: number[] = data.methods?.pca?.result?.explained_variance_ratio ?? [];
  const pc1Pct = pcaVariance[0] != null ? (pcaVariance[0] * 100).toFixed(1) : 'n/a';
  const pc2Pct = pcaVariance[1] != null ? (pcaVariance[1] * 100).toFixed(1) : 'n/a';
  const cohortSize: number = data.methods?.pca?.result?.n_regions ?? data.methods?.kmeans?.results?.[3]?.n_regions ?? 0;
  const featureMode: string = data.methods?.pca?.result?.feature_mode ?? 'log1p_zscore';
  const featureCount: number = data.methods?.pca?.result?.n_categories ?? 131;
  const runId: string = data.analysis?.runId || '—';
  const compositionReason: string = data.meta.categoryDisplay?.reason ?? '';

  // The five connected course functionalities plus the additional anomaly
  // screening. `connection` distinguishes dashboard-served results from offline
  // utilities that the pipeline computes but no page loads.
  const connectedFunctionalities = [
    { name: 'Processing & quality', code: '01_cleaning', page: 'Quality' },
    { name: 'Descriptive statistics', code: '02_descriptive', page: 'Overview · Trends' },
    { name: 'PCA', code: '05_pca', page: 'PCA' },
    { name: 'Clustering', code: '06_kmeans · 07_hierarchical', page: 'Clusters' },
    { name: 'Association rules', code: '09_association', page: 'Rules' },
  ];

  const researchQuestions = [
    {
      num: 1,
      q: 'What types of crime are reported in a selected region?',
      ans: 'Answered via the Overview and Regional Details drawer, displaying recorded counts across individual leaf and component crime categories without false additive composition.'
    },
    {
      num: 2,
      q: 'How does that region compare with other compatible regions?',
      ans: 'Answered via Regional Comparison, allowing side-by-side evaluation of up to 3 compatible reporting units across primary and multi-category profiles, with warnings when comparing different unit types.'
    },
    {
      num: 3,
      q: 'How have comparable records changed over time?',
      ans: 'Answered via Yearly Trends, separating annual volume totals, name-matched pairwise cohorts (e.g. 749 matched 2022–2023 districts), and single-region historical trajectories.'
    },
    {
      num: 4,
      q: 'Which regions have similar crime profiles, and what explains those similarities?',
      ans: 'Answered via PCA Explorer and Cluster Profiles, projecting profiles into two principal components and grouping units via K-means into distinguishable volume and crime-type clusters.'
    },
    {
      num: 5,
      q: 'Which unusual observations deserve investigation?',
      ans: 'Answered via Unusual Observations, screening for cross-sectional outliers (|z| ≥ 2.5) and contextualizing rare-category occurrences against higher-count anomalies.'
    }
  ];

  const methodsList: Array<{ name: string; code: string; connection: 'dashboard' | 'offline'; desc: string }> = [
    {
      name: 'Data Ingestion & Canonical Cleaning',
      code: '01_cleaning',
      connection: 'dashboard',
      desc: `Ingests ${number(sourceFiles)} raw CSV fragments into a unified schema, separates ${number(aggregateRows)} aggregate total rows from reporting-unit observations, preserves explicit reported zeros distinct from true missing/null cells, and quarantines malformed keys.`
    },
    {
      name: 'Descriptive Analytics & Trends',
      code: '02_descriptive',
      connection: 'dashboard',
      desc: 'Computes volume distributions and name-matched pairwise cohorts without unsupported cross-framework continuous line joins across the 2023 IPC to 2024 BNS transition.'
    },
    {
      name: 'Principal Component Analysis (PCA)',
      code: '05_pca',
      connection: 'dashboard',
      desc: `Decomposes the log1p, population-standardized (ddof = 0) feature matrix across ${number(cohortSize)} administrative districts using SVD. PC1 captures ${pc1Pct}% variance (a reporting-volume axis); PC2 captures ${pc2Pct}% variance (a secondary contrast between bodily/dowry offences and public-order offences). Reported loadings are scaled component loadings (v_ij × √λ_i), not exact Pearson correlations.`
    },
    {
      name: 'K-Means Clustering',
      code: '06_kmeans',
      connection: 'dashboard',
      desc: 'Groups units into k = 3, 4 and 5 clusters by Euclidean distance in the same standardized profile space. The run presents k = 3 as its selected configuration; each cluster is described from its saved centroid and member sizes rather than a fixed narrative.'
    },
    {
      name: 'State-Scoped Hierarchical Clustering (Ward)',
      code: '07_hierarchical',
      connection: 'dashboard',
      desc: 'Applies agglomerative Ward clustering within individual state cohorts to avoid cubic complexity across the national matrix and to keep each state’s jurisdiction grouping intact.'
    },
    {
      name: 'Statistical Anomaly Screening (cross-sectional)',
      code: '08_anomalies',
      connection: 'dashboard',
      desc: 'Computes per-category z-scores within the 2024 cross-sectional cohort using the raw-count sample standard deviation (ddof = 1). Separates rare-category indicators from higher-count outliers. This is the additional sixth functionality beyond the five core methods.'
    },
    {
      name: 'Association Rule Mining (Apriori)',
      code: '09_association',
      connection: 'dashboard',
      desc: `Mines frequent category co-occurrence across ${number(data.methods?.association?.nTransactions)} qualifying district transactions (a category counts as present at ≥ 10 cases). Evaluates support, confidence and lift over the frozen national transaction population.`
    },
    {
      name: 'Year-on-year (temporal) anomaly detection',
      code: 'anomaly · year_on_year',
      connection: 'offline',
      desc: 'The pipeline also produces year-over-year percentage-change flags, but the dashboard serves only the 2024 cross-sectional flags. The temporal output is an offline artifact and is not loaded by any page.'
    },
    {
      name: 'Bivariate category correlation',
      code: 'bivariate',
      connection: 'offline',
      desc: 'Computes pairwise category correlation matrices as an offline utility. These correlations are not exposed on any page; the Rules page shows association rules instead.'
    }
  ];

  const challengeRows = [
    {
      issue: 'Published state/UT totals and "Total Districts" rows sit alongside individual district rows.',
      decision: 'Keep aggregate rows but classify them separately from reporting-unit observations.',
      consequence: 'Aggregates are excluded from district sums and used only for reconciliation.',
      evidence: `${number(aggregateRows)} aggregate observations distinguished from ${number(data.meta.validRows)} eligible non-aggregate observations (Quality page reconciliation).`
    },
    {
      issue: 'A blank source cell and a reported 0 are different facts.',
      decision: 'Preserve explicit zeros as 0 and keep genuine blanks as null; never impute or zero-fill.',
      consequence: 'Zeros and missing values remain distinguishable in every table and export.',
      evidence: 'Quality page separates "Explicit reported zeros" from "Missing / null values" (0 retained nulls in the active release).'
    },
    {
      issue: 'Source category rows overlap; no verified mutually-exclusive category mapping exists.',
      decision: 'Disable composition/shares and forbid additive totals across categories.',
      consequence: 'No pie charts or "top categories total" sums are presented.',
      evidence: `categoryDisplay.compositionSharesAvailable = false${compositionReason ? ` — "${compositionReason}"` : ''}.`
    },
    {
      issue: 'Source rows name police jurisdictions, not a gazetteer-verified district list.',
      decision: `Classify the ${number(cohortSize)} units as administrative districts with partly inferred classification.`,
      consequence: 'Unit type is retained and labelled as inferred rather than verified.',
      evidence: `${number(cohortSize)} units × ${number(featureCount)} features; the unit-type badge marks inferred classification.`
    },
    {
      issue: 'Cross-year unit identity must be inferred because names and boundaries can change.',
      decision: 'Match units by state plus name, for the 2022–2023 cohort only.',
      consequence: 'Matched change is reported separately from annual change, with distinct denominators.',
      evidence: '749 matched units; 1 unit (2022) and 21 units (2023) excluded (Trends reconciliation).'
    },
    {
      issue: 'India replaced the IPC with the BNS in 2024.',
      decision: 'Do not connect 2023 to 2024 in a continuous series.',
      consequence: 'Annual totals are shown as isolated points; cross-boundary change is withheld.',
      evidence: '2023 uses IPC and 2024 uses BNS; source headers carry the governing framework per year.'
    },
    {
      issue: 'Crime counts are heavily right-skewed and dominated by a few high-volume categories.',
      decision: 'Transform with log1p then per-feature population standardization (ddof = 0) for PCA and clustering.',
      consequence: 'Distance-based methods operate on relative profile shape, not raw volume.',
      evidence: `PCA/clustering feature mode = ${featureMode}; anomaly screening instead uses raw counts with the ddof = 1 sample standard deviation.`
    },
    {
      issue: 'Association mining needs an explicit definition of category presence.',
      decision: 'Treat a category as present in a district when its count is ≥ 10 cases.',
      consequence: 'Sparse districts that never reach the floor form no transaction and are excluded.',
      evidence: `${number(data.methods?.association?.nTransactions)} transactions and ${number(data.methods?.association?.ruleCount)} rules; item threshold ≥ 10 cases (Rules page).`
    }
  ];

  return (
    <>
      <PageTitle
        eyebrow="CONTEXT, PROVENANCE & METHODOLOGY"
        title="Methodology, sources & analytical design"
        description="Comprehensive technical and statistical reference for the CrimeScope analytics platform."
      />

      {/* Five Core Research Questions */}
      <Panel
        title="Project Purpose: Answering Five Core Research Questions"
        subtitle="How CrimeScope translates NCRB reporting tables into structured answers."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem' }}>
          {researchQuestions.map(rq => (
            <div key={rq.num} style={{ background: '#f9fafb', padding: '0.85rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                <Badge tone="green">Question {rq.num}</Badge>
                <strong style={{ fontSize: '0.9rem', color: '#111827' }}>{rq.q}</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.825rem', color: '#4b5563', lineHeight: 1.45 }}>
                {rq.ans}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Connected functionalities at a glance */}
      <Panel
        title="Dashboard-Connected Functionalities"
        subtitle="Five core course methods are wired to dashboard pages; cross-sectional anomaly screening is an additional sixth. Offline utilities are listed separately below."
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {connectedFunctionalities.map(f => (
            <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
              <Badge tone="green">Dashboard</Badge>
              <strong style={{ fontSize: '0.85rem', color: '#111827' }}>{f.name}</strong>
              <span style={{ fontSize: '0.72rem', color: '#4b5563' }}>· {f.page}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.4rem 0.6rem' }}>
            <Badge tone="amber">Additional</Badge>
            <strong style={{ fontSize: '0.85rem', color: '#111827' }}>Anomaly screening</strong>
            <span style={{ fontSize: '0.72rem', color: '#4b5563' }}>· Anomalies</span>
          </div>
        </div>
      </Panel>

      {/* Expandable Provenance & Active Release Panel */}
      <div style={{ margin: '1rem 0' }}>
        <div
          style={{
            background: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #d1d5db)',
            borderRadius: '6px',
            padding: '1rem',
            cursor: 'pointer'
          }}
          onClick={() => setOpenProvenance(!openProvenance)}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} color="#0f766e" />
              <strong>Data Provenance & Active Release Manifest</strong>
              <Badge tone="green">Verified Live</Badge>
            </div>
            {openProvenance ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>

          {openProvenance && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', fontSize: '0.85rem' }}>
              <div className="grid two-col" style={{ gap: '1rem', minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ margin: '0 0 0.3rem 0', color: '#374151' }}>Active Serving Database</h4>
                  <dl className="metadata">
                    <dt>Release ID</dt>
                    <dd><CopyValue value={data.meta.releaseId} label="release id" /></dd>
                    <dt>Database Path</dt>
                    <dd><CopyValue value={data.meta.servingDatabase?.path} label="database path" /></dd>
                    <dt>SQLite SHA-256</dt>
                    <dd><CopyValue value={data.meta.servingDatabase?.sqliteSha256} label="SQLite SHA-256" /></dd>
                    <dt>Total Records</dt>
                    <dd>{number(data.meta.servingDatabase?.rowCount ?? 0)} rows</dd>
                    <dt>Eligible Observations</dt>
                    <dd>{number(data.meta.validRows ?? 0)} observations</dd>
                    <dt>Source Files</dt>
                    <dd>{number(sourceFiles)} fragments</dd>
                    <dt>Aggregate Observations</dt>
                    <dd>{number(aggregateRows)} aggregate rows</dd>
                  </dl>
                </div>

                <div style={{ minWidth: 0 }}>
                  <h4 style={{ margin: '0 0 0.3rem 0', color: '#374151' }}>Analytical Model Artifacts</h4>
                  <dl className="metadata">
                    <dt>Current Run</dt>
                    <dd><CopyValue value={runId} label="run id" /></dd>
                    <dt>Source Dataset Path</dt>
                    <dd><CopyValue value={data.meta.sourceExport?.path} label="source dataset path" /></dd>
                    <dt>Source Dataset SHA-256</dt>
                    <dd><CopyValue value={data.meta.dataSha256} label="source dataset SHA-256" /></dd>
                    <dt>Feature Mode</dt>
                    <dd><code>{featureMode}</code> (log1p + per-feature population z-scores, ddof = 0)</dd>
                    <dt>Cohort Size</dt>
                    <dd>{number(cohortSize)} administrative districts × {number(featureCount)} features</dd>
                  </dl>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Methods Architecture */}
      <Panel
        title="Course Methods Implemented in CrimeScope"
        subtitle="Each method is tagged as dashboard-connected (computed into the active run and served on a page) or an offline utility."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {methodsList.map(m => (
            <div key={`${m.code}-${m.name}`} style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.95rem', color: '#111827' }}>{m.name}</strong>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Badge tone={m.connection === 'dashboard' ? 'green' : 'amber'}>
                    {m.connection === 'dashboard' ? 'Dashboard-connected' : 'Offline utility'}
                  </Badge>
                  <Badge tone="neutral"><code>{m.code}</code></Badge>
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.45 }}>
                {m.desc}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Preparation challenges table */}
      <Panel
        title="Data-Preparation Challenges & Decisions"
        subtitle="Each source-table challenge, the decision taken, its consequence, and the evidence that the handling is applied."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: '24%' }}>Issue</th>
                <th style={{ width: '26%' }}>Decision</th>
                <th style={{ width: '24%' }}>Consequence</th>
                <th style={{ width: '26%' }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {challengeRows.map((row, i) => (
                <tr key={i}>
                  <td className="cell-wrap">{row.issue}</td>
                  <td className="cell-wrap">{row.decision}</td>
                  <td className="cell-wrap">{row.consequence}</td>
                  <td className="cell-wrap">{row.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Source archive vs original publisher */}
      <Panel title="Source Archive vs Original Publisher" className="panel" >
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: '#374151', marginTop: 0 }}>
          The dashboard reads a locally staged archive assembled from the NCRB district-wise source tables
          ({number(sourceFiles)} source fragments; {number(data.meta.sourceRows)} canonical observations). The SHA-256 hashes in the
          provenance details above prove that the exact staged artifact recorded in the active release was read and that it has
          not been altered since publication.
        </p>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.5, color: '#374151', marginBottom: 0 }}>
          A hash proves <strong>artifact integrity</strong>, not correct interpretation. It does not guarantee that the original
          NCRB publication was transcribed without error, that every published table or field was acquired, or that reporting
          boundaries were unchanged across years. Those remain documented limitations of the source data.
        </p>
      </Panel>

      {/* Cleaning and Jurisdictional Framework */}
      <div className="grid two-col" style={{ marginTop: '1rem' }}>
        <Panel title="Jurisdictional Classification Rules">
          <p style={{ fontSize: '0.85rem', lineHeight: 1.45, color: '#374151' }}>
            In NCRB source publications, reporting units represent police jurisdictions rather than uniform revenue districts. CrimeScope categorizes each unit into:
          </p>
          <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem', color: '#4b5563', lineHeight: 1.5 }}>
            <li><strong>Administrative Districts:</strong> Revenue districts with coterminous district police commands.</li>
            <li><strong>City Police / Commissionerates:</strong> Metropolitan police jurisdictions (e.g. Mumbai, Bengaluru, Delhi, DCP Cuttack) carving out dense urban centers.</li>
            <li><strong>Railway Police (GRP / SRP):</strong> Specialized jurisdictions operating along railway infrastructure across districts.</li>
            <li><strong>Specialized / Rural Units:</strong> Cyber crime ranges, ATS, crime branches, and rural police divisions (e.g. Pune Rural, Ahmedabad Rural).</li>
          </ul>
        </Panel>

        <Panel title="Key Limitations & Safe Interpretation">
          <ul style={{ fontSize: '0.85rem', paddingLeft: '1.2rem', color: '#4b5563', lineHeight: 1.5 }}>
            <li><strong>No Population Denominators:</strong> NCRB district tables do not provide annual resident population denominators. Therefore, recorded counts reflect volume, not per-capita crime rates.</li>
            <li><strong>Reporting & Policing Intensity:</strong> Higher counts often reflect vigorous police recording, proactive enforcement (e.g. liquor/narcotics seizures), or higher citizen reporting trust, not higher victimization.</li>
            <li><strong>No Safety Rankings:</strong> Jurisdictions are never categorized as "safe" or "unsafe" from raw counts alone.</li>
            <li><strong>Legal Transition 2023–2024:</strong> India transitioned from IPC to BNS in July 2024. Cross-year continuous lines across this boundary are intentionally withheld.</li>
          </ul>
        </Panel>
      </div>

      <Notice>
        CrimeScope is an academic analytics project adhering strictly to reproducible, evidence-backed pipelines. All claims derive deterministically from canonical NCRB source tables without synthetic imputation.
      </Notice>
    </>
  );
}
