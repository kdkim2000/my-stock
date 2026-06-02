import { getTickerMaster } from "@/lib/google-sheets";
import { ok, serverError } from "@/lib/api-response";
import type { NextResponse } from "next/server";

/**
 * 종목코드 마스터 시트 조회 (GOOGLE_SHEET_TICKER_MASTER). 미설정 시 [].
 */
export async function GET(): Promise<NextResponse> {
  try {
    const rows = await getTickerMaster();
    return ok({ rows });
  } catch (e) {
    return serverError("Failed to fetch ticker master", e);
  }
}
