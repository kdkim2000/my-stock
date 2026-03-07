"use client";

import { useQuery } from "@tanstack/react-query";
import type { CumulativePnlPoint } from "@/types/api";

export function useCumulativePnl(period: "6m" | "1y" = "6m") {
  return useQuery<CumulativePnlPoint[]>({
    queryKey: ["analysis", "cumulative-pnl", period],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/cumulative-pnl?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch cumulative PnL");
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}
