import { NextResponse } from "next/server";
import { getPriceInfo, getDailyChart, getKisStockFundamentals } from "@/lib/kis-api";
import { getTickerCodeMap, codeToTicker } from "@/lib/ticker-mapping";
import type { TickerDetailInfo } from "@/types/api";

/** 52주 일봉 조회 기간 (최대 100건 제한 있음) */
function get52WeekDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** 쿼리 파라미터 디코딩 (이중 인코딩 시 HTTP 계층에서 한 번 풀린 LG%EC%A0%84... → LG전자) */
function safeDecodeParam(value: string | null): string {
  if (value == null || value === "") return "";
  try {
    let decoded = decodeURIComponent(value);
    // 이중 인코딩된 경우(예: %25ED...) 한 번 더 디코딩 시도
    if (decoded.includes("%")) {
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        // ignore
      }
    }
    return decoded;
  } catch {
    return value;
  }
}

/**
 * GET /api/kis/stock-info?code=005930 또는 ?ticker=삼성전자
 * KIS 현재가·일봉 기반 52주 고/저 반환. 캐시 5분.
 */
export async function GET(request: Request): Promise<NextResponse<TickerDetailInfo | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const codeParam = safeDecodeParam(searchParams.get("code")).trim();
  const tickerParam = safeDecodeParam(searchParams.get("ticker")).trim();

  let code: string | undefined;
  let ticker = tickerParam ?? "";

  if (codeParam && /^\d{6}$/.test(codeParam)) {
    code = codeParam;
    if (!ticker) ticker = codeToTicker(codeParam) ?? codeParam;
  } else if (tickerParam) {
    const map = await getTickerCodeMap();
    const t = tickerParam.trim();
    if (/^\d{6}$/.test(t)) {
      code = t;
      ticker = t;
    } else {
      code = map[t] ?? undefined;
      if (!ticker) ticker = t;
    }
  }

  if (!code) {
    return NextResponse.json({ error: "code or ticker required (6-digit code or ticker name)" }, { status: 400 });
  }

  try {
    const [priceInfo, dailyChart] = await Promise.all([
      getPriceInfo(code),
      (async () => {
        const { start, end } = get52WeekDateRange();
        return getDailyChart(code!, start, end);
      })(),
    ]);
    const fundamentals = await getKisStockFundamentals(code!, priceInfo?.stckPrpr);
    const per = fundamentals?.ratios.per && fundamentals.ratios.per > 0 ? fundamentals.ratios.per : undefined;
    const pbr = fundamentals?.ratios.pbr && fundamentals.ratios.pbr > 0 ? fundamentals.ratios.pbr : undefined;
    const eps = fundamentals?.ratios.eps != null && fundamentals.ratios.eps !== 0 ? fundamentals.ratios.eps : undefined;
    const bps = fundamentals?.ratios.bps != null && fundamentals.ratios.bps > 0 ? fundamentals.ratios.bps : undefined;

    let weekly52High: number | null = null;
    let weekly52Low: number | null = null;
    if (dailyChart && dailyChart.length > 0) {
      weekly52High = Math.max(...dailyChart.map((d) => d.high));
      weekly52Low = Math.min(...dailyChart.map((d) => d.low));
    }

    const body: TickerDetailInfo = {
      code,
      ticker,
      priceInfo: priceInfo ?? null,
      weekly52High,
      weekly52Low,
      per: per != null && per > 0 ? per : undefined,
      pbr: pbr != null && pbr > 0 ? pbr : undefined,
      eps: eps != null && eps !== 0 ? eps : undefined,
      bps: bps != null && bps > 0 ? bps : undefined,
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    console.error("[KIS] stock-info error:", e);
    return NextResponse.json({ error: "Failed to fetch stock info" }, { status: 503 });
  }
}
