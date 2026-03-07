"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { CumulativePnlPoint } from "@/types/api";

export function useCumulativePnl(period: "6m" | "1y" = "6m") {
  return useQuery<CumulativePnlPoint[]>({
    queryKey: ["analysis", "cumulative-pnl", period],
    queryFn: async () => {
      const res = await apiFetch(`/api/analysis/cumulative-pnl?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch cumulative PnL");
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}
