import { cleanCategoryName } from './categories.ts';
import type { Dataset } from '../types';

export type ClusterPoint = {
  regionId: string;
  region: string;        // "State · District" as stored in the artifact
  state: string;
  pc1: number;
  pc2: number;
  cluster: number;       // zero-based cluster_id from the saved k run
};

export type JoinResult = {
  points: ClusterPoint[];
  error: string | null;
  cohortSize: number;
};

// PCA score component lookup. The saved artifact stores one score entry per
// saved component (PC1, PC2) keyed by component name.
function pcaScore(component: { scores: any[] }, pc: string): number {
  const entry = component.scores?.find((s: any) => String(s.component) === pc);
  return Number(entry?.score ?? 0);
}

// Join saved PCA scores with saved K-means assignments by the stable
// reporting-unit id. Never joins by display name or array position.
//
// Validation:
//   * both artifacts must come from the same analysis run (runId)
//   * both must cover the same cohort size (n_regions)
//   * no duplicate region ids on either side
//   * every PCA unit must have a K-means assignment and vice versa
//
// On any failure the result carries an error and no points: callers must show
// a chart-level unavailable state and must never fabricate a cluster for an
// unmatched point.
export function joinPcaAndKmeans(
  pca: { runId: string | null; result: { components: any[]; n_regions: number; n_categories: number } | null },
  kmeans: { runId: string | null; results: Record<number, any> | null },
  k: number
): JoinResult {
  const pcaResult = pca?.result;
  const km = kmeans?.results?.[k];

  if (!pcaResult?.components?.length) {
    return { points: [], error: 'Saved PCA scores are not available for this cohort.', cohortSize: 0 };
  }
  if (!km?.assignment_records?.length) {
    return { points: [], error: `No saved K-means assignments are available for k = ${k}.`, cohortSize: 0 };
  }

  if (pca.runId && kmeans.runId && pca.runId !== kmeans.runId) {
    return { points: [], error: 'PCA and K-means artifacts come from different analysis runs and cannot be compared.', cohortSize: 0 };
  }

  if (Number(pcaResult.n_regions) !== Number(km.n_regions)) {
    return {
      points: [],
      error: `PCA cohort (${pcaResult.n_regions}) and K-means k = ${k} cohort (${km.n_regions}) do not agree.`,
      cohortSize: 0,
    };
  }

  // Index PCA scores by stable region id; reject duplicate ids.
  const pcaById = new Map<string, { region: string; pc1: number; pc2: number }>();
  for (const c of pcaResult.components) {
    const id = String(c.region_id);
    if (pcaById.has(id)) {
      return { points: [], error: `Duplicate reporting-unit id "${id}" in saved PCA scores; the projection cannot be built reliably.`, cohortSize: 0 };
    }
    pcaById.set(id, {
      region: String(c.region ?? ''),
      pc1: pcaScore(c, 'PC1'),
      pc2: pcaScore(c, 'PC2'),
    });
  }

  // Index K-means assignments by stable region id; reject duplicate ids.
  const assignById = new Map<string, number>();
  for (const a of km.assignment_records) {
    const id = String(a.region_id);
    if (assignById.has(id)) {
      return { points: [], error: `Duplicate reporting-unit id "${id}" in saved K-means assignments (k = ${k}); the projection cannot be built reliably.`, cohortSize: 0 };
    }
    assignById.set(id, Number(a.cluster_id));
  }

  // Both sides must cover the same set of units.
  const unmatchedPca = [...pcaById.keys()].filter(id => !assignById.has(id));
  const unmatchedAssign = [...assignById.keys()].filter(id => !pcaById.has(id));
  if (unmatchedPca.length || unmatchedAssign.length) {
    return { points: [], error: `PCA scores and K-means assignments (k = ${k}) cover different reporting units (${unmatchedPca.length + unmatchedAssign.length} unmatched).`, cohortSize: 0 };
  }

  const points: ClusterPoint[] = [];
  for (const [id, p] of pcaById) {
    const parts = String(p.region).split(' · ');
    const state = parts.length >= 2 ? parts[0] : '—';
    points.push({ regionId: id, region: String(p.region), state, pc1: p.pc1, pc2: p.pc2, cluster: assignById.get(id)! });
  }

  return { points, error: null, cohortSize: pcaResult.n_regions };
}

export type HeatmapColumn = {
  label: string;      // shortened label for the column header
  fullLabel: string;  // full offence label (shown on hover / in full view)
  id: string | null;  // stable category id, or null when unresolvable
};

// Select a small, deterministic subset of offence features whose saved centroid
// values best distinguish the clusters for the selected k.
//
// Rule: for every feature label present in the saved centroids, compute the
// spread (max − min centroid value across the selected clusters). Rank by spread
// descending; ties break by stable category id ascending, then by label. Keep
// the top `limit` columns. The same selected columns are shown for every cluster
// so the heatmap is directly comparable across clusters. Spread is used because
// a feature whose centroid value is similar across all clusters does not help
// explain what separates them.
export function selectHeatmapFeatures(
  clusters: any[],
  categories: Dataset['meta']['categories'] | undefined,
  limit = 10
): HeatmapColumn[] {
  const labelSet = new Set<string>();
  for (const c of clusters ?? []) {
    for (const label of Object.keys(c.centroid ?? {})) labelSet.add(String(label));
  }

  const labelToId = new Map<string, string | null>();
  for (const cat of categories ?? []) {
    labelToId.set(String(cat.label), cat.id ?? null);
  }

  const spread = new Map<string, number>();
  for (const label of labelSet) {
    let minV = Infinity;
    let maxV = -Infinity;
    for (const c of clusters ?? []) {
      const v = Number(c.centroid?.[label] ?? 0);
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    spread.set(label, maxV - minV);
  }

  const ranked = [...labelSet].sort((a, b) => {
    const sa = spread.get(a) ?? 0;
    const sb = spread.get(b) ?? 0;
    if (sb !== sa) return sb - sa;
    const ia = labelToId.get(a) ?? '';
    const ib = labelToId.get(b) ?? '';
    if (ia !== ib) return ia.localeCompare(ib);
    return a.localeCompare(b);
  });

  return ranked.slice(0, limit).map(label => ({
    label: cleanCategoryName(label) || label,
    fullLabel: label,
    id: labelToId.get(label) ?? null,
  }));
}
