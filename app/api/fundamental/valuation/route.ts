import { NextResponse } from "next/server";
import { getPriceInfo, getKisStockFundamentals } from "@/lib/kis-api";

export interface ValuationResponse {
  code: string;
  per: number | null;
  pbr: number | null;
  eps: number | null;
  roe: number | null;
  evEbitda: number | null;
  currentPrice: number | null;
  bsnsYear: string;
}

/**
 * GET /api/fundamental/valuation?code=066570
 * KIS 전용. PER, PBR, EPS만 반환. ROE/EV EBITDA는 DART 축소에 따라 미제공(null).
 * 상세페이지는 /api/fundamental 사용 권장.
 */
export async function GET(
  request: Request
): Promise<NextResponse<ValuationResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "code required (6-digit stock code)" },
      { status: 400 }
    );
  }

  try {
    const priceInfo = await getPriceInfo(code);
    const currentPrice = priceInfo?.stckPrpr ?? null;
    const fundamentals = await getKisStockFundamentals(code, currentPrice ?? undefined);

    let per: number | null = fundamentals?.ratios.per ?? null;
    let pbr: number | null = fundamentals?.ratios.pbr ?? null;
    let eps: number | null = fundamentals?.ratios.eps ?? null;

    if ((per == null || per <= 0) && fundamentals?.ratios.eps != null && fundamentals.ratios.eps > 0 && currentPrice) {
      per = currentPrice / fundamentals.ratios.eps;
    }
    if ((pbr == null || pbr <= 0) && fundamentals?.ratios.bps != null && fundamentals.ratios.bps > 0 && currentPrice) {
      pbr = currentPrice / fundamentals.ratios.bps;
    }

    return NextResponse.json(
      {
        code,
        per: per ?? null,
        pbr: pbr ?? null,
        eps: eps ?? null,
        roe: null,
        evEbitda: null,
        currentPrice,
        bsnsYear: "",
      },
      {
        headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" },
      }
    );
  } catch (e) {
    console.error("[fundamental/valuation] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch valuation" },
      { status: 503 }
    );
  }
}
