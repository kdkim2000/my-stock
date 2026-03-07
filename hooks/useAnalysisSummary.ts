"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalysisSummaryResponse } from "@/types/api";

export function useAnalysisSummary() {
  return useQuery<AnalysisSummaryResponse>({
    queryKey: ["analysis", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/analysis/summary");
      if (!res.ok) throw new Error("Failed to fetch analysis summary");
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}
