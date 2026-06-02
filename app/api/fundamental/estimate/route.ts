import { NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/api-response";
import { getKisEstimatePerform } from "@/lib/kis-api";
import { readTickerCache, writeTickerCache } from "@/lib/ticker-cache";

export interface EstimateApiResponse {
  code: string;
  estimatePerform: Record<string, unknown> | null;
}

const CACHE_SEC = 300;
const SWR_SEC = 600;

/**
 * GET /api/fundamental/estimate?code=066570
 * KIS 추정실적 (HHKST668300C0).
 * /api/fundamental 에서 분리하여 독립적으로 로딩합니다.
 */
export async function GET(
  request: Request
): Promise<NextResponse<EstimateApiResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  const revalidate = searchParams.get("revalidate") === "1";
  if (!code || !/^\d{6}$/.test(code) || code === "000000") {
    return badRequest("code required (6-digit stock code, 000000 invalid)");
  }

  // ★ Google Sheets 캐시 확인
  if (!revalidate) {
    const cached = await readTickerCache<EstimateApiResponse>(code, "estimate");
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
    const estimatePerform = await getKisEstimatePerform(code);
    const body: EstimateApiResponse = { code, estimatePerform };

    // ★ 비동기로 캐시 저장
    writeTickerCache(code, "estimate", body).catch(() => {});

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=${SWR_SEC}`,
        "X-Ticker-Cache": "MISS",
      },
    });
  } catch (e) {
    return serverError("Failed to fetch estimate", e);
  }
}
