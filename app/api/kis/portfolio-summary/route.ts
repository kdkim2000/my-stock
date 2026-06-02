import type { NextResponse } from "next/server";
import { getTransactions } from "@/lib/google-sheets";
import {
  computePortfolioSummaryFromTransactions,
  enrichPortfolioSummaryWithKis,
} from "@/lib/portfolio-summary";
import { ok, serverError } from "@/lib/api-response";
import type { PortfolioSummaryResponse } from "@/types/api";

/**
 * 시트 매매 내역으로 총 매수 금액 등을 계산하고, KIS API로 현재가를 조회해 평가 금액·손익을 반영.
 * KIS 미설정 시 평가 금액 = 총 매수 금액, 평가 손익 = 0.
 */
export async function GET(): Promise<NextResponse<PortfolioSummaryResponse | { error: string }>> {
  try {
    const transactions = await getTransactions();
    const summary = computePortfolioSummaryFromTransactions(transactions);
    const enriched = await enrichPortfolioSummaryWithKis(summary);
    return ok(enriched);
  } catch (e) {
    return serverError("Failed to fetch portfolio summary", e);
  }
}
