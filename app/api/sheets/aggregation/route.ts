import { getTickerAggregation } from "@/lib/google-sheets";
import { ok, serverError } from "@/lib/api-response";
import type { NextResponse } from "next/server";

/**
 * 종목별 집계 시트 조회 (GOOGLE_SHEET_AGGREGATION). 미설정 시 [].
 */
export async function GET(): Promise<NextResponse> {
  try {
    const rows = await getTickerAggregation();
    return ok({ rows });
  } catch (e) {
    return serverError("Failed to fetch ticker aggregation", e);
  }
}
