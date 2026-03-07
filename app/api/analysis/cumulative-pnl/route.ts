import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/google-sheets";
import { computeCumulativePnl } from "@/lib/analysis";
import type { CumulativePnlPoint } from "@/types/api";

export const dynamic = "force-dynamic";

type Period = "6m" | "1y";

export async function GET(
  req: NextRequest
): Promise<NextResponse<CumulativePnlPoint[] | { error: string }>> {
  try {
    const period = (req.nextUrl.searchParams.get("period") ?? "6m") as Period;
    if (period !== "6m" && period !== "1y") {
      return NextResponse.json(
        { error: "period must be 6m or 1y" },
        { status: 400 }
      );
    }
    const transactions = await getTransactions();
    const points = computeCumulativePnl(transactions, period);
    return NextResponse.json(points);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to compute cumulative PnL" },
      { status: 503 }
    );
  }
}
