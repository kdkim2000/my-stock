import { NextResponse } from "next/server";
import {
  getPriceInfo,
  getKisStockFundamentals,
  getKisBalanceSheet,
  getKisIncomeStatement,
  getKisFinancialRatio,
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
import { readTickerCache, writeTickerCache } from "@/lib/ticker-cache";

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
  /** @deprecated 별도 /api/fundamental/ratios 에서 조회하세요 */
  profitRatio: KisRatioData | null;
  /** @deprecated 별도 /api/fundamental/ratios 에서 조회하세요 */
  stabilityRatio: KisRatioData | null;
  /** @deprecated 별도 /api/fundamental/ratios 에서 조회하세요 */
  growthRatio: KisRatioData | null;
  /** @deprecated 별도 /api/fundamental/ratios 에서 조회하세요 */
  otherMajorRatios: KisRatioData | null;
  /** @deprecated 별도 /api/fundamental/estimate 에서 조회하세요 */
  estimatePerform: KisEstimatePerformData | null;
  /** @deprecated 별도 /api/fundamental/trading 에서 조회하세요 */
  investorTradeDaily: KisTradingTrendRow[];
  /** @deprecated 별도 /api/fundamental/trading 에서 조회하세요 */
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
 *
 * ★ 성능 개선 (방안 2):
 *   이 엔드포인트는 핵심 데이터(시세·재무요약·DART 트렌드·일봉)만 반환합니다.
 *   아래 느린 지표는 별도 엔드포인트로 분리하여 클라이언트에서 독립적으로 로딩합니다:
 *     - 비율(수익성·안정성·성장성·기타): GET /api/fundamental/ratios
 *     - 추정실적:                        GET /api/fundamental/estimate
 *     - 매매동향:                        GET /api/fundamental/trading
 *
 * 기존 호환성을 위해 profitRatio, stabilityRatio, growthRatio, otherMajorRatios,
 * estimatePerform, investorTradeDaily, dailyTradeVolume 필드는 null/빈 배열로 유지합니다.
 */
export async function GET(
  request: Request
): Promise<NextResponse<FundamentalApiResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  const revalidate = searchParams.get("revalidate") === "1";
  if (!code || !/^\d{6}$/.test(code) || code === "000000") {
    return NextResponse.json(
      { error: "code required (6-digit stock code, 000000 invalid)" },
      { status: 400 }
    );
  }

  // ★ Google Sheets 캐시 확인 (revalidate가 아닌 경우)
  if (!revalidate) {
    const cached = await readTickerCache<FundamentalApiResponse>(code, "fundamental");
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=${SWR_SEC}`,
          "X-Ticker-Cache": "HIT",
          "X-Ticker-Cache-At": cached.updatedAt,
        },
      });
    }
  }

  try {
    // 단일 Promise.all: priceInfo·DART·재무비율·재무요약·일봉 모두 동시 조회
    // ★ 기존 3단계 순차 구조를 완전 병렬화 — 세마포어가 자동으로 동시성 제어
    const [priceInfo, dartTrend, financialRatio, balanceSheet, incomeStatement, dailyPrice] =
      await Promise.all([
        getPriceInfo(code),
        getDartTrendOnly(code),
        getKisFinancialRatio(code),
        getKisBalanceSheet(code),
        getKisIncomeStatement(code),
        getKisDailyPrice(code),
      ]);

    // financialRatio 로 PER/PBR 확인 후 필요 시 보조 조회 (조건부이므로 순차 유지)
    let fundamentals: Awaited<ReturnType<typeof getKisStockFundamentals>> = null;
    if (!financialRatio || (parseNum(financialRatio.per ?? financialRatio.stck_per) <= 0 && parseNum(financialRatio.pbr ?? financialRatio.stck_pbr) <= 0)) {
      fundamentals = await getKisStockFundamentals(code, priceInfo?.stckPrpr);
    }

    // DART 잠정실적·공시문서 (corpCode 필요하므로 dartTrend 완료 후)
    const dartRest = dartTrend?.corpCode
      ? await getDartPreliminaryAndDocument(dartTrend.corpCode)
      : { preliminaryLink: null as string | null, document: {} as DartDocumentSections };


    // 투자의견은 클라이언트에서 /api/kis/opinion 으로 별도 조회
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

    const body: FundamentalApiResponse = {
      code,
      kis: {
        priceInfo: priceInfo ?? null,
        per,
        pbr,
        eps,
        bps,
        forwardEps: undefined,
        opinion: { tickerOpinion: null, brokerOpinions: [] },
        balanceSheet: balanceSheet ?? null,
        incomeStatement: incomeStatement ?? null,
        financialRatio: financialRatio ?? null,
        // 분리된 엔드포인트로 이관 — 하위 호환성을 위해 null/빈 배열 유지
        profitRatio: null,
        stabilityRatio: null,
        growthRatio: null,
        otherMajorRatios: null,
        estimatePerform: null,
        investorTradeDaily: [],
        dailyTradeVolume: [],
        dailyPrice: Array.isArray(dailyPrice) ? (dailyPrice as Record<string, unknown>[]) : [],
      },
      dart: {
        multiYear: dartTrend?.multiYear ?? [],
        preliminaryLink: dartRest.preliminaryLink,
        document: dartRest.document,
      },
    };

    // ★ 비동기로 캐시 저장 (응답 지연 방지)
    writeTickerCache(code, "fundamental", body).catch(() => {});

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=${SWR_SEC}`,
        "X-Ticker-Cache": "MISS",
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
