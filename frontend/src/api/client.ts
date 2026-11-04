import { queryClient } from "@/app/providers";

export interface OverviewResponse {
  status: string;
  releaseId: string;
  year: number;
  data: {
    totalRegions: number;
    totalCategories: number;
    totalCases: number;
    topRegions: Array<{ region: string; cases: number }>;
    topCategories: Array<{ category: string; cases: number }>;
  };
  metadata: {
    datasetVersion: string;
    geographyLevel: string;
    categoryScope: string;
    coverage: string;
    denominator: string | null;
    warnings: string[];
    generatedAt: string;
  };
}

export interface RegionalComparisonResponse {
  year: number;
  category: string | null;
  regions: Array<{
    region: string;
    year: number;
    total_cases: number;
    observations: number;
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
  }>;
  total_regions: number;
}

export interface TrendPoint {
  year: number;
  prev_year: number;
  state_name: string;
  region_name: string;
  category: string;
  prev_total: number;
  curr_total: number;
  abs_change: number;
  pct_change: number | null;
}

export interface TrendsResponse {
  region: string;
  category: string;
  trend: TrendPoint[];
  years: number[];
}

export interface CategoryStat {
  category: string;
  year: number | string;
  total_cases: number;
  observations: number;
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
}

export interface CorrelationPair {
  category_1: string;
  category_2: string;
  correlation: number;
  year: number;
}

export interface DataQualityResponse {
  per_source: Record<string, any>;
  summary: {
    total_sources: number;
    total_source_rows: number;
    total_canonical_observations: number;
    total_quarantined: number;
    total_duplicates: number;
    total_totals_mismatch: number;
    eligible_for_comparison: number;
  };
}

const API_BASE = "/api/v1";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`);
  }
  return res.json();
}

export function fetchOverview(): Promise<OverviewResponse> {
  return fetchJson<OverviewResponse>("/overview");
}

export function fetchRegionalComparison(year: number, category?: string): Promise<RegionalComparisonResponse> {
  const url = category
    ? `/regions?year=${year}&category=${encodeURIComponent(category)}`
    : `/regions?year=${year}`;
  return fetchJson<RegionalComparisonResponse>(url);
}

export function fetchTrends(region: string, category: string): Promise<TrendsResponse> {
  return fetchJson<TrendsResponse>(`/trends?region=${encodeURIComponent(region)}&category=${encodeURIComponent(category)}`);
}

export function fetchTopCategories(year: number, topN: number): Promise<CategoryStat[]> {
  return fetchJson<CategoryStat[]>(`/categories/top?year=${year}&top_n=${topN}`);
}

export function fetchCorrelations(year: number, topN: number): Promise<CorrelationPair[]> {
  return fetchJson<CorrelationPair[]>(`/correlations?year=${year}&top_n=${topN}`);
}

export function fetchDataQuality(): Promise<DataQualityResponse> {
  return fetchJson<DataQualityResponse>("/data-quality");
}

export interface PcaResponse {
  year: number;
  n_regions: number;
  n_categories: number;
  n_components: number;
  eigenvalues: number[];
  explained_variance_ratio: number[];
  cumulative_variance_ratio: number[];
  loadings: Array<{
    component: string;
    eigenvalue: number;
    explained_variance_ratio: number;
    features: Array<{ category: string; loading: number }>;
  }>;
  components: Array<{
    region: string;
    scores: Array<{ component: string; score: number }>;
  }>;
}

export interface KMeansResponse {
  year: number;
  k: number;
  n_regions: number;
  n_categories: number;
  inertia: number;
  cluster_sizes: number[];
  clusters: Array<{
    cluster_id: number;
    size: number;
    regions: string[];
    centroid: Record<string, number>;
  }>;
  assignments: Record<string, number>;
}

export interface HierarchicalResponse {
  year: number;
  linkage: string;
  n_regions: number;
  n_categories: number;
  max_clusters: number;
  merge_history: Array<{
    clusters_merged: number[];
    distance: number;
    new_cluster_size: number;
    remaining_clusters: number;
  }>;
  clusters: Array<{
    cluster_id: number;
    size: number;
    regions: string[];
  }>;
}

export function fetchPca(year: number): Promise<PcaResponse> {
  return fetchJson<PcaResponse>(`/analysis/runs/current/pca?year=${year}`);
}

export function fetchKmeans(year: number, k: number): Promise<KMeansResponse> {
  return fetchJson<KMeansResponse>(`/analysis/runs/current/clusters?year=${year}&k=${k}`);
}

export function fetchHierarchical(year: number): Promise<HierarchicalResponse> {
  return fetchJson<HierarchicalResponse>(`/analysis/runs/current/hierarchical?year=${year}`);
}

export function useOverviewQuery() {
  return queryClient.getQueryData(["overview"]) ?? null;
}

export function useRegionalComparisonQuery() {
  return queryClient.getQueryData(["regionalComparison"]) ?? null;
}

export function useTrendsQuery() {
  return queryClient.getQueryData(["trends"]) ?? null;
}

export function useDataQualityQuery() {
  return queryClient.getQueryData(["dataQuality"]) ?? null;
}
