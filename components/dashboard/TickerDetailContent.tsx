"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Activity,
  BarChart2,
  Calendar,
  CircleDollarSign,
  FileText,
  Info,
  LayoutList,
  MessageSquare,
  Table2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { apiFetch } from "@/lib/api-client";
import { useAnalysisSummary } from "@/hooks/useAnalysisSummary";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { useSheetData } from "@/hooks/useSheetData";
import { useFundamentalData } from "@/hooks/useFundamentalData";
import type { TickerDetailInfo, TechnicalIndicatorsResponse } from "@/types/api";
import type { SheetTransactionRow } from "@/types/sheet";

const formatFundamentalNum = (v: number) => {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}만`;
  return String(v);
};

/** KIS 비율/원시 객체에서 숫자 또는 문자열로 표시 */
const formatRatioVal = (v: unknown): string => {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isNaN(v) ? "—" : (v >= 1 || v <= -1 ? v.toFixed(1) : v.toFixed(2));
  if (typeof v === "string") return v;
  return String(v);
};

/** 투자자매매동향 일별 칼럼 영문키 → 한글 라벨 */
const INVESTOR_TRADE_DAILY_LABELS: Record<string, string> = {
  stck_bsop_date: "일자",
  stck_bsop_dt: "일자",
  prsn_ntby_qty: "개인 순매수(수량)",
  frgn_ntby_qty: "외국인 순매수(수량)",
  orgn_ntby_qty: "기관 순매수(수량)",
  prsn_ntby_amt: "개인 순매수(금액)",
  frgn_ntby_amt: "외국인 순매수(금액)",
  orgn_ntby_amt: "기관 순매수(금액)",
  prsn_seln_qty: "개인 매도(수량)",
  frgn_seln_qty: "외국인 매도(수량)",
  orgn_seln_qty: "기관 매도(수량)",
  prsn_shnu_qty: "개인 매수(수량)",
  frgn_shnu_qty: "외국인 매수(수량)",
  orgn_shnu_qty: "기관 매수(수량)",
  acml_vol: "누적거래량",
  acml_tr_pbmn: "누적거래대금",
};

/** 일별 매수매도체결량 칼럼 영문키 → 한글 라벨 */
const DAILY_TRADE_VOLUME_LABELS: Record<string, string> = {
  stck_bsop_date: "일자",
  stck_bsop_dt: "일자",
  acml_vol: "누적거래량",
  acml_tr_pbmn: "누적거래대금",
  prsn_buy_qty: "개인 매수(수량)",
  prsn_sell_qty: "개인 매도(수량)",
  frgn_buy_qty: "외국인 매수(수량)",
  frgn_sell_qty: "외국인 매도(수량)",
  orgn_buy_qty: "기관 매수(수량)",
  orgn_sell_qty: "기관 매도(수량)",
  buy_vol: "매수체결량",
  sell_vol: "매도체결량",
};

function tradingColumnLabel(key: string, labels: Record<string, string>): string {
  return labels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 매매동향 셀 값 포맷: 8자리 일자 → YYYY-MM-DD, 숫자 → 천단위 구분·부호 */
function formatTradingVal(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") {
    if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    return v;
  }
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "—";
    return v >= 0 ? v.toLocaleString("ko-KR") : `-${Math.abs(v).toLocaleString("ko-KR")}`;
  }
  return String(v);
}

/** Record<string, unknown>에서 숫자형 키만 필터해 라벨 매핑 (한글 우선) */
const RATIO_LABELS: Record<string, string> = {
  per: "PER", pbr: "PBR", eps: "EPS", bps: "BPS", roe: "ROE(%)", roa: "ROA(%)",
  prdy_per: "PER", prdy_pbr: "PBR", stck_per: "PER", stck_pbr: "PBR",
  op_rt: "영업이익률(%)", op_mgn: "영업이익률", net_rt: "순이익률", net_mgn: "순이익률",
  debt_rt: "부채비율(%)", cur_rt: "유동비율(%)", cpa_rt: "유동비율",
  rev_gr: "매출성장률(%)", inc_gr: "이익성장률(%)",
};
function renderRatioCard(title: string, data: Record<string, unknown> | null) {
  if (!data || typeof data !== "object") return null;
  const entries = Object.entries(data).filter(
    ([k, v]) => v != null && typeof v === "number" && !k.toLowerCase().includes("date") && !k.toLowerCase().includes("code")
  ) as [string, number][];
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
      <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {entries.slice(0, 8).map(([key, val]) => (
          <div key={key}>
            <span className="text-muted-foreground">{RATIO_LABELS[key] ?? key}</span>
            <span className="ml-1 font-medium">{formatRatioVal(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const [openDoc, setOpenDoc] = useState<"business" | "mda" | "notes" | null>(null);
  const fundamentalData = useFundamentalData(code, revalidateTrigger);

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

  const priceInfo = useMemo(
    () =>
      stockInfoQuery.data?.priceInfo ??
      fundamentalData.kis?.priceInfo ??
      undefined,
    [stockInfoQuery.data?.priceInfo, fundamentalData.kis?.priceInfo]
  );
  const hasPosition = (position?.quantity ?? 0) > 0;
  const isRefreshing =
    stockInfoQuery.isRefetching || fundamentalData.isRefetching || indicatorsQuery.isRefetching;

  const handleRefresh = useCallback(() => {
    setRevalidateTrigger((t) => t + 1); // fundamental은 새 키로 자동 fetch(revalidate=1)
    queryClient.invalidateQueries({ queryKey: ["kis", "stock-info", tickerOrCode] });
    queryClient.invalidateQueries({ queryKey: ["fundamental", code] });
    queryClient.invalidateQueries({ queryKey: ["kis", "indicators", code] });
    void queryClient.refetchQueries({ queryKey: ["kis", "stock-info", tickerOrCode] });
    void queryClient.refetchQueries({ queryKey: ["kis", "indicators", code] });
  }, [queryClient, tickerOrCode, code]);

  if (!tickerOrCode) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6 text-muted-foreground">
        종목 코드 또는 종목명을 입력해 주세요.
      </div>
    );
  }

  if (stockInfoQuery.isPending && !stockInfoQuery.data) {
    return <div className="text-muted-foreground">로딩 중...</div>;
  }

  const info = stockInfoQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-xl border border-border/60 bg-muted/50 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 disabled:opacity-50"
        >
          {isRefreshing ? "갱신 중…" : "재무·시세 갱신"}
        </button>
      </div>

      {/* 이 페이지 내 섹션 */}
      <nav className="rounded-xl border border-border/60 bg-muted/30 p-4" aria-label="이 페이지 내 섹션">
        <p className="text-xs font-medium text-muted-foreground mb-2">이 페이지 내 섹션</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href="#section-quote" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />시세 요약
          </a>
          <a href="#section-valuation" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <CircleDollarSign className="w-3.5 h-3.5 shrink-0" />가치평가
          </a>
          <a href="#section-financial-kis" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Table2 className="w-3.5 h-3.5 shrink-0" />재무(KIS)
          </a>
          <a href="#section-ratio-kis" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <LayoutList className="w-3.5 h-3.5 shrink-0" />비율(KIS)
          </a>
          <a href="#section-estimate-kis" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Table2 className="w-3.5 h-3.5 shrink-0" />추정실적(KIS)
          </a>
          <a href="#section-trade-kis" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <BarChart2 className="w-3.5 h-3.5 shrink-0" />매매동향(KIS)
          </a>
          <a href="#section-opinion" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />투자의견
          </a>
          <a href="#section-dart-income" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <BarChart2 className="w-3.5 h-3.5 shrink-0" />DART 손익
          </a>
          <a href="#section-cashflow" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Table2 className="w-3.5 h-3.5 shrink-0" />현금흐름
          </a>
          <a href="#section-disclosure" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <FileText className="w-3.5 h-3.5 shrink-0" />공시
          </a>
          <a href="#section-portfolio" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Wallet className="w-3.5 h-3.5 shrink-0" />내 포트폴리오
          </a>
          <a href="#section-indicators" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Activity className="w-3.5 h-3.5 shrink-0" />보조지표
          </a>
          <a href="#section-reference" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Info className="w-3.5 h-3.5 shrink-0" />참고 지표
          </a>
          <a href="#section-journal" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Calendar className="w-3.5 h-3.5 shrink-0" />최근 매매 일지
          </a>
        </div>
      </nav>

      {/* 상단: 종목명, 코드, 현재가, 전일대비, 내 보유 요약 */}
      <section className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{info?.ticker ?? tickerOrCode}</h1>
            <p className="text-sm text-muted-foreground">종목코드 {info?.code ?? "—"}</p>
          </div>
          <div className="text-right">
            {priceInfo ? (
              <>
                <p className="text-2xl font-semibold">{priceInfo.stckPrpr.toLocaleString()}원</p>
                <p
                  className={
                    priceInfo.prdyVrss >= 0 ? "text-profit" : "text-loss"
                  }
                >
                  {priceInfo.prdyVrss >= 0 ? "+" : ""}
                  {priceInfo.prdyVrss.toLocaleString()} ({priceInfo.prdyCtrt >= 0 ? "+" : ""}
                  {priceInfo.prdyCtrt}%)
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">시세 없음 (KIS 미연동 또는 종목코드 확인)</p>
            )}
          </div>
        </div>
        {hasPosition && position && (
          <div className="mt-4 flex flex-wrap gap-4 rounded-md bg-muted/50 p-4">
            <span>보유 수량 {position.quantity.toLocaleString()}주</span>
            <span>평가금액 {position.marketValue.toLocaleString()}원</span>
            <span className={position.profitLoss >= 0 ? "text-profit" : "text-loss"}>
              평가손익 {position.profitLoss >= 0 ? "+" : ""}
              {position.profitLoss.toLocaleString()}원
            </span>
          </div>
        )}
      </section>

      {/* 시세 요약 */}
      <section id="section-quote" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 shrink-0 text-muted-foreground" />
          시세 요약
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {priceInfo?.stckOprc != null && priceInfo.stckOprc > 0 && (
            <div>
              <p className="text-muted-foreground">시가</p>
              <p>{priceInfo.stckOprc.toLocaleString()}</p>
            </div>
          )}
          {priceInfo?.stckHgpr != null && priceInfo.stckHgpr > 0 && (
            <div>
              <p className="text-muted-foreground">고가</p>
              <p>{priceInfo.stckHgpr.toLocaleString()}</p>
            </div>
          )}
          {priceInfo?.stckLwpr != null && priceInfo.stckLwpr > 0 && (
            <div>
              <p className="text-muted-foreground">저가</p>
              <p>{priceInfo.stckLwpr.toLocaleString()}</p>
            </div>
          )}
          {priceInfo?.acmlVol != null && priceInfo.acmlVol > 0 && (
            <div>
              <p className="text-muted-foreground">거래량</p>
              <p>{priceInfo.acmlVol.toLocaleString()}</p>
            </div>
          )}
          {info?.weekly52High != null && (
            <div>
              <p className="text-muted-foreground">52주 최고</p>
              <p>{info.weekly52High.toLocaleString()}</p>
            </div>
          )}
          {info?.weekly52Low != null && (
            <div>
              <p className="text-muted-foreground">52주 최저</p>
              <p>{info.weekly52Low.toLocaleString()}</p>
            </div>
          )}
        </div>
        {!priceInfo && !info?.weekly52High && (
          <p className="text-sm text-muted-foreground">KIS API 연동 시 시세·52주 고저가 표시됩니다.</p>
        )}
      </section>

      {/* 가치평가 — KIS 실시간 PER/PBR/EPS (최근 실적 반영) */}
      <section id="section-valuation" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4 shrink-0 text-muted-foreground" />
            가치평가
          </h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            최근 실적 반영(KIS 기준)
          </span>
        </div>
        {(() => {
          const kis = fundamentalData.kis;
          const per = kis?.per ?? info?.per ?? null;
          const pbr = kis?.pbr ?? info?.pbr ?? null;
          const eps = kis?.eps ?? info?.eps ?? null;
          const bps = kis?.bps ?? info?.bps ?? null;
          const fmtNum = (n: number | null | undefined) =>
            n != null && n > 0 ? (n >= 1 ? n.toFixed(1) : n.toFixed(2)) : "—";
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground">PER</p>
                <p className="text-xl font-semibold">{fmtNum(per)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground">PBR</p>
                <p className="text-xl font-semibold">{fmtNum(pbr)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground">EPS(원)</p>
                <p className="text-xl font-semibold">
                  {eps != null && eps > 0 ? Math.round(eps).toLocaleString() : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-muted-foreground">BPS(원)</p>
                <p className="text-xl font-semibold">
                  {bps != null && bps > 0 ? Math.round(bps).toLocaleString() : "—"}
                </p>
              </div>
              {kis?.forwardEps != null && kis.forwardEps > 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-muted-foreground">Forward EPS(원)</p>
                  <p className="text-xl font-semibold">{Math.round(kis.forwardEps).toLocaleString()}</p>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* 재무 요약 (KIS) — 대차대조표·손익계산서 (가치투자용) */}
      {(() => {
        const kis = fundamentalData.kis;
        const bs = kis?.balanceSheet;
        const inc = kis?.incomeStatement;
        const hasBs = bs && (bs.totalAssets != null || bs.totalLiabilities != null || bs.totalEquity != null);
        const hasInc = inc && (inc.revenue != null || inc.operatingIncome != null || inc.netIncome != null);
        const hasAny = hasBs || hasInc;
        return (
          <section id="section-financial-kis" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Table2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            재무 요약 (KIS)
          </h2>
            {!hasAny && (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed bg-muted/20 p-3">
                KIS 재무 데이터를 가져올 수 없습니다. (일부 종목은 미제공)
              </p>
            )}
            {hasAny && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hasBs && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">대차대조표</h3>
                  <div className="space-y-1 text-sm">
                    {bs.totalAssets != null && <p><span className="text-muted-foreground">자산총계</span> {formatFundamentalNum(bs.totalAssets)}</p>}
                    {bs.totalLiabilities != null && <p><span className="text-muted-foreground">부채총계</span> {formatFundamentalNum(bs.totalLiabilities)}</p>}
                    {bs.totalEquity != null && <p><span className="text-muted-foreground">자본총계</span> {formatFundamentalNum(bs.totalEquity)}</p>}
                    {bs.currentAssets != null && <p><span className="text-muted-foreground">유동자산</span> {formatFundamentalNum(bs.currentAssets)}</p>}
                    {bs.currentLiabilities != null && <p><span className="text-muted-foreground">유동부채</span> {formatFundamentalNum(bs.currentLiabilities)}</p>}
                  </div>
                </div>
              )}
              {hasInc && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">손익계산서</h3>
                  <div className="space-y-1 text-sm">
                    {inc.revenue != null && <p><span className="text-muted-foreground">매출액</span> {formatFundamentalNum(inc.revenue)}</p>}
                    {inc.operatingIncome != null && <p><span className="text-muted-foreground">영업이익</span> {formatFundamentalNum(inc.operatingIncome)}</p>}
                    {inc.netIncome != null && <p><span className="text-muted-foreground">당기순이익</span> {formatFundamentalNum(inc.netIncome)}</p>}
                  </div>
                </div>
              )}
            </div>
            )}
          </section>
        );
      })()}

      {/* 비율 (KIS) — 재무/수익성/안정성/성장성/기타 (가치투자용) */}
      {(() => {
        const kis = fundamentalData.kis;
        const fr = renderRatioCard("재무비율", kis?.financialRatio ?? null);
        const pr = renderRatioCard("수익성비율", kis?.profitRatio ?? null);
        const sr = renderRatioCard("안정성비율", kis?.stabilityRatio ?? null);
        const gr = renderRatioCard("성장성비율", kis?.growthRatio ?? null);
        const or = renderRatioCard("기타주요비율", kis?.otherMajorRatios ?? null);
        const hasAny = !!(fr || pr || sr || gr || or);
        return (
          <section id="section-ratio-kis" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <LayoutList className="w-4 h-4 shrink-0 text-muted-foreground" />
            비율 (KIS)
          </h2>
            {!hasAny && (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed bg-muted/20 p-3">
                KIS 비율 데이터를 가져올 수 없습니다. (일부 종목은 미제공)
              </p>
            )}
            {hasAny && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {fr}
              {pr}
              {sr}
              {gr}
              {or}
            </div>
            )}
          </section>
        );
      })()}

      {/* 추정실적 (KIS) — Forward EPS 등 (가치투자용) */}
      {fundamentalData.kis && (
        <section id="section-estimate-kis" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Table2 className="w-4 h-4 shrink-0 text-muted-foreground" />
          추정실적 (KIS)
        </h2>
          {(!fundamentalData.kis.estimatePerform || Object.keys(fundamentalData.kis.estimatePerform).length === 0) ? (
            <p className="text-sm text-muted-foreground rounded-md border border-dashed bg-muted/20 p-3">
              KIS 추정실적 데이터를 가져올 수 없습니다. (일부 종목은 미제공)
            </p>
          ) : (() => {
            const ep = fundamentalData.kis!.estimatePerform as Record<string, unknown>;
            const numEntries = Object.entries(ep).filter(([, v]) => typeof v === "number" || (typeof v === "string" && v));
            if (numEntries.length === 0) return (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed bg-muted/20 p-3">
                추정실적 항목이 없습니다.
              </p>
            );
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {numEntries.slice(0, 12).map(([key, val]) => (
                  <div key={key}>
                    <p className="text-muted-foreground">{RATIO_LABELS[key] ?? key}</p>
                    <p className="font-medium">{formatRatioVal(val)}</p>
                  </div>
                ))}
              </div>
            );
          })()}
        </section>
      )}

      {/* 매매동향 (KIS) — 투자자매매동향·일별 체결량 (가치투자 참고) */}
      {(() => {
        const kis = fundamentalData.kis;
        const daily = kis?.investorTradeDaily ?? [];
        const vol = kis?.dailyTradeVolume ?? [];
        const hasDaily = Array.isArray(daily) && daily.length > 0;
        const hasVol = Array.isArray(vol) && vol.length > 0;
        const hasAny = hasDaily || hasVol;
        const dailyKeys = hasDaily && daily[0] && typeof daily[0] === "object"
          ? Object.keys(daily[0] as Record<string, unknown>).filter((k) => !/^_|id$/i.test(k))
          : [];
        const volKeys = hasVol && vol[0] && typeof vol[0] === "object"
          ? Object.keys(vol[0] as Record<string, unknown>).filter((k) => !/^_|id$/i.test(k))
          : [];
        return (
          <section id="section-trade-kis" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            매매동향 (KIS)
          </h2>
            {!hasAny && (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed bg-muted/20 p-3">
                KIS 매매동향 데이터를 가져올 수 없습니다. (일부 종목·기간은 미제공)
              </p>
            )}
            {hasAny && (
            <div className="space-y-4">
              {hasDaily && dailyKeys.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">투자자 매매동향 (일별)</h3>
                  <div className="overflow-x-auto rounded-lg border border-border/60">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          {dailyKeys.map((key) => (
                            <th key={key} className="p-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                              {tradingColumnLabel(key, INVESTOR_TRADE_DAILY_LABELS)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {daily.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-b border-border/60 last:border-b-0 hover:bg-muted/20">
                            {dailyKeys.map((key) => {
                              const val = (row as Record<string, unknown>)[key];
                              const isNum = typeof val === "number";
                              const numVal = isNum ? (val as number) : null;
                              return (
                                <td
                                  key={key}
                                  className={`p-3 ${numVal != null && numVal < 0 ? "text-loss" : numVal != null && numVal > 0 ? "text-profit" : ""}`}
                                >
                                  {formatTradingVal(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {hasVol && volKeys.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">일별 매수·매도 체결량</h3>
                  <div className="overflow-x-auto rounded-lg border border-border/60">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          {volKeys.map((key) => (
                            <th key={key} className="p-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
                              {tradingColumnLabel(key, DAILY_TRADE_VOLUME_LABELS)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {vol.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-b border-border/60 last:border-b-0 hover:bg-muted/20">
                            {volKeys.map((key) => {
                              const val = (row as Record<string, unknown>)[key];
                              return (
                                <td key={key} className="p-3">
                                  {formatTradingVal(val)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            )}
          </section>
        );
      })()}

      {/* 투자 참고: 투자의견 (KIS) */}
      <section id="section-opinion" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
        투자의견
      </h2>
        <p className="text-xs text-muted-foreground mb-4">
          투자 권유가 아닌 참고용 정보입니다.
        </p>
        {fundamentalData.isPending && !fundamentalData.kis ? (
          <p className="text-sm text-muted-foreground">로딩 중…</p>
        ) : fundamentalData.error ? (
          <p className="text-sm text-muted-foreground">투자의견을 불러올 수 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {!fundamentalData.kis?.opinion?.tickerOpinion &&
              (!fundamentalData.kis?.opinion?.brokerOpinions || fundamentalData.kis.opinion.brokerOpinions.length === 0) && (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed bg-muted/20 p-3">
                이 종목은 KIS 투자의견 데이터가 제공되지 않을 수 있습니다. (일부 종목은 증권사 DB 미제공)
              </p>
            )}
            {fundamentalData.kis?.opinion?.tickerOpinion && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                <h3 className="text-sm font-medium mb-2">종목 투자의견</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {fundamentalData.kis.opinion.tickerOpinion.opinionName && (
                    <div>
                      <p className="text-muted-foreground">의견</p>
                      <p>{fundamentalData.kis.opinion.tickerOpinion.opinionName}</p>
                    </div>
                  )}
                  {fundamentalData.kis.opinion.tickerOpinion.targetPrice != null && fundamentalData.kis.opinion.tickerOpinion.targetPrice > 0 && (
                    <div>
                      <p className="text-muted-foreground">목표가</p>
                      <p>{fundamentalData.kis.opinion.tickerOpinion.targetPrice.toLocaleString()}원</p>
                    </div>
                  )}
                  {fundamentalData.kis.opinion.tickerOpinion.outlook && (
                    <div>
                      <p className="text-muted-foreground">전망</p>
                      <p>{fundamentalData.kis.opinion.tickerOpinion.outlook}</p>
                    </div>
                  )}
                  {fundamentalData.kis.opinion.tickerOpinion.date && (
                    <div>
                      <p className="text-muted-foreground">제시일</p>
                      <p>{fundamentalData.kis.opinion.tickerOpinion.date}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium mb-2">증권사별 투자의견</h3>
              {fundamentalData.kis?.opinion?.brokerOpinions && fundamentalData.kis.opinion.brokerOpinions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground">증권사</th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground">의견</th>
                        <th className="p-3 text-right text-xs font-medium text-muted-foreground">목표가</th>
                        <th className="p-3 text-left text-xs font-medium text-muted-foreground">제시일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fundamentalData.kis.opinion.brokerOpinions.map((row, i) => (
                        <tr key={i} className="border-b border-border/60">
                          <td className="p-3">{row.brokerName ?? "—"}</td>
                          <td className="p-3">{row.opinion ?? "—"}</td>
                          <td className="p-3 text-right">
                            {row.targetPrice != null && row.targetPrice > 0
                              ? `${row.targetPrice.toLocaleString()}원`
                              : "—"}
                          </td>
                          <td className="p-3">{row.date ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">증권사별 투자의견이 없습니다.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 차트: DART 매출·영업이익·당기순이익 (최근 5개년) */}
      {(fundamentalData.dart?.multiYear?.length ?? 0) > 0 && (() => {
        const multiYear = fundamentalData.dart!.multiYear!;
        const chartData = multiYear.map((y) => ({
          year: y.year,
          매출액: y.incomeStatement?.revenue ?? 0,
          영업이익: y.incomeStatement?.operatingIncome ?? 0,
          당기순이익: y.incomeStatement?.netIncome ?? 0,
        }));
        if (chartData.every((r) => !r.매출액 && !r.영업이익 && !r.당기순이익)) return null;
        return (
          <section id="section-dart-income" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4" key="fundamental-chart">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            매출·영업이익·당기순이익 (DART 최근 5개년)
          </h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis tickFormatter={formatFundamentalNum} className="text-xs" />
                  <Tooltip formatter={(v: number | undefined) => formatFundamentalNum(v ?? 0)} />
                  <Legend />
                  <Bar dataKey="매출액" fill="hsl(var(--chart-1))" name="매출액" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="영업이익" fill="hsl(var(--chart-2))" name="영업이익" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="당기순이익" fill="hsl(var(--chart-3))" name="당기순이익" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        );
      })()}

      {/* 현금흐름 (DART 5개년) */}
      {(fundamentalData.dart?.multiYear?.length ?? 0) > 0 && (() => {
        const cfRows = fundamentalData.dart!.multiYear!.map((y) => ({
          year: y.year,
          영업: y.cashFlow?.operating ?? 0,
          투자: y.cashFlow?.investing ?? 0,
          재무: y.cashFlow?.financing ?? 0,
        }));
        if (cfRows.every((r) => !r.영업 && !r.투자 && !r.재무)) return null;
        return (
          <section id="section-cashflow" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4" key="cashflow">
            <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Table2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            현금흐름 (영업·투자·재무, DART 5개년)
          </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">연도</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">영업활동</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">투자활동</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">재무활동</th>
                  </tr>
                </thead>
                <tbody>
                  {cfRows.map((row) => (
                    <tr key={row.year} className="border-b border-border/60">
                      <td className="p-3">{row.year}</td>
                      <td className={`p-3 text-right ${(row.영업 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatFundamentalNum(row.영업 ?? 0)}
                      </td>
                      <td className={`p-3 text-right ${(row.투자 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatFundamentalNum(row.투자 ?? 0)}
                      </td>
                      <td className={`p-3 text-right ${(row.재무 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatFundamentalNum(row.재무 ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      {/* 하단: DART 잠정실적 링크 + 공시 요약 (사업보고서 기반) */}
      <section id="section-disclosure" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
        공시
      </h2>
        {fundamentalData.dart?.preliminaryLink && (
          <div className="mb-4">
            <a
              href={fundamentalData.dart.preliminaryLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-md border bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
            >
              최근 잠정실적 공시 보기 (DART) ↗
            </a>
          </div>
        )}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setOpenDoc(openDoc === "business" ? null : "business")}
            className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
          >
            <span>사업의 내용</span>
            <span className="text-muted-foreground">{openDoc === "business" ? "▲" : "▼"}</span>
          </button>
          {openDoc === "business" && (
            <div className="rounded-b-lg border border-t-0 bg-muted/20 p-4 text-sm text-muted-foreground">
              {fundamentalData.dart?.document?.businessOverview ?? "공시 요약 데이터가 없습니다. (해당 종목의 사업보고서가 DART에 없거나 아직 등재되지 않았을 수 있습니다.)"}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpenDoc(openDoc === "mda" ? null : "mda")}
            className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
          >
            <span>이사의 경영진단 (MD&A)</span>
            <span className="text-muted-foreground">{openDoc === "mda" ? "▲" : "▼"}</span>
          </button>
          {openDoc === "mda" && (
            <div className="rounded-b-lg border border-t-0 bg-muted/20 p-4 text-sm text-muted-foreground">
              {fundamentalData.dart?.document?.mda ?? "공시 요약 데이터가 없습니다. (해당 종목의 사업보고서가 DART에 없거나 아직 등재되지 않았을 수 있습니다.)"}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpenDoc(openDoc === "notes" ? null : "notes")}
            className="flex w-full items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-left text-sm font-medium hover:bg-muted/50"
          >
            <span>주석</span>
            <span className="text-muted-foreground">{openDoc === "notes" ? "▲" : "▼"}</span>
          </button>
          {openDoc === "notes" && (
            <div className="rounded-b-lg border border-t-0 bg-muted/20 p-4 text-sm text-muted-foreground">
              {fundamentalData.dart?.document?.notes ?? "공시 요약 데이터가 없습니다. (해당 종목의 사업보고서가 DART에 없거나 아직 등재되지 않았을 수 있습니다.)"}
            </div>
          )}
        </div>
      </section>

      {/* 내 포트폴리오 (해당 종목) */}
      <section id="section-portfolio" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
        <Wallet className="w-4 h-4 shrink-0 text-muted-foreground" />
        내 포트폴리오
      </h2>
        {analysisRow || position ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {analysisRow && (
              <>
                <div>
                  <p className="text-muted-foreground">매수 횟수</p>
                  <p>{analysisRow.buyCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">매도 횟수</p>
                  <p>{analysisRow.sellCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">총 매수금액</p>
                  <p>{analysisRow.totalBuyAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">총 매도금액</p>
                  <p>{analysisRow.totalSellAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">실현손익</p>
                  <p className={analysisRow.realizedPnL >= 0 ? "text-profit" : "text-loss"}>
                    {Math.round(analysisRow.realizedPnL).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">실현수익률</p>
                  <p className={analysisRow.realizedRate >= 0 ? "text-profit" : "text-loss"}>
                    {analysisRow.realizedRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">승률</p>
                  <p>{analysisRow.winRate.toFixed(1)}%</p>
                </div>
              </>
            )}
            {position && (
              <>
                <div>
                  <p className="text-muted-foreground">보유 수량</p>
                  <p>{position.quantity.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">평균 단가</p>
                  <p>
                    {position.quantity > 0
                      ? (position.buyAmount / position.quantity).toFixed(0)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">평가금액</p>
                  <p>{position.marketValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">평가손익</p>
                  <p className={position.profitLoss >= 0 ? "text-profit" : "text-loss"}>
                    {position.profitLoss.toLocaleString()}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">이 종목의 매매 이력이 없습니다.</p>
        )}
      </section>

      {/* 보조지표 — RSI, MACD (KIS 일봉 기반) */}
      <section id="section-indicators" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4 shrink-0 text-muted-foreground" />
        보조지표
      </h2>
        <p className="text-xs text-muted-foreground mb-4">
          KIS 일봉 데이터 기반 RSI(14), MACD(12,26,9) — 참고용이며 투자 권유가 아닙니다.
        </p>
        {indicatorsQuery.isPending && !indicatorsQuery.data ? (
          <p className="text-sm text-muted-foreground">로딩 중…</p>
        ) : indicatorsQuery.error ? (
          <p className="text-sm text-muted-foreground">보조지표를 불러올 수 없습니다.</p>
        ) : indicatorsQuery.data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {indicatorsQuery.data.date && (
              <div>
                <p className="text-muted-foreground">기준일</p>
                <p>{indicatorsQuery.data.date}</p>
              </div>
            )}
            {indicatorsQuery.data.rsi != null ? (
              <div>
                <p className="text-muted-foreground">RSI(14)</p>
                <p>
                  {indicatorsQuery.data.rsi.toFixed(1)}
                  {indicatorsQuery.data.rsi >= 70 && (
                    <span className="ml-1 text-xs text-muted-foreground">(과매수)</span>
                  )}
                  {indicatorsQuery.data.rsi <= 30 && (
                    <span className="ml-1 text-xs text-muted-foreground">(과매도)</span>
                  )}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground">RSI(14)</p>
                <p>—</p>
              </div>
            )}
            {indicatorsQuery.data.macd ? (
              <>
                <div>
                  <p className="text-muted-foreground">MACD</p>
                  <p>{indicatorsQuery.data.macd.macd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">시그널</p>
                  <p>{indicatorsQuery.data.macd.signal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">히스토그램</p>
                  <p>{indicatorsQuery.data.macd.histogram.toFixed(2)}</p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-muted-foreground">MACD</p>
                <p>—</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">KIS 연동 후 일봉 데이터로 계산됩니다.</p>
        )}
      </section>

      {/* 블록 3 — 매매 가이드 (참고용 뱃지) */}
      <section id="section-reference" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
        <Info className="w-4 h-4 shrink-0 text-muted-foreground" />
        참고 지표
      </h2>
        <div className="flex flex-wrap gap-2">
          {priceInfo && info?.weekly52High != null && info.weekly52Low != null && (
            <>
              {priceInfo.stckPrpr >= info.weekly52High * 0.98 && (
                <span className="rounded-full bg-muted px-3 py-1 text-xs">52주 고가 근접</span>
              )}
              {priceInfo.stckPrpr <= info.weekly52Low * 1.02 && (
                <span className="rounded-full bg-muted px-3 py-1 text-xs">52주 저가 근접</span>
              )}
              {info.weekly52High > 0 && (
                <span className="rounded-full bg-muted px-3 py-1 text-xs">
                  52주 대비 {(priceInfo.stckPrpr / info.weekly52High).toFixed(0)}% 구간
                </span>
              )}
            </>
          )}
          {hasPosition && position && position.buyAmount > 0 && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs">
              보유 수익률 {((position.profitLoss / position.buyAmount) * 100).toFixed(1)}%
            </span>
          )}
          {!priceInfo && !info?.weekly52High && !hasPosition && (
            <span className="text-sm text-muted-foreground">참고 지표가 없습니다.</span>
          )}
        </div>
      </section>

      {/* 하단 — 최근 매매 일지 */}
      <section id="section-journal" className="rounded-xl border border-border/60 bg-card p-6 scroll-mt-4">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
        <Calendar className="w-4 h-4 shrink-0 text-muted-foreground" />
        최근 매매 일지
      </h2>
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">일자</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">구분</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">수량</th>
                  <th className="p-3 text-right text-xs font-medium text-muted-foreground">단가</th>
                </tr>
              </thead>
              <tbody>
                {[...transactions]
                  .sort((a, b) => String(b.Date ?? "").localeCompare(String(a.Date ?? "")))
                  .map((row, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="p-3">{row.Date}</td>
                      <td className="p-3">{row.Type}</td>
                      <td className="p-3 text-right">{row.Quantity.toLocaleString()}</td>
                      <td className="p-3 text-right">{row.Price.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">매매 내역이 없습니다.</p>
        )}
      </section>
    </div>
  );
}

/** 상세정보 메모이제이션: tickerOrCode 동일 시 리렌더 최소화. 재무·시세 갱신 시에만 전체 재요청 */
export const TickerDetailContent = memo(TickerDetailContentInner);
