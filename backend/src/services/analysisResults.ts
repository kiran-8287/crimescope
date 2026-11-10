import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

const root = existsSync(resolve(process.cwd(), "config/data_snapshot_manifest.json")) ? process.cwd() : resolve(process.cwd(), "..");
const fileHash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const unavailable = (reason: string, status = "unavailable") => ({ status, reason });

export type AnalysisBundle = { runId: string | null; manifest: any | null; methods: Record<string, any> };

export function loadCurrentAnalysis(expectedDatasetHash?: string): AnalysisBundle {
  const fallback = {
    runId: null, manifest: null,
    methods: {
      pca: unavailable("No current analysis run is published."),
      kmeans: unavailable("No current analysis run is published."),
      hierarchical: unavailable("No current analysis run is published."),
      anomalies: unavailable("No current analysis run is published."),
      association: unavailable("No current analysis run is published."),
    },
  };
  try {
    const pointer = readJson(resolve(root, "analysis/output/runs/current.json"));
    const manifestPath = resolve(root, pointer.manifest);
    const runsRoot = resolve(root, "analysis/output/runs") + sep;
    if (!manifestPath.startsWith(runsRoot)) throw new Error("Current analysis pointer escapes the runs directory.");
    const manifest = readJson(manifestPath);
    if (pointer.run_id !== manifest.run_id || manifest.status !== "available") throw new Error("Current run pointer and manifest status do not agree.");
    if (expectedDatasetHash && manifest.dataset?.sha256 !== expectedDatasetHash) throw new Error("Current analysis dataset hash differs from the served expanded snapshot.");
    const runDir = resolve(manifestPath, "..");
    const featureInputPath = resolve(root, manifest.feature_input.path);
    if (!featureInputPath.startsWith(runDir + sep) || fileHash(featureInputPath) !== manifest.feature_input.sha256) throw new Error("Feature input path or hash does not match the current run manifest.");
    const verifyArtifact = (relative: string) => {
      const full = resolve(runDir, relative);
      if (!full.startsWith(runDir + sep)) throw new Error("Artifact path escapes the current run directory.");
      const expected = manifest.artifacts?.[relative];
      if (!expected || fileHash(full) !== expected) throw new Error(`Artifact integrity check failed: ${relative}`);
      return readJson(full);
    };
    const fail = (method: string, error: unknown) => unavailable(error instanceof Error ? error.message : String(error), "failed");
    const featureIds = manifest.feature_input.ordered_features.map((f: any) => f.id).sort();
    const geographyIds = manifest.cohort.geography_ids.slice().sort();
    const methods: Record<string, any> = {};

    try {
      const path = manifest.methods.pca.artifact; const pca = verifyArtifact(path);
      const resultIds = pca.components.map((c: any) => c.region_id).sort();
      const loadedIds = pca.loadings[0].features.map((f: any) => f.id).sort();
      if (pca.year !== manifest.cohort.year || pca.n_regions !== geographyIds.length || pca.n_categories !== featureIds.length || JSON.stringify(resultIds) !== JSON.stringify(geographyIds) || JSON.stringify(loadedIds) !== JSON.stringify(featureIds)) throw new Error("PCA result dimensions or stable IDs do not match its recorded cohort/features.");
      if (!pca.explained_variance_ratio.every((n: number) => Number.isFinite(n) && n >= 0) || pca.explained_variance_ratio.reduce((a: number, b: number) => a + b, 0) > 1.000001) throw new Error("PCA explained-variance values are invalid.");
      methods.pca = { status: "available", runId: manifest.run_id, result: pca, featureInputHash: manifest.feature_input.sha256, reason: null };
    } catch (error) { methods.pca = fail("pca", error); }

    try {
      const kmeans: Record<string, any> = {};
      for (const k of [3, 4, 5]) {
        const result = verifyArtifact(`kmeans/kmeans_2024_k${k}.json`);
        const ids = result.assignment_records.map((r: any) => r.region_id).sort();
        if (result.year !== manifest.cohort.year || result.n_categories !== featureIds.length || JSON.stringify(ids) !== JSON.stringify(geographyIds)) throw new Error(`K-means k=${k} assignments do not match the recorded cohort/features.`);
        kmeans[k] = result;
      }
      methods.kmeans = { status: "available", runId: manifest.run_id, results: kmeans, featureInputHash: manifest.feature_input.sha256, reason: null };
    } catch (error) { methods.kmeans = fail("kmeans", error); }

    try {
      if (manifest.methods.hierarchical.artifacts_by_state) {
        const resultsByState: Record<string, any> = {};
        const includedIds: string[] = [];
        for (const [state, path] of Object.entries(manifest.methods.hierarchical.artifacts_by_state)) {
          const result = verifyArtifact(path as string);
          const ids = result.clusters.flatMap((c: any) => c.region_ids).sort();
          const expected = manifest.cohort.geography_ids_by_state[state].slice().sort();
          if (result.year !== manifest.cohort.year || result.n_categories !== featureIds.length || JSON.stringify(ids) !== JSON.stringify(expected)) throw new Error(`Hierarchical memberships do not match the recorded cohort/features for ${state}.`);
          includedIds.push(...ids); resultsByState[state] = result;
        }
        const included = new Set(includedIds);
        const missingStates = Object.entries(manifest.cohort.geography_ids_by_state)
          .filter(([state, ids]: [string, any]) => !resultsByState[state] && ids.length < 2).map(([state]) => state);
        if (included.size !== includedIds.length || geographyIds.some((id: string) => !included.has(id) && !Object.values(manifest.cohort.geography_ids_by_state).some((ids: any) => ids.includes(id) && ids.length < 2))) throw new Error("Hierarchical state results do not cover the recorded eligible district cohorts.");
        methods.hierarchical = { status: "available", runId: manifest.run_id, resultsByState, missingStates, featureInputHash: manifest.feature_input.sha256, reason: null };
      } else {
        const result = verifyArtifact(manifest.methods.hierarchical.artifact);
        const ids = result.clusters.flatMap((c: any) => c.region_ids).sort();
        if (result.year !== manifest.cohort.year || result.n_categories !== featureIds.length || JSON.stringify(ids) !== JSON.stringify(geographyIds)) throw new Error("Hierarchical memberships do not match the recorded cohort/features.");
        methods.hierarchical = { status: "available", runId: manifest.run_id, result, featureInputHash: manifest.feature_input.sha256, reason: null };
      }
    } catch (error) { methods.hierarchical = fail("hierarchical", error); }

    try {
      const result = verifyArtifact(manifest.methods.anomalies.artifact);
      if (result.year !== manifest.cohort.year || !Array.isArray(result.cross_sectional) || result.cross_sectional.some((r: any) => r.anomaly_type !== "cross_sectional" || !geographyIds.includes(r.region_id))) throw new Error("Anomaly output is not a current-year cross-sectional result for the recorded geography cohort.");
      methods.anomalies = { status: "available", runId: manifest.run_id, scope: "cross_sectional", result: result.cross_sectional, featureInputHash: manifest.feature_input.sha256, reason: null };
    } catch (error) { methods.anomalies = fail("anomalies", error); }

    try {
      const result = verifyArtifact(manifest.methods.association.artifact);
      if (result.year !== manifest.cohort.year || !Number.isInteger(result.n_transactions) || result.n_transactions < 0 || result.n_transactions > geographyIds.length || result.n_transactions !== manifest.methods.association.transactions || !Array.isArray(result.rules) || result.rules.some((r: any) => !Number.isInteger(r.support_count))) throw new Error("Association result transaction count or support counts do not validate.");
      methods.association = { status: "available", runId: manifest.run_id, year: result.year, nTransactions: result.n_transactions,
        ruleCount: result.n_rules, parameters: manifest.parameters.association,
        scope: manifest.parameters.association_scope, featureInputHash: manifest.feature_input.sha256, reason: null };
    } catch (error) { methods.association = fail("association", error); }
    return { runId: manifest.run_id, manifest, methods };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ...fallback, methods: Object.fromEntries(Object.keys(fallback.methods).map(key => [key, unavailable(reason, "failed")])) };
  }
}

export function getAssociationPage(input: { year: number; minSupport: number; minConfidence: number; minLift: number; limit: number; offset: number }) {
  const release = readJson(resolve(root, "data/interim/rebuilt_national_2021_2024_v3/staging_release_manifest.json"));
  const { runId, manifest, methods } = loadCurrentAnalysis(release.source_dataset.sha256);
  const method = methods.association;
  if (method.status !== "available" || !manifest) return { status: method.status, reason: method.reason, rules: [], total: 0, runId };
  if (input.year !== manifest.cohort.year) return { status: "unavailable", reason: `Association rules are available only for ${manifest.cohort.year}.`, rules: [], total: 0, runId };
  const params = manifest.parameters.association;
  if (input.minSupport < params.min_support || input.minConfidence < params.min_confidence || input.minLift < params.min_lift) {
    throw new Error(`Filters cannot be lower than the saved mining thresholds (support ${params.min_support}, confidence ${params.min_confidence}, lift ${params.min_lift}); this endpoint does not re-mine rules.`);
  }
  const relative = manifest.methods.association.artifact;
  const pointer = readJson(resolve(root, "analysis/output/runs/current.json"));
  const manifestPath = resolve(root, pointer.manifest);
  const full = resolve(manifestPath, "..", relative);
  if (fileHash(full) !== manifest.artifacts[relative]) throw new Error("Association result artifact integrity check failed.");
  const artifact = readJson(full);
  const categories = new Map(manifest.feature_input.ordered_features.map((f: any) => [f.label, f.id]));
  const keyOf = (labels: string[]) => [...labels].sort().join("\u0001");
  const stablePart = (labels: string[]) => labels.map((label: string) => categories.get(label) ?? label).join("+");

  // Exact per-itemset counts from the saved artifact: singleton itemsets back the
  // antecedent/consequent marginals, and the joint count is the rule support count.
  const itemsetCounts = new Map<string, number>();
  for (const set of artifact.itemsets ?? []) itemsetCounts.set(keyOf(set.itemset), Number(set.count));

  const filtered = artifact.rules
    .filter((rule: any) => rule.support >= input.minSupport && rule.confidence >= input.minConfidence && rule.lift >= input.minLift)
    // Deterministic ordering with an explicit tie-break, so a fixed request always
    // maps to a fixed row order and stable IDs: pagination can never reorder,
    // duplicate or drop rows.
    .map((rule: any, index: number) => ({ rule, index }))
    .sort((a: any, b: any) => {
      const A = a.rule, B = b.rule;
      if (B.support !== A.support) return B.support - A.support;
      if (B.confidence !== A.confidence) return B.confidence - A.confidence;
      if (B.lift !== A.lift) return B.lift - A.lift;
      const ka = keyOf(A.antecedent), kb = keyOf(B.antecedent);
      if (ka !== kb) return ka < kb ? -1 : 1;
      const ca = keyOf(A.consequent), cb = keyOf(B.consequent);
      if (ca !== cb) return ca < cb ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry: any) => entry.rule);

  const page = filtered.slice(input.offset, input.offset + input.limit).map((rule: any) => ({
    // Stable identity derived from the canonical antecedent/consequent items, not the page offset.
    id: `${runId}#${stablePart(rule.antecedent)}=>${stablePart(rule.consequent)}`,
    antecedent: rule.antecedent.join(" + "), consequent: rule.consequent.join(" + "),
    antecedentIds: rule.antecedent.map((label: string) => categories.get(label)), consequentIds: rule.consequent.map((label: string) => categories.get(label)),
    antecedentCount: itemsetCounts.get(keyOf(rule.antecedent)) ?? null,
    consequentCount: itemsetCounts.get(keyOf(rule.consequent)) ?? null,
    jointCount: rule.support_count,
    support: rule.support, supportCount: rule.support_count, confidence: rule.confidence, lift: rule.lift,
  }));
  return { status: "available", runId, year: artifact.year, nTransactions: artifact.n_transactions,
    transactionDefinition: method.scope, parameters: params,
    sort: "support desc, confidence desc, lift desc, antecedent asc, consequent asc",
    total: filtered.length, limit: input.limit, offset: input.offset, rules: page };
}
