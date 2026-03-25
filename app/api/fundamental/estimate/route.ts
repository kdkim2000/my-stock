import { NextResponse } from "next/server";
import { getKisEstimatePerform } from "@/lib/kis-api";

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
  if (!code || !/^\d{6}$/.test(code) || code === "000000") {
    return NextResponse.json(
      { error: "code required (6-digit stock code, 000000 invalid)" },
      { status: 400 }
    );
  }

  try {
    const estimatePerform = await getKisEstimatePerform(code);
    return NextResponse.json(
      { code, estimatePerform },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SEC}, stale-while-revalidate=${SWR_SEC}`,
        },
      }
    );
  } catch (e) {
    console.error("[fundamental/estimate] error:", e);
    return NextResponse.json({ error: "Failed to fetch estimate" }, { status: 503 });
  }
}
