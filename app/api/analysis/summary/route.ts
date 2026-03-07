import { NextResponse } from "next/server";
import { getTransactions } from "@/lib/google-sheets";
import { computeAnalysis } from "@/lib/analysis";
import type { AnalysisSummaryResponse } from "@/types/api";

/**
 * 매매 내역 기반 실현손익·승률·종목별 집계 반환
 */
export async function GET(): Promise<
  NextResponse<AnalysisSummaryResponse | { error: string }>
> {
  try {
    const transactions = await getTransactions();
    const summary = computeAnalysis(transactions);
    return NextResponse.json(summary);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to compute analysis summary" },
      { status: 503 }
    );
  }
}
