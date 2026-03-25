import { NextResponse } from "next/server";
import {
  getKisFinancialRatio,
  getKisProfitRatio,
  getKisStabilityRatio,
  getKisGrowthRatio,
  getKisOtherMajorRatios,
} from "@/lib/kis-api";

export interface RatiosApiResponse {
  code: string;
  financialRatio: Record<string, unknown> | null;
  profitRatio: Record<string, unknown> | null;
  stabilityRatio: Record<string, unknown> | null;
  growthRatio: Record<string, unknown> | null;
  otherMajorRatios: Record<string, unknown> | null;
}

const CACHE_SEC = 300;
const SWR_SEC = 600;

/**
 * GET /api/fundamental/ratios?code=066570
 * KIS 재무비율 전체 — 수익성·안정성·성장성·기타.
 * /api/fundamental 에서 분리하여 독립적으로 로딩함으로써 점진적 표시를 지원합니다.
 */
export async function GET(
  request: Request
): Promise<NextResponse<RatiosApiResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  if (!code || !/^\d{6}$/.test(code) || code === "000000") {
    return NextResponse.json(
      { error: "code required (6-digit stock code, 000000 invalid)" },
      { status: 400 }
    );
  }

  try {
    const [financialRatio, profitRatio, stabilityRatio, growthRatio, otherMajorRatios] =
      await Promise.all([
        getKisFinancialRatio(code),
        getKisProfitRatio(code),
        getKisStabilityRatio(code),
        getKisGrowthRatio(code),
        getKisOtherMajorRatios(code),
      ]);

    return NextResponse.json(
      { code, financialRatio, profitRatio, stabilityRatio, growthRatio, otherMajorRatios },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=${SWR_SEC}`,
        },
      }
    );
  } catch (e) {
    console.error("[fundamental/ratios] error:", e);
    return NextResponse.json({ error: "Failed to fetch ratios" }, { status: 503 });
  }
}
