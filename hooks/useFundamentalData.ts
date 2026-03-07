"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { FundamentalApiResponse } from "@/app/api/fundamental/route";

/** 상세정보 메모이제이션: 30분간 캐시 유지, 갱신 버튼 시에만 재요청 */
const FUNDAMENTAL_STALE_MS = 30 * 60 * 1000;

/** 유효한 6자리 종목코드만 조회(000000은 미조회 시 빈 코드가 패딩된 값이므로 제외) */
export function useFundamentalData(code: string, revalidateTrigger = 0) {
  const normalizedCode = (code ?? "").trim().padStart(6, "0");
  const hasCode = /^\d{6}$/.test(normalizedCode) && normalizedCode !== "000000";

  const query = useQuery<FundamentalApiResponse>({
    queryKey: ["fundamental", normalizedCode, revalidateTrigger],
    queryFn: async () => {
      const revalidate = revalidateTrigger > 0 ? "&revalidate=1" : "";
      const res = await apiFetch(`/api/fundamental?code=${encodeURIComponent(normalizedCode)}${revalidate}`);
      if (!res.ok) throw new Error("Failed to fetch fundamental data");
      return res.json();
    },
    enabled: hasCode,
    staleTime: FUNDAMENTAL_STALE_MS,
  });

  const data = query.data ?? null;
  return {
    data,
    kis: data?.kis ?? null,
    dart: data?.dart ?? null,
    isPending: query.isPending,
    isRefetching: query.isRefetching,
    error: query.error?.message ?? undefined,
    refetch: query.refetch,
  };
}
