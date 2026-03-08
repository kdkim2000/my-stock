import { NextResponse } from "next/server";
import { getTransactions, appendTransaction } from "@/lib/google-sheets";
import type { SheetTransactionRow } from "@/types/sheet";

export async function GET() {
  try {
    const transactions = await getTransactions();
    return NextResponse.json({ transactions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch transactions";
    console.error("[Sheets] GET transactions failed:", message, e);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: "Failed to fetch transactions", detail: isDev ? message : undefined },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const row: SheetTransactionRow = {
      Date: String(body.Date ?? ""),
      Ticker: String(body.Ticker ?? ""),
      Type: body.Type === "매도" ? "매도" : "매수",
      Quantity: Number(body.Quantity) || 0,
      Price: Number(body.Price) || 0,
      Fee: Number(body.Fee) ?? 0,
      Tax: Number(body.Tax) ?? 0,
      Journal: String(body.Journal ?? ""),
      Tags: String(body.Tags ?? ""),
    };
    const ok = await appendTransaction(row);
    if (!ok) return NextResponse.json({ error: "Append not configured" }, { status: 503 });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
