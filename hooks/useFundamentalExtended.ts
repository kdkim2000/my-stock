"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { RatiosApiResponse } from "@/app/api/fundamental/ratios/route";
import type { EstimateApiResponse } from "@/app/api/fundamental/estimate/route";
import type { TradingApiResponse } from "@/app/api/fundamental/trading/route";

/** 30분 캐시 */
const STALE_MS = 30 * 60 * 1000;

/**
 * 성능 개선 (방안 2): 느린 지표들을 독립 useQuery로 분리하여 점진적 로딩.
 *
 * /api/fundamental 로드 완료를 기다리지 않고 각 섹션이 독립적으로 데이터를 표시합니다.
 * - ratios:   수익성·안정성·성장성·기타비율  (/api/fundamental/ratios)
 * - estimate: 추정실적                       (/api/fundamental/estimate)
 * - trading:  매매동향(투자자별+체결량)       (/api/fundamental/trading)
 */
export function useFundamentalExtended(code: string, revalidateTrigger = 0) {
  const hasCode = /^\d{6}$/.test((code ?? "").trim()) && code !== "000000";
  const codeStr = (code ?? "").trim();

  const ratiosQuery = useQuery<RatiosApiResponse>({
    queryKey: ["fundamental", "ratios", codeStr, revalidateTrigger],
    queryFn: async () => {
      const revalidate = revalidateTrigger > 0 ? "&revalidate=1" : "";
      const res = await apiFetch(`/api/fundamental/ratios?code=${encodeURIComponent(codeStr)}${revalidate}`);
      if (!res.ok) throw new Error("Failed to fetch ratios");
      return res.json();
    },
    enabled: hasCode,
    staleTime: STALE_MS,
  });

  const estimateQuery = useQuery<EstimateApiResponse>({
    queryKey: ["fundamental", "estimate", codeStr, revalidateTrigger],
    queryFn: async () => {
      const revalidate = revalidateTrigger > 0 ? "&revalidate=1" : "";
      const res = await apiFetch(`/api/fundamental/estimate?code=${encodeURIComponent(codeStr)}${revalidate}`);
      if (!res.ok) throw new Error("Failed to fetch estimate");
      return res.json();
    },
    enabled: hasCode,
    staleTime: STALE_MS,
  });

  const tradingQuery = useQuery<TradingApiResponse>({
    queryKey: ["fundamental", "trading", codeStr, revalidateTrigger],
    queryFn: async () => {
      const revalidate = revalidateTrigger > 0 ? "&revalidate=1" : "";
      const res = await apiFetch(`/api/fundamental/trading?code=${encodeURIComponent(codeStr)}${revalidate}`);
      if (!res.ok) throw new Error("Failed to fetch trading");
      return res.json();
    },
    enabled: hasCode,
    staleTime: STALE_MS,
  });

  return {
    ratios: {
      data: ratiosQuery.data ?? null,
      isPending: ratiosQuery.isPending,
      isRefetching: ratiosQuery.isRefetching,
    },
    estimate: {
      data: estimateQuery.data ?? null,
      isPending: estimateQuery.isPending,
      isRefetching: estimateQuery.isRefetching,
    },
    trading: {
      data: tradingQuery.data ?? null,
      isPending: tradingQuery.isPending,
      isRefetching: tradingQuery.isRefetching,
    },
    isRefetching:
      ratiosQuery.isRefetching ||
      estimateQuery.isRefetching ||
      tradingQuery.isRefetching,
  };
}
