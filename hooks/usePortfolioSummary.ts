"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PortfolioSummaryResponse } from "@/types/api";

export function usePortfolioSummary() {
  return useQuery<PortfolioSummaryResponse>({
    queryKey: ["kis", "portfolio-summary"],
    queryFn: async () => {
      const res = await apiFetch("/api/kis/portfolio-summary");
      if (!res.ok) throw new Error("Failed to fetch portfolio summary");
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}
