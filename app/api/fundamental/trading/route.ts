import { NextResponse } from "next/server";
import { getKisInvestorTradeDaily, getKisDailyTradeVolume } from "@/lib/kis-api";
import type { KisTradingTrendRow } from "@/types/api";

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
  if (!code || !/^\d{6}$/.test(code) || code === "000000") {
    return NextResponse.json(
      { error: "code required (6-digit stock code, 000000 invalid)" },
      { status: 400 }
    );
  }

  try {
    const [investorTradeDaily, dailyTradeVolume] = await Promise.all([
      getKisInvestorTradeDaily(code),
      getKisDailyTradeVolume(code),
    ]);

    return NextResponse.json(
      {
        code,
        investorTradeDaily: Array.isArray(investorTradeDaily)
          ? (investorTradeDaily as KisTradingTrendRow[])
          : [],
        dailyTradeVolume: Array.isArray(dailyTradeVolume)
          ? (dailyTradeVolume as KisTradingTrendRow[])
          : [],
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=${SWR_SEC}`,
        },
      }
    );
  } catch (e) {
    console.error("[fundamental/trading] error:", e);
    return NextResponse.json({ error: "Failed to fetch trading data" }, { status: 503 });
  }
}
