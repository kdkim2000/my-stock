import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { unauthorized, serverError } from "@/lib/api-response";
import {
  getPriceInfo,
  getKisStockFundamentals,
  getKisBalanceSheet,
  getKisIncomeStatement,
  getKisFinancialRatio,
  getKisDailyPrice,
  getKisProfitRatio,
  getKisStabilityRatio,
  getKisGrowthRatio,
  getKisOtherMajorRatios,
  getKisEstimatePerform,
  getKisInvestorTradeDaily,
  getKisDailyTradeVolume,
  getDailyChart,
  getInvestmentOpinion,
} from "@/lib/kis-api";
import {
  getDartTrendOnly,
  getDartPreliminaryAndDocument,
  type DartDocumentSections,
} from "@/lib/dart-fundamental";
import { getTechnicalIndicators } from "@/lib/indicators";
import { writeTickerCache } from "@/lib/ticker-cache";
import { parseNum } from "@/lib/utils";
import type { KisTradingTrendRow } from "@/types/api";

export const maxDuration = 60;

function get90DayRange(): { start: string; end: string } {
  const endMs = Date.now();
  const startMs = endMs - 90 * 24 * 60 * 60 * 1000;
  const fmt = (ms: number) =>
    new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
  return { start: fmt(startMs), end: fmt(endMs) };
}

/**
 * POST /api/ticker/[code]/refresh
 *
 * Vercel 갱신 최적화: 1개 서버리스 함수에서 모든 KIS/DART API를 병렬 호출하고
 * 결과를 Google Sheets 캐시에 저장. 클라이언트는 이후 개별 라우트를 refetch하면
 * 캐시 HIT로 빠르게 응답받는다.
 *
 * 효과: 콜드스타트 7→1회, KIS 세마포어 공유(35→5 동시요청), Sheets 토큰/rows 공유
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const token = await getToken({
    req: new NextRequest(request.url, { headers: request.headers }),
    secret: process.env.AUTH_SECRET,
  });
  if (!token) return unauthorized("로그인이 필요합니다.");

  const { code } = await params;
  if (!/^\d{6}$/.test(code) || code === "000000") {
    return NextResponse.json({ error: "Invalid stock code" }, { status: 400 });
  }

  try {
    // DART 체인: corpCode 확보 즉시 문서 조회 파이프라인 연결
    const dartTrendPromise = getDartTrendOnly(code);
    const dartRestPromise = dartTrendPromise.then((trend) =>
      trend?.corpCode
        ? getDartPreliminaryAndDocument(trend.corpCode)
        : Promise.resolve({
            preliminaryLink: null as string | null,
            document: {} as DartDocumentSections,
          })
    );

    const { start, end } = get90DayRange();

    // 공유 스로틀·토큰·CORPCODE 캐시로 모든 KIS/DART API 동시 호출
    const [
      priceRes, dartTrendRes, ratioRes, bsRes, isRes, dpRes, dartRestRes,
      profitRes, stabilityRes, growthRes, otherRes,
      estimateRes,
      tradeInvestorRes, tradeVolumeRes,
      chartRes,
      opinionRes,
    ] = await Promise.allSettled([
      getPriceInfo(code),
      dartTrendPromise,
      getKisFinancialRatio(code),
      getKisBalanceSheet(code),
      getKisIncomeStatement(code),
      getKisDailyPrice(code),
      dartRestPromise,
      getKisProfitRatio(code),
      getKisStabilityRatio(code),
      getKisGrowthRatio(code),
      getKisOtherMajorRatios(code),
      getKisEstimatePerform(code),
      getKisInvestorTradeDaily(code),
      getKisDailyTradeVolume(code),
      getDailyChart(code, start, end),
      getInvestmentOpinion(code),
    ]);

    const v = <T>(r: PromiseSettledResult<T>): T | null =>
      r.status === "fulfilled" ? r.value : null;

    const priceInfo        = v(priceRes);
    const dartTrend        = v(dartTrendRes);
    const financialRatio   = v(ratioRes);
    const balanceSheet     = v(bsRes);
    const incomeStatement  = v(isRes);
    const dailyPrice       = v(dpRes);
    const dartRest         = v(dartRestRes) ?? {
      preliminaryLink: null as string | null,
      document: {} as DartDocumentSections,
    };
    const profitRatio       = v(profitRes);
    const stabilityRatio    = v(stabilityRes);
    const growthRatio       = v(growthRes);
    const otherMajorRatios  = v(otherRes);
    const estimatePerform   = v(estimateRes);
    const investorTradeDaily = v(tradeInvestorRes);
    const dailyTradeVolume   = v(tradeVolumeRes);
    const chartData          = v(chartRes);
    const opinion            = v(opinionRes) ?? { tickerOpinion: null, brokerOpinions: [] };

    // PER/PBR 추출 (fundamental route와 동일 로직)
    const fr = financialRatio as Record<string, unknown> | null;
    const fromRatio = fr
      ? {
          per: parseNum(fr.per ?? fr.prdy_per ?? fr.stck_per),
          pbr: parseNum(fr.pbr ?? fr.prdy_pbr ?? fr.stck_pbr),
          eps: parseNum(fr.eps ?? fr.prdy_eps ?? fr.stck_eps),
          bps: parseNum(fr.bps ?? fr.prdy_bps ?? fr.stck_bps),
        }
      : { per: 0, pbr: 0, eps: 0, bps: 0 };

    let fundamentals: Awaited<ReturnType<typeof getKisStockFundamentals>> = null;
    if (!fr || (fromRatio.per <= 0 && fromRatio.pbr <= 0)) {
      fundamentals = await getKisStockFundamentals(code, priceInfo?.stckPrpr);
    }
    const fromSearchInfo = fundamentals?.ratios;
    let per: number | null = (fromRatio.per > 0 ? fromRatio.per : fromSearchInfo?.per) ?? null;
    let pbr: number | null = (fromRatio.pbr > 0 ? fromRatio.pbr : fromSearchInfo?.pbr) ?? null;
    let eps: number | null = (fromRatio.eps !== 0 ? fromRatio.eps : fromSearchInfo?.eps) ?? null;
    let bps: number | null = (fromRatio.bps !== 0 ? fromRatio.bps : fromSearchInfo?.bps) ?? null;
    if (per != null && per <= 0) per = null;
    if (pbr != null && pbr <= 0) pbr = null;
    if (eps != null && eps <= 0) eps = null;
    if (bps != null && bps <= 0) bps = null;

    // 기술적 지표 계산
    let indicatorsResult = null;
    if (chartData && chartData.length > 0) {
      const closes = chartData.map((d) => d.close);
      const lastDate = chartData[chartData.length - 1]?.date ?? "";
      indicatorsResult = getTechnicalIndicators(closes, lastDate);
    }

    // 각 섹션 캐시 데이터 구성
    const fundamentalBody = {
      code,
      kis: {
        priceInfo: priceInfo ?? null,
        per, pbr, eps, bps,
        forwardEps: undefined,
        opinion: { tickerOpinion: null, brokerOpinions: [] },
        balanceSheet: balanceSheet ?? null,
        incomeStatement: incomeStatement ?? null,
        financialRatio: financialRatio ?? null,
        profitRatio: null,
        stabilityRatio: null,
        growthRatio: null,
        otherMajorRatios: null,
        estimatePerform: null,
        investorTradeDaily: [],
        dailyTradeVolume: [],
        dailyPrice: Array.isArray(dailyPrice)
          ? (dailyPrice as Record<string, unknown>[])
          : [],
      },
      dart: {
        multiYear: dartTrend?.multiYear ?? [],
        preliminaryLink: dartRest.preliminaryLink,
        document: dartRest.document,
      },
    };

    const ratiosBody = {
      code,
      financialRatio: financialRatio ?? null,
      profitRatio:     profitRatio    ?? null,
      stabilityRatio:  stabilityRatio ?? null,
      growthRatio:     growthRatio    ?? null,
      otherMajorRatios: otherMajorRatios ?? null,
    };

    const estimateBody = { code, estimatePerform: estimatePerform ?? null };

    const tradingBody = {
      code,
      investorTradeDaily: (investorTradeDaily as KisTradingTrendRow[] | null) ?? [],
      dailyTradeVolume:   (dailyTradeVolume   as KisTradingTrendRow[] | null) ?? [],
    };

    // 모든 섹션 캐시 동시 저장 (응답 전 완료 보장)
    await Promise.allSettled([
      writeTickerCache(code, "fundamental", fundamentalBody),
      writeTickerCache(code, "ratios",      ratiosBody),
      writeTickerCache(code, "estimate",    estimateBody),
      writeTickerCache(code, "trading",     tradingBody),
      writeTickerCache(code, "opinion",     opinion),
      ...(indicatorsResult
        ? [writeTickerCache(code, "indicators", indicatorsResult)]
        : []),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("Failed to refresh ticker data", e);
  }
}
