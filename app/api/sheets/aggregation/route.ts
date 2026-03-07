import { NextResponse } from "next/server";
import { getTickerAggregation } from "@/lib/google-sheets";

/**
 * 종목별 집계 시트 조회 (GOOGLE_SHEET_AGGREGATION). 미설정 시 [].
 */
export async function GET() {
  try {
    const rows = await getTickerAggregation();
    return NextResponse.json({ rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch ticker aggregation" },
      { status: 503 }
    );
  }
}
