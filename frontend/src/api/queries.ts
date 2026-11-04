import { useQuery } from "@tanstack/react-query";
import { fetchOverview, type OverviewResponse } from "@/api/client";

export function useOverviewQuery() {
  return useQuery<OverviewResponse, Error>({
    queryKey: ["overview"],
    queryFn: fetchOverview,
    staleTime: 5 * 60 * 1000,
  });
}
