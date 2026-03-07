import { NextResponse } from "next/server";
import { getTickerMaster } from "@/lib/google-sheets";

/**
 * 종목코드 마스터 시트 조회 (GOOGLE_SHEET_TICKER_MASTER). 미설정 시 [].
 */
export async function GET() {
  try {
    const rows = await getTickerMaster();
    return NextResponse.json({ rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch ticker master" },
      { status: 503 }
    );
  }
}
