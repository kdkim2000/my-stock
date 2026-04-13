import { NextResponse } from "next/server";
import { getKisInvestorTradeDaily, getKisDailyTradeVolume } from "@/lib/kis-api";
import type { KisTradingTrendRow } from "@/types/api";
import { readTickerCache, writeTickerCache } from "@/lib/ticker-cache";

export interface TradingApiResponse {
  code: string;
  investorTradeDaily: KisTradingTrendRow[];
  dailyTradeVolume: KisTradingTrendRow[];
}

const CACHE_SEC = 300;
const SWR_SEC = 600;

/**
 * GET /api/fundamental/trading?code=066570
 * KIS 매매동향 — 투자자별 순매수(FHPTJ04160001) + 일별 체결량(FHKST03010800).
 * /api/fundamental 에서 분리하여 독립적으로 로딩합니다.
 */
export async function GET(
  request: Request
): Promise<NextResponse<TradingApiResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  const revalidate = searchParams.get("revalidate") === "1";
  if (!code || !/^\d{6}$/.test(code) || code === "000000") {
    return NextResponse.json(
      { error: "code required (6-digit stock code, 000000 invalid)" },
      { status: 400 }
    );
  }

  // ★ Google Sheets 캐시 확인
  if (!revalidate) {
    const cached = await readTickerCache<TradingApiResponse>(code, "trading");
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=${SWR_SEC}`,
          "X-Ticker-Cache": "HIT",
        },
      });
    }
  }

  try {
    const [investorTradeDaily, dailyTradeVolume] = await Promise.all([
      getKisInvestorTradeDaily(code),
      getKisDailyTradeVolume(code),
    ]);

    const body: TradingApiResponse = {
      code,
      investorTradeDaily: Array.isArray(investorTradeDaily)
        ? (investorTradeDaily as KisTradingTrendRow[])
        : [],
      dailyTradeVolume: Array.isArray(dailyTradeVolume)
        ? (dailyTradeVolume as KisTradingTrendRow[])
        : [],
    };

    // ★ 비동기로 캐시 저장
    writeTickerCache(code, "trading", body).catch(() => {});

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=${SWR_SEC}`,
        "X-Ticker-Cache": "MISS",
      },
    });
  } catch (e) {
    console.error("[fundamental/trading] error:", e);
    return NextResponse.json({ error: "Failed to fetch trading data" }, { status: 503 });
  }
}
