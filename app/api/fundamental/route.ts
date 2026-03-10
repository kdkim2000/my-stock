import { NextResponse } from "next/server";
import {
  getPriceInfo,
  getKisStockFundamentals,
  getKisBalanceSheet,
  getKisIncomeStatement,
  getKisFinancialRatio,
  getKisProfitRatio,
  getKisStabilityRatio,
  getKisGrowthRatio,
  getKisOtherMajorRatios,
  getKisEstimatePerform,
  getKisInvestorTradeDaily,
  getKisDailyTradeVolume,
  getKisDailyPrice,
} from "@/lib/kis-api";
import {
  getDartTrendOnly,
  getDartPreliminaryAndDocument,
  type FundamentalYearData,
  type DartDocumentSections,
} from "@/lib/dart-fundamental";
import type {
  KisPriceInfo,
  KisInvestmentOpinion,
  KisBalanceSheetData,
  KisIncomeStatementData,
  KisRatioData,
  KisEstimatePerformData,
  KisTradingTrendRow,
} from "@/types/api";

import { parseNum } from "@/lib/utils";

export interface FundamentalApiKis {
  priceInfo: KisPriceInfo | null;
  per: number | null;
  pbr: number | null;
  eps: number | null;
  bps: number | null;
  forwardEps?: number | null;
  opinion: KisInvestmentOpinion;
  balanceSheet: KisBalanceSheetData | null;
  incomeStatement: KisIncomeStatementData | null;
  financialRatio: KisRatioData | null;
  profitRatio: KisRatioData | null;
  stabilityRatio: KisRatioData | null;
  growthRatio: KisRatioData | null;
  otherMajorRatios: KisRatioData | null;
  estimatePerform: KisEstimatePerformData | null;
  investorTradeDaily: KisTradingTrendRow[];
  dailyTradeVolume: KisTradingTrendRow[];
  /** 주식현재가 일자별 (최근 30거래일). stck_bsop_date, stck_oprc, stck_clpr, stck_hgpr, stck_lwpr */
  dailyPrice: Record<string, unknown>[];
}

export interface FundamentalApiDart {
  multiYear: FundamentalYearData[];
  preliminaryLink: string | null;
  document: DartDocumentSections;
}

export interface FundamentalApiResponse {
  code: string;
  kis: FundamentalApiKis;
  dart: FundamentalApiDart;
}

const CACHE_SEC = 300;
const SWR_SEC = 600;

/**
 * GET /api/fundamental?code=066570&revalidate=1
 * KIS(현재가·종목정보·재무·비율·추정실적·매매동향·일봉 등)와 DART(5개년 트렌드·잠정실적 링크·공시 문서)를 먼저 조회한 뒤,
 * 투자의견은 응답 지연이 크므로 마지막에 단독 조회합니다.
 */
export async function GET(
  request: Request
): Promise<NextResponse<FundamentalApiResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  if (!code || !/^\d{6}$/.test(code) || code === "000000") {
    return NextResponse.json(
      { error: "code required (6-digit stock code, 000000 invalid)" },
      { status: 400 }
    );
  }

  try {
    // 1단계: 가격·DART 트렌드 먼저 (투자의견 제외 — 지연이 크므로 후순위로 조회)
    const [priceInfo, dartTrend] = await Promise.all([
      getPriceInfo(code),
      getDartTrendOnly(code),
    ]);

    // 재무비율 1회 호출로 per/pbr/eps/bps + financialRatio 채움. 중복 호출 제거(EGW00201 완화).
    const financialRatio = await getKisFinancialRatio(code);
    let fundamentals: Awaited<ReturnType<typeof getKisStockFundamentals>> = null;
    if (!financialRatio || (parseNum(financialRatio.per ?? financialRatio.stck_per) <= 0 && parseNum(financialRatio.pbr ?? financialRatio.stck_pbr) <= 0)) {
      fundamentals = await getKisStockFundamentals(code, priceInfo?.stckPrpr);
    }

    // KIS 투자자매매동향·일별체결량은 lib/kis-api에서 최근 30일(일력) 기준, 주식현재가 일자별은 30거래일 수신 후 오늘-30~오늘 필터
    const [
      dartRest,
      balanceSheet,
      incomeStatement,
      profitRatio,
      stabilityRatio,
      growthRatio,
      otherMajorRatios,
      estimatePerform,
      investorTradeDaily,
      dailyTradeVolume,
      dailyPrice,
    ] = await Promise.all([
      dartTrend?.corpCode
        ? getDartPreliminaryAndDocument(dartTrend.corpCode)
        : Promise.resolve({ preliminaryLink: null as string | null, document: {} as DartDocumentSections }),
      getKisBalanceSheet(code),
      getKisIncomeStatement(code),
      getKisProfitRatio(code),
      getKisStabilityRatio(code),
      getKisGrowthRatio(code),
      getKisOtherMajorRatios(code),
      getKisEstimatePerform(code),
      getKisInvestorTradeDaily(code),
      getKisDailyTradeVolume(code),
      getKisDailyPrice(code),
    ]);

    // 투자의견은 클라이언트에서 /api/kis/opinion 으로 별도 조회 (응답 지연이 커서 본 API에서는 제외)
    const fromRatio = financialRatio
      ? {
          per: parseNum(financialRatio.per ?? financialRatio.prdy_per ?? financialRatio.stck_per),
          pbr: parseNum(financialRatio.pbr ?? financialRatio.prdy_pbr ?? financialRatio.stck_pbr),
          eps: parseNum(financialRatio.eps ?? financialRatio.prdy_eps ?? financialRatio.stck_eps),
          bps: parseNum(financialRatio.bps ?? financialRatio.prdy_bps ?? financialRatio.stck_bps),
        }
      : { per: 0, pbr: 0, eps: 0, bps: 0 };
    const fromSearchInfo = fundamentals?.ratios;
    let per: number | null = (fromRatio.per > 0 ? fromRatio.per : fromSearchInfo?.per) ?? null;
    let pbr: number | null = (fromRatio.pbr > 0 ? fromRatio.pbr : fromSearchInfo?.pbr) ?? null;
    let eps: number | null = (fromRatio.eps !== 0 ? fromRatio.eps : fromSearchInfo?.eps) ?? null;
    let bps: number | null = (fromRatio.bps !== 0 ? fromRatio.bps : fromSearchInfo?.bps) ?? null;
    if (per != null && per <= 0) per = null;
    if (pbr != null && pbr <= 0) pbr = null;
    if (eps != null && eps <= 0) eps = null;
    if (bps != null && bps <= 0) bps = null;

    const forwardEps = estimatePerform
      ? (typeof estimatePerform.eps === "number"
          ? estimatePerform.eps
          : typeof estimatePerform.fwd_eps === "number"
            ? estimatePerform.fwd_eps
            : typeof estimatePerform.forward_eps === "number"
              ? estimatePerform.forward_eps
              : undefined) ?? undefined
      : undefined;

    const body: FundamentalApiResponse = {
      code,
      kis: {
        priceInfo: priceInfo ?? null,
        per,
        pbr,
        eps,
        bps,
        forwardEps: forwardEps ?? undefined,
        opinion: { tickerOpinion: null, brokerOpinions: [] },
        balanceSheet: balanceSheet ?? null,
        incomeStatement: incomeStatement ?? null,
        financialRatio: financialRatio ?? null,
        profitRatio: profitRatio ?? null,
        stabilityRatio: stabilityRatio ?? null,
        growthRatio: growthRatio ?? null,
        otherMajorRatios: otherMajorRatios ?? null,
        estimatePerform: estimatePerform ?? null,
        investorTradeDaily: Array.isArray(investorTradeDaily) ? (investorTradeDaily as KisTradingTrendRow[]) : [],
        dailyTradeVolume: Array.isArray(dailyTradeVolume) ? (dailyTradeVolume as KisTradingTrendRow[]) : [],
        dailyPrice: Array.isArray(dailyPrice) ? (dailyPrice as Record<string, unknown>[]) : [],
      },
      dart: {
        multiYear: dartTrend?.multiYear ?? [],
        preliminaryLink: dartRest.preliminaryLink,
        document: dartRest.document,
      },
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=${SWR_SEC}`,
      },
    });
  } catch (e) {
    console.error("[fundamental] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch fundamental data" },
      { status: 503 }
    );
  }
}
