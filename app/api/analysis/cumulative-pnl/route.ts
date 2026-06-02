import type { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/google-sheets";
import { computeCumulativePnl } from "@/lib/analysis";
import { ok, badRequest, serverError } from "@/lib/api-response";
import type { CumulativePnlPoint } from "@/types/api";

export const dynamic = "force-dynamic";

type Period = "6m" | "1y";

export async function GET(
  req: NextRequest
): Promise<NextResponse<CumulativePnlPoint[] | { error: string }>> {
  try {
    const period = (req.nextUrl.searchParams.get("period") ?? "6m") as Period;
    if (period !== "6m" && period !== "1y") {
      return badRequest("period must be 6m or 1y");
    }
    const transactions = await getTransactions();
    const points = computeCumulativePnl(transactions, period);
    return ok(points);
  } catch (e) {
    return serverError("Failed to compute cumulative PnL", e);
  }
}
