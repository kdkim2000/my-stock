import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getInvestmentOpinion } from "@/lib/kis-api";
import type { KisInvestmentOpinion } from "@/types/api";

const OPINION_CACHE_SEC = 600; // 10분 — 실시간이 아니므로 메모이제이션

/**
 * GET /api/kis/opinion?code=005930&revalidate=1
 * KIS invest-opinion API (종목/증권사별 투자의견). unstable_cache로 필요 시에만 KIS 호출. revalidate=1이면 캐시 스킵.
 */
export async function GET(request: Request): Promise<NextResponse<KisInvestmentOpinion | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const code = String(searchParams.get("code") ?? "").trim();
  const revalidate = searchParams.get("revalidate") === "1";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "code required (6-digit stock code)" }, { status: 400 });
  }

  try {
    const fetcher = revalidate
      ? () => getInvestmentOpinion(code)
      : unstable_cache(
          () => getInvestmentOpinion(code),
          ["kis-opinion-v2", code],
          { revalidate: OPINION_CACHE_SEC }
        );
    const body = await fetcher();
    return NextResponse.json(body, {
      headers: {
        "Cache-Control": `public, s-maxage=${OPINION_CACHE_SEC}, stale-while-revalidate=300`,
      },
    });
  } catch (e) {
    console.error("[KIS] opinion error:", e);
    return NextResponse.json({ error: "Failed to fetch investment opinion" }, { status: 503 });
  }
}
