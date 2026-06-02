import { getTransactions, appendTransaction } from "@/lib/google-sheets";
import { ok, badRequest, serverError } from "@/lib/api-response";
import type { NextResponse } from "next/server";
import type { SheetTransactionRow } from "@/types/sheet";

export async function GET(): Promise<NextResponse> {
  try {
    const transactions = await getTransactions();
    return ok({ transactions });
  } catch (e) {
    return serverError("Failed to fetch transactions", e);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();

    // 입력 검증
    const date = String(body.Date ?? "").trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest("Date must be in YYYY-MM-DD format");
    }
    const ticker = String(body.Ticker ?? "").trim();
    if (!ticker) return badRequest("Ticker is required");
    const type = body.Type;
    if (type !== "매수" && type !== "매도" && type !== "배당") {
      return badRequest("Type must be 매수, 매도, or 배당");
    }
    const quantity = Number(body.Quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return badRequest("Quantity must be a positive number");
    }
    const price = Number(body.Price);
    if (!Number.isFinite(price) || price <= 0) {
      return badRequest("Price must be a positive number");
    }

    const row: SheetTransactionRow = {
      Date: date,
      Ticker: ticker,
      Type: type,
      Quantity: quantity,
      Price: price,
      Fee: Number(body.Fee) || 0,
      Tax: Number(body.Tax) || 0,
      Journal: String(body.Journal ?? ""),
      Tags: String(body.Tags ?? ""),
    };

    const appended = await appendTransaction(row);
    if (!appended) return serverError("Append not configured");
    return ok({ success: true });
  } catch (e) {
    return badRequest("Invalid request body");
  }
}
