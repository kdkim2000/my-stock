import { NextResponse } from "next/server";
import { getDailyChart } from "@/lib/kis-api";
import { getTechnicalIndicators } from "@/lib/indicators";
import type { TechnicalIndicatorsResponse } from "@/types/api";
import { readTickerCache, writeTickerCache } from "@/lib/ticker-cache";

/** 일봉 조회 기간 (MACD 26+9 등 고려, 최대 100건) */
function getIndicatorDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 90);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/**
 * GET /api/kis/indicators?code=066570
 * KIS 일봉 조회 후 RSI(14), MACD(12,26,9) 계산하여 반환.
 */
export async function GET(request: Request): Promise<NextResponse<TechnicalIndicatorsResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  const revalidate = searchParams.get("revalidate") === "1";
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "code required (6-digit stock code)" },
      { status: 400 }
    );
  }

  // ★ Google Sheets 캐시 확인
  if (!revalidate) {
    const cached = await readTickerCache<TechnicalIndicatorsResponse>(code, "indicators");
    if (cached) {
      return NextResponse.json(cached.data, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
          "X-Ticker-Cache": "HIT",
        },
      });
    }
  }

  try {
    const { start, end } = getIndicatorDateRange();
    const chart = await getDailyChart(code, start, end);
    if (!chart || chart.length === 0) {
      return NextResponse.json(
        { date: "", rsi: null, macd: null },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" } }
      );
    }

    const closes = chart.map((d) => d.close);
    const lastDate = chart[chart.length - 1]?.date ?? "";
    const result = getTechnicalIndicators(closes, lastDate);

    // ★ 비동기로 캐시 저장
    writeTickerCache(code, "indicators", result).catch(() => {});

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
        "X-Ticker-Cache": "MISS",
      },
    });
  } catch (e) {
    console.error("[KIS] indicators error:", e);
    return NextResponse.json(
      { error: "Failed to fetch indicators" },
      { status: 503 }
    );
  }
}
