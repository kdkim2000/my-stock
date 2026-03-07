import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getFinancialsByStockCode, computeRatios, getCorpCodeByStockCode, getFnlttSinglAcnt } from "@/lib/dart-api";
import { getKisStockFundamentals } from "@/lib/kis-api";

const emptyRatios = {
  profitability: { roe: 0, roa: 0, operatingMargin: 0, netProfitMargin: 0 },
  stability: { debtRatio: 0, currentRatio: 0 },
  growth: { revenueGrowth: 0, netIncomeGrowth: 0 },
  other: { per: 0, pbr: 0 },
};

function hasUsefulFinancials(data: { balanceSheet: Record<string, unknown>; incomeStatement: Record<string, unknown>; ratios: { other: { per: number; pbr: number } } }) {
  return (
    Object.keys(data.balanceSheet).length > 0 ||
    Object.keys(data.incomeStatement).length > 0 ||
    data.ratios.other.per > 0 ||
    data.ratios.other.pbr > 0
  );
}

async function fetchFinancialsUncached(
  code: string,
  currentPrice?: number,
  perFromQuery?: number,
  pbrFromQuery?: number
) {
  const kis = await getKisStockFundamentals(code, currentPrice);
  if (kis && (Object.keys(kis.balanceSheet).length > 0 || Object.keys(kis.incomeStatement).length > 0 || kis.ratios.per > 0 || kis.ratios.pbr > 0)) {
    const bs = kis.balanceSheet as Record<string, number>;
    const is_ = kis.incomeStatement as Record<string, number>;
    const ratios = computeRatios(bs, is_, currentPrice);
    ratios.other.per = kis.ratios.per;
    ratios.other.pbr = kis.ratios.pbr;
    if (process.env.NODE_ENV === "development") {
      console.log("[financials] code=%s source=kis bsKeys=%d isKeys=%d", code, Object.keys(bs).length, Object.keys(is_).length);
    }
    return {
      balanceSheet: bs,
      incomeStatement: is_,
      ratios,
      bsnsYear: "",
      _source: "kis" as const,
    };
  }

  const dart = await getFinancialsByStockCode(code, currentPrice);
  if (dart && hasUsefulFinancials(dart)) {
    if (process.env.NODE_ENV === "development") {
      console.log("[financials] code=%s source=dart bsKeys=%d isKeys=%d", code, Object.keys(dart.balanceSheet).length, Object.keys(dart.incomeStatement).length);
    }
    if (dart.ratios.other.per <= 0 || dart.ratios.other.pbr <= 0) {
      if (perFromQuery != null && perFromQuery > 0) dart.ratios.other.per = perFromQuery;
      if (pbrFromQuery != null && pbrFromQuery > 0) dart.ratios.other.pbr = pbrFromQuery;
      if ((dart.ratios.other.per <= 0 || dart.ratios.other.pbr <= 0) && currentPrice != null && currentPrice > 0) {
        const kisPerPbr = await getKisStockFundamentals(code, currentPrice);
        if (process.env.NODE_ENV === "development") {
          console.log("[financials] PER/PBR merge code=%s kis=%s per=%s pbr=%s", code, kisPerPbr ? "ok" : "null", kisPerPbr?.ratios.per ?? "-", kisPerPbr?.ratios.pbr ?? "-");
        }
        if (kisPerPbr && (kisPerPbr.ratios.per > 0 || kisPerPbr.ratios.pbr > 0)) {
          if (kisPerPbr.ratios.per > 0) dart.ratios.other.per = kisPerPbr.ratios.per;
          if (kisPerPbr.ratios.pbr > 0) dart.ratios.other.pbr = kisPerPbr.ratios.pbr;
        }
      }
    }
    return dart;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[financials] code=%s no data kis=%s dart=%s", code, kis ? "ok" : "null", dart ? "ok(no useful)" : "null");
  }
  return kis ?? dart ?? null;
}

/**
 * GET /api/dart/financials?code=005930&revalidate=1
 * 대차대조표·손익계산서·재무비율. KIS 우선 조회, 실패 시 DART 사용. revalidate=1 이면 캐시 스킵.
 */
export async function GET(request: Request): Promise<NextResponse<unknown>> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  const revalidate = searchParams.get("revalidate") === "1";
  const debug = searchParams.get("debug") === "1" && process.env.NODE_ENV === "development";
  const currentPriceParam = searchParams.get("currentPrice");
  const currentPrice = currentPriceParam ? Number(currentPriceParam) : undefined;
  const queryPer = searchParams.get("per");
  const queryPbr = searchParams.get("pbr");
  const perFromQuery = queryPer != null && queryPer !== "" ? Number(queryPer) : undefined;
  const pbrFromQuery = queryPbr != null && queryPbr !== "" ? Number(queryPbr) : undefined;

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "code required (6-digit stock code)" },
      { status: 400 }
    );
  }

  try {
    const fetcher = revalidate
      ? () => fetchFinancialsUncached(code, currentPrice, perFromQuery, pbrFromQuery)
      : unstable_cache(
          () => fetchFinancialsUncached(code, currentPrice, perFromQuery, pbrFromQuery),
          ["dart-financials", code, String(perFromQuery ?? ""), String(pbrFromQuery ?? "")],
          { revalidate: 3600 }
        );
    const data = await fetcher();
    if (!data) {
      const emptyFinancials: Record<string, unknown> = {
        balanceSheet: {},
        incomeStatement: {},
        ratios: emptyRatios,
        bsnsYear: "",
        _noData: true as const,
      };
      if (debug) {
        const dartKey = !!process.env.DART_API_KEY?.trim();
        const kisKey = !!(process.env.KIS_APP_KEY && process.env.KIS_APP_SECRET);
        const steps: Record<string, unknown> = { code, step: "no_data", env: { DART_API_KEY_set: dartKey, KIS_credentials_set: kisKey } };
        try {
          const kis = await getKisStockFundamentals(code, currentPrice);
          steps.kis = kis == null
            ? "null"
            : { bsKeys: Object.keys(kis.balanceSheet).length, isKeys: Object.keys(kis.incomeStatement).length, per: kis.ratios.per, pbr: kis.ratios.pbr };
        } catch (e) {
          steps.kis = "error: " + (e instanceof Error ? e.message : String(e));
        }
        try {
          const dartCorp = await getCorpCodeByStockCode(code);
          steps.dart_corpCode = dartCorp ?? "null";
          if (dartCorp) {
            const y = new Date().getFullYear();
            const list = await getFnlttSinglAcnt(dartCorp, String(y), "11011");
            const prevList = list.length === 0 ? await getFnlttSinglAcnt(dartCorp, String(y - 1), "11011") : [];
            steps.dart_listLen = list.length || prevList.length;
            steps.dart_listSample = (list.length ? list : prevList).slice(0, 5).map((i) => i.account_nm);
          }
        } catch (e) {
          steps.dart_error = e instanceof Error ? e.message : String(e);
        }
        emptyFinancials._debug = steps;
      }
      return NextResponse.json(emptyFinancials, {
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
      });
    }
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    console.error("[DART] financials error:", e);
    return NextResponse.json(
      { error: "Failed to fetch financials" },
      { status: 503 }
    );
  }
}
