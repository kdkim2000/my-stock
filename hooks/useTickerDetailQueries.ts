"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { useFundamentalData } from "./useFundamentalData";
import { useFundamentalExtended } from "./useFundamentalExtended";
import type { TickerDetailInfo, TechnicalIndicatorsResponse, KisInvestmentOpinion } from "@/types/api";

const STALE_TIME_MS = 30 * 60 * 1000;

export function useTickerDetailQueries({
  tickerOrCode,
  revalidateTrigger,
}: {
  tickerOrCode: string;
  revalidateTrigger: number;
}) {
  const isCode = /^\d{6}$/.test(tickerOrCode);

  const stockInfoQuery = useQuery<TickerDetailInfo>({
    queryKey: ["kis", "stock-info", tickerOrCode],
    queryFn: async () => {
      const url = isCode
        ? `/api/kis/stock-info?code=${encodeURIComponent(tickerOrCode)}`
        : `/api/kis/stock-info?ticker=${encodeURIComponent(tickerOrCode)}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to fetch stock info");
      return res.json();
    },
    enabled: !!tickerOrCode,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  // tickerOrCode가 6자리 코드면 즉시 사용, 아니면 stock-info 응답에서 얻음
  const code = isCode ? tickerOrCode : (stockInfoQuery.data?.code ?? "");

  const fundamentalData = useFundamentalData(code, revalidateTrigger);
  const extended = useFundamentalExtended(code, revalidateTrigger);

  const indicatorsQuery = useQuery<TechnicalIndicatorsResponse>({
    queryKey: ["kis", "indicators", code ?? "", revalidateTrigger],
    queryFn: async () => {
      const revalidate = revalidateTrigger > 0 ? "&revalidate=1" : "";
      const res = await apiFetch(`/api/kis/indicators?code=${encodeURIComponent(code!)}${revalidate}`);
      if (!res.ok) throw new Error("Failed to fetch indicators");
      return res.json();
    },
    enabled: !!code,
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  const opinionQuery = useQuery<KisInvestmentOpinion>({
    queryKey: ["kis", "opinion", code, revalidateTrigger],
    queryFn: async () => {
      const revalidate = revalidateTrigger > 0 ? "&revalidate=1" : "";
      const res = await apiFetch(`/api/kis/opinion?code=${encodeURIComponent(code!)}${revalidate}`);
      if (!res.ok) throw new Error("Failed to fetch opinion");
      return res.json();
    },
    enabled: !!code && /^\d{6}$/.test(code),
    staleTime: STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });

  // 분리된 ratios/estimate/trading 데이터를 fundamentalData.kis에 병합
  const mergedFundamental = useMemo(() => {
    const base = fundamentalData;
    const ratiosData = extended.ratios.data;
    const estimateData = extended.estimate.data;
    const tradingData = extended.trading.data;
    if (!ratiosData && !estimateData && !tradingData) return base;
    return {
      ...base,
      isPending: base.isPending,
      isRefetching: base.isRefetching || extended.isRefetching,
      kis: base.kis
        ? {
            ...base.kis,
            financialRatio: ratiosData?.financialRatio ?? base.kis.financialRatio,
            profitRatio: ratiosData?.profitRatio ?? base.kis.profitRatio,
            stabilityRatio: ratiosData?.stabilityRatio ?? base.kis.stabilityRatio,
            growthRatio: ratiosData?.growthRatio ?? base.kis.growthRatio,
            otherMajorRatios: ratiosData?.otherMajorRatios ?? base.kis.otherMajorRatios,
            estimatePerform: estimateData?.estimatePerform ?? base.kis.estimatePerform,
            investorTradeDaily: tradingData?.investorTradeDaily ?? base.kis.investorTradeDaily ?? [],
            dailyTradeVolume: tradingData?.dailyTradeVolume ?? base.kis.dailyTradeVolume ?? [],
          }
        : base.kis,
    };
  }, [fundamentalData, extended.ratios.data, extended.estimate.data, extended.trading.data, extended.isRefetching]);

  const isRefreshing =
    stockInfoQuery.isRefetching ||
    fundamentalData.isRefetching ||
    extended.isRefetching ||
    indicatorsQuery.isRefetching ||
    opinionQuery.isRefetching;

  return {
    code,
    stockInfoQuery,
    fundamentalData,
    extended,
    indicatorsQuery,
    opinionQuery,
    mergedFundamental,
    isRefreshing,
  };
}
