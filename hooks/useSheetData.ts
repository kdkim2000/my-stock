"use client";

import { useQuery } from "@tanstack/react-query";
import type { TransactionsResponse } from "@/types/api";

export function useSheetData() {
  return useQuery<TransactionsResponse>({
    queryKey: ["sheets", "transactions"],
    queryFn: async () => {
      const res = await fetch("/api/sheets/transactions");
      if (!res.ok) throw new Error("Failed to fetch transactions");
      return res.json();
    },
    staleTime: 60 * 1000,
  });
}
