import { useQuery } from "@tanstack/react-query";
import {
  fetchOverview,
  fetchRegionalComparison,
  fetchTrends,
  fetchTopCategories,
  fetchCorrelations,
  fetchDataQuality,
  fetchPca,
  fetchKmeans,
  fetchHierarchical,
  type OverviewResponse,
  type RegionalComparisonResponse,
  type TrendsResponse,
} from "@/api/client";

export type CategoryStat = { category: string; year: number | string; total_cases: number };
export type CorrelationPair = { category_1: string; category_2: string; correlation: number };
export type DataQualityResponse = {
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
};
export type PcaResponse = { year: number; n_regions: number; n_categories: number; n_components: number; eigenvalues: number[]; explained_variance_ratio: number[]; cumulative_variance_ratio: number[]; loadings: any[]; components: any[]; message?: string };
export type KMeansResponse = { year: number; k: number; n_regions: number; n_categories: number; inertia: number; cluster_sizes: number[]; clusters: any[]; assignments: Record<string, number>; message?: string };
export type HierarchicalResponse = { year: number; linkage: string; n_regions: number; n_categories: number; max_clusters: number; merge_history: any[]; clusters: any[]; message?: string };

export function useOverviewQuery() {
  return useQuery<OverviewResponse, Error>({
    queryKey: ["overview"],
    queryFn: fetchOverview,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRegionalComparisonQuery(year: number, category?: string) {
  return useQuery<RegionalComparisonResponse, Error>({
    queryKey: ["regionalComparison", year, category],
    queryFn: () => fetchRegionalComparison(year, category),
    staleTime: 5 * 60 * 1000,
    enabled: !!year,
  });
}

export function useTrendsQuery(region: string, category: string) {
  return useQuery<TrendsResponse, Error>({
    queryKey: ["trends", region, category],
    queryFn: () => fetchTrends(region, category),
    staleTime: 5 * 60 * 1000,
    enabled: !!region && !!category,
  });
}

export function useTopCategoriesQuery(year: number, topN: number) {
  return useQuery<CategoryStat[], Error>({
    queryKey: ["topCategories", year, topN],
    queryFn: () => fetchTopCategories(year, topN),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCorrelationsQuery(year: number, topN: number) {
  return useQuery<CorrelationPair[], Error>({
    queryKey: ["correlations", year, topN],
    queryFn: () => fetchCorrelations(year, topN),
    staleTime: 5 * 60 * 1000,
  });
}

export function useDataQualityQuery() {
  return useQuery<DataQualityResponse, Error>({
    queryKey: ["dataQuality"],
    queryFn: fetchDataQuality,
    staleTime: 10 * 60 * 1000,
  });
}

export function usePcaQuery(year: number) {
  return useQuery<PcaResponse, Error>({
    queryKey: ["pca", year],
    queryFn: () => fetchPca(year),
    staleTime: 10 * 60 * 1000,
    enabled: !!year,
  });
}

export function useKmeansQuery(year: number, k: number) {
  return useQuery<KMeansResponse, Error>({
    queryKey: ["kmeans", year, k],
    queryFn: () => fetchKmeans(year, k),
    staleTime: 10 * 60 * 1000,
    enabled: !!year && !!k,
  });
}

export function useHierarchicalQuery(year: number) {
  return useQuery<HierarchicalResponse, Error>({
    queryKey: ["hierarchical", year],
    queryFn: () => fetchHierarchical(year),
    staleTime: 10 * 60 * 1000,
    enabled: !!year,
  });
}
