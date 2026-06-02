import { getTransactions } from "@/lib/google-sheets";
import { computeAnalysis } from "@/lib/analysis";
import { ok, serverError } from "@/lib/api-response";
import type { NextResponse } from "next/server";
import type { AnalysisSummaryResponse } from "@/types/api";

/** 매매 내역 기반 실현손익·승률·종목별 집계 반환 */
export async function GET(): Promise<NextResponse<AnalysisSummaryResponse | { error: string }>> {
  try {
    const transactions = await getTransactions();
    const summary = computeAnalysis(transactions);
    return ok(summary);
  } catch (e) {
    return serverError("Failed to compute analysis summary", e);
  }
}
