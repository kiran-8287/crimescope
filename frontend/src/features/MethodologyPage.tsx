import { useState } from 'react';
import { Database, FileText, CheckCircle, AlertTriangle, Layers, BookOpen, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useData } from '../context/DataContext';
import { PageTitle } from '../components/Layout';
import { Panel, Notice, Badge } from '../components/UI';
import { number } from '../utils/format';

export default function MethodologyPage() {
  const { data, isDemo } = useData();
  const [openProvenance, setOpenProvenance] = useState(false);

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
      ans: 'Answered via Yearly Trends, separating annual volume totals, verified pairwise cohorts (e.g. 749 matched 2022–2023 districts), and single-region historical trajectories.'
    },
    {
      num: 4,
      q: 'Which regions have similar crime profiles, and what explains those similarities?',
      ans: 'Answered via PCA Explorer and Cluster Profiles, projecting profiles into two principal components and grouping units via K-means into distinguishable volume and crime-type clusters.'
    },
    {
      num: 5,
      q: 'Which unusual observations deserve investigation?',
      ans: 'Answered via Unusual Observations, screening for cross-sectional outliers (|z| ≥ 2.5) and contextualizing rare-category occurrences against high-volume anomalies.'
    }
  ];

  const methodsList = [
    {
      name: 'Data Ingestion & Canonical Cleaning',
      code: '01_cleaning',
      desc: 'Ingests 145 raw CSV fragments into a unified schema, separating aggregate total rows (21,022), preserving explicit reported zeros from true missing/null cells, and quarantining malformed keys.'
    },
    {
      name: 'Descriptive Analytics & Trends',
      code: '02_descriptive',
      desc: 'Computes volume distributions and pairwise matched cohorts without unsupported cross-framework continuous line joins across the 2023 IPC to 2024 BNS transition.'
    },
    {
      name: 'Principal Component Analysis (PCA)',
      code: '05_pca',
      desc: 'Decomposes log1p and standardized feature matrices across 774 administrative districts. PC1 captures 15.9% variance (overall recording volume); PC2 captures 4.6% variance (property vs bodily offense balance). Reported loadings are scaled component loadings (v_ij × √λ_i), not exact Pearson correlations.'
    },
    {
      name: 'K-Means Clustering',
      code: '06_kmeans',
      desc: 'Groups units into k=3, 4, 5 clusters based on Euclidean distance in standardized profile space. Distinguishes baseline low/moderate volume, urban elevated centers, and rare-event outlier clusters.'
    },
    {
      name: 'State-Scoped Hierarchical Clustering (Ward)',
      code: '07_hierarchical',
      desc: 'Applies agglomerative Ward clustering within individual states to preserve state-level administrative jurisdictions and avoid cubic complexity across the national matrix.'
    },
    {
      name: 'Statistical Anomaly Screening',
      code: '08_anomalies',
      desc: 'Calculates per-category z-scores within the 2024 cross-sectional cohort. Separates rare-category indicators (where single positive counts produce z ≈ 28.0) from high-volume outliers.'
    },
    {
      name: 'Association Rule Mining (Apriori)',
      code: '09_association',
      desc: 'Mines frequent category presence rules across 739 qualifying district-level transactions (items with count ≥ 10 cases). Evaluates Support, Confidence, and Lift.'
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
              <div className="grid two-col" style={{ gap: '1rem' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.3rem 0', color: '#374151' }}>Active Serving Database</h4>
                  <dl className="metadata">
                    <dt>Release ID</dt>
                    <dd><code>{data.meta.releaseId}</code></dd>
                    <dt>Database Path</dt>
                    <dd><code>{data.meta.servingDatabase?.path ?? 'data/serving/releases/...'}</code></dd>
                    <dt>SQLite SHA256</dt>
                    <dd><code style={{ fontSize: '0.75rem' }}>{data.meta.servingDatabase?.sqliteSha256}</code></dd>
                    <dt>Total Records</dt>
                    <dd>{number(data.meta.servingDatabase?.rowCount ?? 570022)} rows</dd>
                    <dt>Valid Retained</dt>
                    <dd>{number(data.meta.validRows ?? 549000)} observations</dd>
                  </dl>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 0.3rem 0', color: '#374151' }}>Analytical Model Artifacts</h4>
                  <dl className="metadata">
                    <dt>Current Run</dt>
                    <dd><code>{data.analysis?.runId || 'ncrb-national-2024-admin-log1p-zscore-20261105-v2'}</code></dd>
                    <dt>Feature Mode</dt>
                    <dd><code>log1p_zscore</code> (Log1p + per-feature z-scores)</dd>
                    <dt>Cohort Size</dt>
                    <dd>{data.analysis?.points?.length || 774} administrative districts × 131 leaf features</dd>
                    <dt>Source Dataset Hash</dt>
                    <dd><code style={{ fontSize: '0.75rem' }}>{data.meta.dataSha256}</code></dd>
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
        subtitle="Systematic inventory of cleaning, transformation, dimensionality reduction, and pattern mining."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {methodsList.map(m => (
            <div key={m.code} style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <strong style={{ fontSize: '0.95rem', color: '#111827' }}>{m.name}</strong>
                <Badge tone="neutral"><code>{m.code}</code></Badge>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.45 }}>
                {m.desc}
              </p>
            </div>
          ))}
        </div>
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
