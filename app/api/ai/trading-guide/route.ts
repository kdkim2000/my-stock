import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getPriceInfo, getKisFinancialRatio, getInvestmentOpinion, getDailyChart } from "@/lib/kis-api";
import { getDartTrendOnly } from "@/lib/dart-fundamental";
import { getTechnicalIndicators } from "@/lib/indicators";
import { getTransactions } from "@/lib/google-sheets";
import {
  computePortfolioSummaryFromTransactions,
  enrichPortfolioSummaryWithKis,
} from "@/lib/portfolio-summary";
import { getTickerCodeMap } from "@/lib/ticker-mapping";
import type { FundamentalYearData } from "@/lib/dart-fundamental";

const OPENAI_MODEL = "gpt-4o-mini";

function toYyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function formatNum(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? "—" : n.toLocaleString("ko-KR");
}

/** DART multiYear에서 매출·영업이익·당기순이익 요약 텍스트 생성 */
function dartMultiYearSummary(multiYear: FundamentalYearData[]): string {
  if (!multiYear.length) return "DART 재무 추이: 없음";
  const lines: string[] = [];
  for (const y of multiYear) {
    const is_ = y.incomeStatement as { revenue?: number; operatingIncome?: number; netIncome?: number };
    const rev = is_.revenue ?? 0;
    const op = is_.operatingIncome ?? 0;
    const net = is_.netIncome ?? 0;
    lines.push(
      `${y.year}: 매출 ${formatNum(rev)} / 영업이익 ${formatNum(op)} / 당기순이익 ${formatNum(net)}`
    );
  }
  return "DART 재무 추이 (최근 연도):\n" + lines.join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: { code?: string; ticker?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const code = String(body.code ?? "").trim().padStart(6, "0");
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { error: "code required (6-digit stock code)" },
      { status: 400 }
    );
  }

  const displayTicker = body.ticker?.trim() || code;

  try {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 90);
    const chartStart = toYyyymmdd(start);
    const chartEnd = toYyyymmdd(end);

    const [priceInfo, opinion, financialRatio, dartTrend, chartData, transactions] = await Promise.all([
      getPriceInfo(code),
      getInvestmentOpinion(code),
      getKisFinancialRatio(code),
      getDartTrendOnly(code),
      getDailyChart(code, chartStart, chartEnd),
      getTransactions(),
    ]);

    const ratio = financialRatio ?? {};
    const per = ratio.per ?? ratio.stck_per ?? ratio.prdy_per;
    const pbr = ratio.pbr ?? ratio.stck_pbr ?? ratio.prdy_pbr;
    const eps = ratio.eps ?? ratio.stck_eps ?? ratio.prdy_eps;
    const bps = ratio.bps ?? ratio.stck_bps ?? ratio.prdy_bps;
    const roe = ratio.roe ?? ratio.stck_roe;
    const roa = ratio.roa ?? ratio.stck_roa;
    const debtRt = ratio.debt_rt ?? ratio.debtRatio;

    let indicatorsText = "보조지표: 없음";
    if (chartData && chartData.length > 0) {
      const closes = chartData.map((d) => d.close);
      const lastDate = chartData[chartData.length - 1]?.date ?? "";
      const ind = getTechnicalIndicators(closes, lastDate);
      const rsiStr = ind.rsi != null ? ind.rsi.toFixed(1) : "—";
      const macdStr =
        ind.macd != null
          ? `MACD ${ind.macd.macd.toFixed(2)} / Signal ${ind.macd.signal.toFixed(2)} / Histogram ${ind.macd.histogram.toFixed(2)}`
          : "—";
      indicatorsText = `RSI(14): ${rsiStr}, ${macdStr} (기준일 ${lastDate})`;
    }

    const summary = computePortfolioSummaryFromTransactions(transactions);
    const enriched = await enrichPortfolioSummaryWithKis(summary);
    const codeMap = await getTickerCodeMap();
    const codeToTicker: Record<string, string> = {};
    for (const [ticker, c] of Object.entries(codeMap)) {
      const norm = c.trim().padStart(6, "0");
      if (/^\d{6}$/.test(norm)) codeToTicker[norm] = ticker;
    }
    const tickerForCode = codeToTicker[code];
    const position = enriched.positions?.find((p) => p.ticker === tickerForCode);

    const dartText = dartTrend?.multiYear?.length
      ? dartMultiYearSummary(dartTrend.multiYear)
      : "DART 재무 추이: 없음";

    const priceLine = priceInfo
      ? `현재가 ${priceInfo.stckPrpr.toLocaleString()}원, 전일대비 ${priceInfo.prdyVrss >= 0 ? "+" : ""}${priceInfo.prdyVrss} (${priceInfo.prdyCtrt}%)`
      : "시세 없음";

    const opinionLine = opinion.tickerOpinion
      ? `투자의견: ${opinion.tickerOpinion.opinionName ?? ""} / 목표가 ${formatNum(opinion.tickerOpinion.targetPrice)} / 전망: ${opinion.tickerOpinion.outlook ?? "—"}`
      : "투자의견: 없음";

    const ratioLine = [
      per != null ? `PER ${formatNum(per)}` : null,
      pbr != null ? `PBR ${formatNum(pbr)}` : null,
      eps != null ? `EPS ${formatNum(eps)}` : null,
      bps != null ? `BPS ${formatNum(bps)}` : null,
      roe != null ? `ROE ${formatNum(roe)}%` : null,
      roa != null ? `ROA ${formatNum(roa)}%` : null,
      debtRt != null ? `부채비율 ${formatNum(debtRt)}%` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const portfolioLine = position
      ? `보유 수량 ${position.quantity.toLocaleString()}주, 평균 단가 ${(position.buyAmount / position.quantity).toFixed(0)}원, 평가금액 ${position.marketValue.toLocaleString()}원, 평가손익 ${position.profitLoss >= 0 ? "+" : ""}${position.profitLoss.toLocaleString()}원 (수익률 ${position.buyAmount > 0 ? ((position.profitLoss / position.buyAmount) * 100).toFixed(1) : "—"}%)`
      : "해당 종목 보유 없음";

    const userPayload = [
      `[종목] ${displayTicker} (코드 ${code})`,
      `[시세] ${priceLine}`,
      `[가치지표] ${ratioLine || "없음"}`,
      `[투자의견] ${opinionLine}`,
      `[재무 추이] ${dartText}`,
      `[보조지표] ${indicatorsText}`,
      `[내 포트폴리오 - 해당 종목] ${portfolioLine}`,
    ].join("\n");

    const systemPrompt = `당신은 한국 주식 참고용 분석 어시스턴트입니다. 사용자가 제공한 데이터만을 바탕으로 투자전략 요약과 매매 가이드(참고)를 작성합니다. 매수/매도 권유 문구는 사용하지 않고, 참고용 정보만 제공합니다. 응답은 반드시 마크다운 형식으로 작성하고, 다음 섹션을 포함하세요: "## 투자전략 요약", "## 매매 가이드(참고)", "## 리스크 요인". 각 섹션은 2~4문장 정도로 간결하게 작성합니다.`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPayload },
      ],
      max_tokens: 1500,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "OpenAI returned empty content" },
        { status: 502 }
      );
    }

    return NextResponse.json({ content });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[AI trading-guide] error:", e);
    if (e instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API: ${e.message}` },
        { status: e.status ?? 502 }
      );
    }
    return NextResponse.json(
      { error: `Failed to generate guide: ${message}` },
      { status: 503 }
    );
  }
}
