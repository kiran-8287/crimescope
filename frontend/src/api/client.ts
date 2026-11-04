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

const API_BASE = "/api/v1";

export async function fetchOverview(): Promise<OverviewResponse> {
  const res = await fetch(`${API_BASE}/overview`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Overview fetch failed: ${res.status}`);
  }
  return res.json();
}

export function useOverview() {
  return queryClient.getQueryData(["overview"]) ?? null;
}
