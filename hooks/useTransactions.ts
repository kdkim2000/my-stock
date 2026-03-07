"use client";

import { useSheetData } from "./useSheetData";

/**
 * 거래 목록 + 상세 (현재는 useSheetData 래핑)
 */
export function useTransactions() {
  return useSheetData();
}
