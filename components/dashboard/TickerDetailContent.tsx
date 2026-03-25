"use client";

import { useState, useMemo, useCallback, useRef, memo, Fragment, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useAnalysisSummary } from "@/hooks/useAnalysisSummary";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { useSheetData } from "@/hooks/useSheetData";
import { useFundamentalData } from "@/hooks/useFundamentalData";
import { useFundamentalExtended } from "@/hooks/useFundamentalExtended";
import type {
  TickerDetailInfo,
  TechnicalIndicatorsResponse,
  KisInvestmentOpinion,
} from "@/types/api";

import {
  formatRatioVal,
} from "./ticker-detail/utils";

import { TickerDetailHeader } from "./ticker-detail/header";
import { QuoteSection } from "./ticker-detail/sections/quote-section";
import { ValuationSection } from "./ticker-detail/sections/valuation-section";
import { FinancialSection } from "./ticker-detail/sections/financial-section";
import { RatioSection } from "./ticker-detail/sections/ratio-section";
import { EstimateSection } from "./ticker-detail/sections/estimate-section";
import { TradeSection } from "./ticker-detail/sections/trade-section";
import { OpinionSection } from "./ticker-detail/sections/opinion-section";
import { DartSection } from "./ticker-detail/sections/dart-section";
import { PortfolioSection } from "./ticker-detail/sections/portfolio-section";
import { IndicatorsSection } from "./ticker-detail/sections/indicators-section";
import { AiGuideSection } from "./ticker-detail/sections/ai-guide-section";
import { JournalSection } from "./ticker-detail/sections/journal-section";
const STALE_TIME_DETAIL_MS = 30 * 60 * 1000; // 상세정보 메모이제이션: 30분간 캐시 유지

function TickerDetailContentInner({ tickerOrCode }: { tickerOrCode: string }) {
  const isCode = /^\d{6}$/.test(tickerOrCode);
  const [revalidateTrigger, setRevalidateTrigger] = useState(0);
  const queryClient = useQueryClient();

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
    staleTime: STALE_TIME_DETAIL_MS,
  });

  const code = stockInfoQuery.data?.code ?? "";
  const fundamentalData = useFundamentalData(code, revalidateTrigger);
  /** 분리된 느린 지표(비율·추정실적·매매동향) — 독립적으로 로딩(방안 2) */
  const extended = useFundamentalExtended(code, revalidateTrigger);

  const indicatorsQuery = useQuery<TechnicalIndicatorsResponse>({
    queryKey: ["kis", "indicators", code ?? ""],
    queryFn: async () => {
      const res = await apiFetch(`/api/kis/indicators?code=${encodeURIComponent(code!)}`);
      if (!res.ok) throw new Error("Failed to fetch indicators");
      return res.json();
    },
    enabled: !!code,
    staleTime: STALE_TIME_DETAIL_MS,
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
    staleTime: STALE_TIME_DETAIL_MS,
  });

  const analysis = useAnalysisSummary();
  const portfolio = usePortfolioSummary();
  const sheet = useSheetData();

  const ticker = stockInfoQuery.data?.ticker ?? tickerOrCode;
  const analysisRow = useMemo(
    () => analysis.data?.tickers?.find((t) => t.ticker === ticker),
    [analysis.data?.tickers, ticker]
  );
  const position = useMemo(
    () => portfolio.data?.positions?.find((p) => p.ticker === ticker),
    [portfolio.data?.positions, ticker]
  );
  const transactions = useMemo(
    () => (sheet.data?.transactions ?? []).filter((r) => (r.Ticker || "").trim() === ticker),
    [sheet.data?.transactions, ticker]
  );

  /** AI 분석 요청용: 상세 정보 요약 + 최근 매매 일지. 페이지에 표시된 데이터를 그대로 전달해 서버 중복 호출을 줄임 */
  const aiContext = useMemo(() => {
    const parts: string[] = [];
    parts.push(`[종목] ${ticker} (코드 ${code})`);

    const priceInfoVal =
      stockInfoQuery.data?.priceInfo ?? fundamentalData.kis?.priceInfo ?? undefined;
    if (priceInfoVal) {
      const p = priceInfoVal;
      parts.push(
        `[시세] 현재가 ${p.stckPrpr.toLocaleString("ko-KR")}원, 전일대비 ${p.prdyVrss >= 0 ? "+" : ""}${p.prdyVrss} (${p.prdyCtrt}%)`
      );
    } else {
      parts.push("[시세] 시세 없음");
    }

    const kis = fundamentalData.kis;
    const ratio = kis?.financialRatio as Record<string, unknown> | null | undefined;
    const per = kis?.per ?? ratio?.per ?? ratio?.stck_per ?? ratio?.prdy_per;
    const pbr = kis?.pbr ?? ratio?.pbr ?? ratio?.stck_pbr ?? ratio?.prdy_pbr;
    const eps = kis?.eps ?? ratio?.eps ?? ratio?.stck_eps ?? ratio?.prdy_eps;
    const bps = kis?.bps ?? ratio?.bps ?? ratio?.stck_bps ?? ratio?.prdy_bps;
    const roe = ratio?.roe ?? ratio?.stck_roe;
    const roa = ratio?.roa ?? ratio?.stck_roa;
    const debtRt = ratio?.debt_rt ?? ratio?.debtRatio;
    const ratioLine = [
      per != null ? `PER ${formatRatioVal(per)}` : null,
      pbr != null ? `PBR ${formatRatioVal(pbr)}` : null,
      eps != null ? `EPS ${formatRatioVal(eps)}` : null,
      bps != null ? `BPS ${formatRatioVal(bps)}` : null,
      roe != null ? `ROE ${formatRatioVal(roe)}%` : null,
      roa != null ? `ROA ${formatRatioVal(roa)}%` : null,
      debtRt != null ? `부채비율 ${formatRatioVal(debtRt)}%` : null,
    ]
      .filter(Boolean)
      .join(", ");
    parts.push(`[가치지표] ${ratioLine || "없음"}`);

    const opinion = opinionQuery.data?.tickerOpinion ?? kis?.opinion?.tickerOpinion;
    if (opinion) {
      const target = opinion.targetPrice != null ? formatRatioVal(opinion.targetPrice) : "—";
      parts.push(
        `[투자의견] ${opinion.opinionName ?? ""} / 목표가 ${target} / 전망: ${opinion.outlook ?? "—"}`
      );
    } else {
      parts.push("[투자의견] 없음");
    }

    const multiYear = fundamentalData.dart?.multiYear ?? [];
    if (multiYear.length > 0) {
      const dartLines = multiYear.map((y) => {
        const is_ = y.incomeStatement as { revenue?: number; operatingIncome?: number; netIncome?: number };
        const rev = is_.revenue ?? 0;
        const op = is_.operatingIncome ?? 0;
        const net = is_.netIncome ?? 0;
        return `${y.year}: 매출 ${(rev ?? 0).toLocaleString("ko-KR")} / 영업이익 ${(op ?? 0).toLocaleString("ko-KR")} / 당기순이익 ${(net ?? 0).toLocaleString("ko-KR")}`;
      });
      parts.push("[재무 추이] DART 재무 추이 (최근 연도):\n" + dartLines.join("\n"));
    } else {
      parts.push("[재무 추이] 없음");
    }

    const ind = indicatorsQuery.data;
    if (ind) {
      const rsiStr = ind.rsi != null ? ind.rsi.toFixed(1) : "—";
      const macdStr =
        ind.macd != null
          ? `MACD ${ind.macd.macd.toFixed(2)} / Signal ${ind.macd.signal.toFixed(2)} / Histogram ${ind.macd.histogram.toFixed(2)}`
          : "—";
      parts.push(`[보조지표] RSI(14): ${rsiStr}, ${macdStr} (기준일 ${ind.date ?? "—"})`);
    } else {
      parts.push("[보조지표] 없음");
    }

    if (position && position.quantity > 0) {
      const avg = position.buyAmount / position.quantity;
      const rate =
        position.buyAmount > 0
          ? ((position.profitLoss / position.buyAmount) * 100).toFixed(1)
          : "—";
      parts.push(
        `[내 포트폴리오 - 해당 종목] 보유 수량 ${position.quantity.toLocaleString("ko-KR")}주, 평균 단가 ${avg.toFixed(0)}원, 평가금액 ${position.marketValue.toLocaleString("ko-KR")}원, 평가손익 ${position.profitLoss >= 0 ? "+" : ""}${position.profitLoss.toLocaleString("ko-KR")}원 (수익률 ${rate}%)`
      );
    } else {
      parts.push("[내 포트폴리오 - 해당 종목] 해당 종목 보유 없음");
    }

    const detailSummary = parts.join("\n");
    const journalEntries = [...transactions]
      .sort((a, b) => String(b.Date ?? "").localeCompare(String(a.Date ?? "")))
      .slice(0, 30)
      .map((r) => ({
        Date: String(r.Date ?? ""),
        Type: r.Type,
        Quantity: Number(r.Quantity) || 0,
        Price: Number(r.Price) || 0,
        Journal: r.Journal ? String(r.Journal) : undefined,
      }));
    return { detailSummary, journalEntries };
  }, [
    ticker,
    code,
    stockInfoQuery.data?.priceInfo,
    fundamentalData.kis,
    fundamentalData.dart?.multiYear,
    indicatorsQuery.data,
    opinionQuery.data,
    position,
    transactions,
  ]);

  const priceInfo = useMemo(
    () =>
      stockInfoQuery.data?.priceInfo ??
      fundamentalData.kis?.priceInfo ??
      undefined,
    [stockInfoQuery.data?.priceInfo, fundamentalData.kis?.priceInfo]
  );
  /**
   * 분리된 ratios/estimate/trading 데이터를 fundamentalData.kis 에 병합합니다.
   * 섹션 컴포넌트의 props 구조(fundamentalData.kis.XXX)를 그대로 유지하면서
   * 각 섹션이 도착하는 즉시 화면에 표시됩니다(점진적 로딩).
   */
  const mergedFundamental = useMemo(() => {
    const base = fundamentalData;
    // extended 데이터가 아직 없으면 base 그대로 반환
    const ratiosData = extended.ratios.data;
    const estimateData = extended.estimate.data;
    const tradingData = extended.trading.data;
    const hasExtended = ratiosData || estimateData || tradingData;
    if (!hasExtended) return base;
    return {
      ...base,
      // extended 로딩 중 여부를 isPending 에 반영
      isPending: base.isPending,
      isRefetching: base.isRefetching || extended.isRefetching,
      kis: base.kis
        ? {
            ...base.kis,
            // 비율
            financialRatio: ratiosData?.financialRatio ?? base.kis.financialRatio,
            profitRatio: ratiosData?.profitRatio ?? base.kis.profitRatio,
            stabilityRatio: ratiosData?.stabilityRatio ?? base.kis.stabilityRatio,
            growthRatio: ratiosData?.growthRatio ?? base.kis.growthRatio,
            otherMajorRatios: ratiosData?.otherMajorRatios ?? base.kis.otherMajorRatios,
            // 추정실적
            estimatePerform: estimateData?.estimatePerform ?? base.kis.estimatePerform,
            // 매매동향
            investorTradeDaily: tradingData?.investorTradeDaily ?? base.kis.investorTradeDaily ?? [],
            dailyTradeVolume: tradingData?.dailyTradeVolume ?? base.kis.dailyTradeVolume ?? [],
          }
        : base.kis,
    };
  }, [fundamentalData, extended.ratios.data, extended.estimate.data, extended.trading.data, extended.isRefetching]);

  const hasPosition = (position?.quantity ?? 0) > 0;
  const isRefreshing =
    stockInfoQuery.isRefetching ||
    fundamentalData.isRefetching ||
    extended.isRefetching ||
    indicatorsQuery.isRefetching ||
    opinionQuery.isRefetching;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["kis", "stock-info", tickerOrCode] });
    void queryClient.refetchQueries({ queryKey: ["kis", "stock-info", tickerOrCode] });
    if (code && /^\d{6}$/.test(code)) {
      setRevalidateTrigger((t) => t + 1); // fundamental·opinion: 새 queryKey로 revalidate=1 전달
      queryClient.invalidateQueries({ queryKey: ["fundamental", code] });
      queryClient.invalidateQueries({ queryKey: ["kis", "indicators", code] });
      queryClient.invalidateQueries({ queryKey: ["kis", "opinion", code] });
      void queryClient.refetchQueries({ queryKey: ["kis", "indicators", code] });
    }
  }, [queryClient, tickerOrCode, code]);

  /** AI 분석 결과: 서버 캐시(Google Sheets) 우선 → 없으면 OpenAI 호출 */
  const aiForceRef = useRef(false);
  const [aiQueryEnabled, setAiQueryEnabled] = useState(true);

  const aiGuideQuery = useQuery({
    queryKey: ["ai", "trading-guide", code],
    queryFn: async () => {
      const isForce = aiForceRef.current;
      const body: {
        code: string;
        ticker: string;
        force?: boolean;
        cacheOnly?: boolean;
        context?: { detailSummary: string; journalEntries: unknown[] };
      } = {
        code,
        ticker,
        force: isForce,
        cacheOnly: !isForce,
      };

      if (isForce && aiContext.detailSummary.trim()) {
        body.context = {
          detailSummary: aiContext.detailSummary,
          journalEntries: aiContext.journalEntries,
        };
      }

      const res = await apiFetch("/api/ai/trading-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { content?: string; cachedAt?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "요청 실패");

      // 호출 완료 후 플래그 초기화
      aiForceRef.current = false;
      return { content: data.content ?? null, cachedAt: data.cachedAt ?? null };
    },
    enabled: !!code && aiQueryEnabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const aiContent = aiGuideQuery.data?.content ?? null;
  const aiCachedAt = aiGuideQuery.data?.cachedAt ?? null;
  const aiError = aiGuideQuery.error?.message ?? null;
  const aiLoading = aiGuideQuery.isFetching;

  /** 캐시 있으면 재요청 생략(토큰 절약). "AI 분석 요청" 버튼 클릭 시에는 OpenAI 분석 수행 */
  const requestAiGuide = useCallback(
    () => {
      if (!code) return;
      // 이미 내용이 있으면(캐시 히트) 중복 요청 방지
      if (aiGuideQuery.data?.content) return;

      aiForceRef.current = true; // 버튼 클릭 시에는 OpenAI 분석 수행
      void aiGuideQuery.refetch();
    },
    [code, aiGuideQuery.data?.content, aiGuideQuery.refetch]
  );

  const requestAiGuideRefresh = useCallback(() => {
    if (!code) return;
    aiForceRef.current = true; // OpenAI 강제 재호출
    void aiGuideQuery.refetch();
  }, [code, aiGuideQuery.refetch]);

  if (!tickerOrCode) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-6 text-muted-foreground shadow-sm">
        종목 코드 또는 종목명을 입력해 주세요.
      </div>
    );
  }

  if (stockInfoQuery.isPending && !stockInfoQuery.data) {
    return <div className="text-muted-foreground">로딩 중...</div>;
  }

  const info = stockInfoQuery.data;

  return (
    <div className="space-y-8">
      <TickerDetailHeader
        tickerOrCode={tickerOrCode}
        code={code}
        tickerStr={info?.ticker ?? tickerOrCode}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        priceInfo={priceInfo}
        hasPosition={hasPosition}
        position={position}
      />

      <QuoteSection priceInfo={priceInfo} info={info} />
      <ValuationSection kis={mergedFundamental.kis} info={info} />
      <FinancialSection fundamentalData={mergedFundamental} />

      <RatioSection fundamentalData={mergedFundamental} />
      <EstimateSection fundamentalData={mergedFundamental} />

      <TradeSection fundamentalData={mergedFundamental} />
      <OpinionSection opinionQuery={opinionQuery} />

      <DartSection fundamentalData={fundamentalData} />

      <PortfolioSection analysisRow={analysisRow} position={position} />
      <IndicatorsSection indicatorsQuery={indicatorsQuery} />
      <AiGuideSection
        aiLoading={aiLoading}
        aiError={aiError}
        aiContent={aiContent}
        aiCachedAt={aiCachedAt}
        code={code}
        requestAiGuide={requestAiGuide}
        requestAiGuideRefresh={requestAiGuideRefresh}
      />
      <JournalSection transactions={transactions} />
    </div>
  );
}

/** 상세정보 메모이제이션: tickerOrCode 동일 시 리렌더 최소화. 재무·시세 갱신 시에만 전체 재요청 */
export const TickerDetailContent = memo(TickerDetailContentInner);
