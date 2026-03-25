import { NextResponse } from "next/server";
import { getPriceInfo } from "@/lib/kis-api";
import { getTickerCodeMap, codeToTicker } from "@/lib/ticker-mapping";
import type { TickerDetailInfo } from "@/types/api";

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
 *
 * ★ 성능 개선: 현재가(getPriceInfo)만 조회합니다.
 *   - 52주 일봉(getDailyChart): 슬롯 1개 × ~1s 제거 → 상세 페이지에서 불필요
 *   - getKisStockFundamentals: 슬롯 1~2개 제거 → /api/fundamental 에서 조회
 *   이를 통해 stock-info 응답 시간을 ~2.5s → ~0.5s 으로 단축하여
 *   code 확정 후 fundamental 호출 시작까지의 waterfall 지연을 최소화합니다.
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
    // 현재가만 조회 — fundamental/52주 일봉은 별도 엔드포인트(/api/fundamental)에서 처리
    const priceInfo = await getPriceInfo(code);

    const body: TickerDetailInfo = {
      code,
      ticker,
      priceInfo: priceInfo ?? null,
      // 52주 고/저: fundamental의 dailyPrice로 클라이언트에서 계산 가능. 여기선 생략.
      weekly52High: null,
      weekly52Low: null,
      per: undefined,
      pbr: undefined,
      eps: undefined,
      bps: undefined,
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    });
  } catch (e) {
    console.error("[KIS] stock-info error:", e);
    return NextResponse.json({ error: "Failed to fetch stock info" }, { status: 503 });
  }
}
