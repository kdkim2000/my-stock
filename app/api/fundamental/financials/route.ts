import { NextResponse } from "next/server";
import {
  getFundamentalFinancials,
  getDartDocumentSections,
  type FundamentalFinancialsResponse,
  type DartDocumentSections,
} from "@/lib/dart-fundamental";

export type FinancialsApiResponse = {
  code: string;
  financials: FundamentalFinancialsResponse | null;
  document: DartDocumentSections;
};

/**
 * GET /api/fundamental/financials?code=066570
 * DART fnlttSinglAcnt로 B/S, I/S, C/F 최근 5개년. document.xml 뼈대(사업의 내용, MD&A, 주석).
 */
export async function GET(
  request: Request
): Promise<NextResponse<FinancialsApiResponse | { error: string }>> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "code required (6-digit stock code)" },
      { status: 400 }
    );
  }

  try {
    const financials = await getFundamentalFinancials(code);
    const document = financials?.corpCode
      ? await getDartDocumentSections(financials.corpCode)
      : {};

    const body: FinancialsApiResponse = {
      code,
      financials,
      document,
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
    });
  } catch (e) {
    console.error("[fundamental/financials] error:", e);
    return NextResponse.json(
      { error: "Failed to fetch financials" },
      { status: 503 }
    );
  }
}
