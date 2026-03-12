import { NextResponse } from "next/server";
import OpenAI from "openai";
import { readAiCache, writeAiCache } from "@/lib/ai-cache";
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

/** 최근 매매 일지 텍스트 생성 (AI 프롬프트용) */
function formatJournalForPrompt(
  entries: Array<{ Date: string; Type: string; Quantity: number; Price: number; Journal?: string }>
): string {
  if (!entries.length) return "최근 매매 일지: 없음";
  const lines = entries
    .slice(0, 30)
    .map(
      (r) =>
        `${r.Date} | ${r.Type} | 수량 ${Number(r.Quantity).toLocaleString()} | 단가 ${Number(r.Price).toLocaleString()}원${r.Journal ? ` | ${r.Journal}` : ""}`
    );
  return "최근 매매 일지 (최신순):\n" + lines.join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: {
    code?: string;
    ticker?: string;
    force?: boolean; // true: OpenAI 재호출 ("다시 분석"), false/없음: 캐시 우선
    cacheOnly?: boolean; // true: 캐시가 없으면 OpenAI를 호출하지 않고 null 반환
    context?: {
      detailSummary?: string;
      journalEntries?: Array<{ Date: string; Type: string; Quantity: number; Price: number; Journal?: string }>;
    };
  };
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
  const forceRefresh = body.force === true;
  const useClientContext = Boolean(body.context?.detailSummary?.trim());

  try {
    // 캐시 우선: force가 아니면 Google Sheets에서 기존 결과 반환
    if (!forceRefresh) {
      const cached = await readAiCache(code);
      if (cached && cached.content) {
        return NextResponse.json({
          content: cached.content,
          cachedAt: cached.updatedAt,
        });
      }
      // 캐시가 없는데 cacheOnly 모드인 경우 OpenAI 호출 없이 즉시 반환
      if (body.cacheOnly === true) {
        return NextResponse.json({
          content: null,
          cachedAt: null,
        });
      }
    }
    let userPayload: string;
    let journalText: string;

    if (useClientContext) {
      // 상세 페이지에서 보낸 상세 정보 사용. 매매 일지는 클라이언트 전달분 우선.
      const base = body.context!.detailSummary!.trim();
      const clientJournal = body.context?.journalEntries;
      journalText =
        Array.isArray(clientJournal) && clientJournal.length > 0
          ? formatJournalForPrompt(
            clientJournal
              .map((e) => ({
                Date: String(e.Date ?? ""),
                Type: String(e.Type ?? ""),
                Quantity: Number(e.Quantity) || 0,
                Price: Number(e.Price) || 0,
                Journal: e.Journal != null ? String(e.Journal) : undefined,
              }))
              .sort((a, b) => String(b.Date).localeCompare(String(a.Date)))
              .slice(0, 30)
          )
          : "최근 매매 일지: 없음";
      userPayload = [base, `[최근 매매 일지]\n${journalText}`].join("\n\n");
    } else {
      // 서버에서 KIS/DART 등 직접 조회 (기존 동작)
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

      const txForTicker = transactions.filter(
        (r) => (r.Ticker || "").trim() === tickerForCode || (r.Ticker || "").trim() === code
      );
      const sortedTx = [...txForTicker].sort((a, b) => String(b.Date ?? "").localeCompare(String(a.Date ?? "")));
      journalText = formatJournalForPrompt(
        sortedTx.slice(0, 30).map((r) => ({
          Date: String(r.Date ?? ""),
          Type: r.Type ?? "",
          Quantity: Number(r.Quantity) || 0,
          Price: Number(r.Price) || 0,
          Journal: r.Journal != null ? String(r.Journal) : undefined,
        }))
      );

      userPayload = [
        `[종목] ${displayTicker} (코드 ${code})`,
        `[시세] ${priceLine}`,
        `[가치지표] ${ratioLine || "없음"}`,
        `[투자의견] ${opinionLine}`,
        `[재무 추이] ${dartText}`,
        `[보조지표] ${indicatorsText}`,
        `[내 포트폴리오 - 해당 종목] ${portfolioLine}`,
        `[최근 매매 일지]\n${journalText}`,
      ].join("\n");
    }

    const systemPrompt = `당신은 한국 주식 시장에 특화된, 객관적이고 전문적인 금융 분석 어시스턴트입니다. 
반드시 사용자가 제공한 '투자 지표 및 데이터'와 '최근 매매 일지'(제공된 경우)만을 바탕으로 분석해야 하며, 외부 정보를 임의로 추측하거나 조합하지 마십시오. 데이터가 불충분할 경우 해당 사실을 명시하세요.
최근 매매 일지가 있으면, 매수/매도 시점·수량·단가·메모를 참고해 사용자의 매매 패턴이나 보유 구간을 고려한 맥락을 분석에 반영할 수 있습니다.
어떠한 경우에도 직접적인 매수/매도 권유나 목표가 제시는 금지되며, 오직 의사결정을 돕기 위한 객관적인 참고 정보만 제공해야 합니다.
응답은 반드시 마크다운 형식을 사용하여 아래의 구조로 작성하되, 각 섹션은 2~4문장 내외로 간결하고 명확하게 작성하세요.
## 투자전략 요약
(제공된 데이터를 바탕으로 현재 종목의 전반적인 추세와 핵심 모멘텀을 요약합니다.)
## 매매 가이드(참고)
(지표에 나타난 지지/저항선, 수급 동향, 그리고 최근 매매 일지에 나타난 보유/매매 맥락을 바탕으로 트레이딩 관점에서의 객관적인 시나리오를 제시합니다.)
## 리스크 요인
(제공된 데이터 내에서 확인되는 하락 우려점, 변동성 확대 요인 등을 객관적으로 짚어줍니다.)
---
**⚠️ 주의사항:** 본 분석은 제공된 데이터에 기반한 기계적 요약이며, 실제 투자 결과에 대한 법적 책임을 지지 않습니다. 투자의 최종 판단은 본인에게 있습니다.`;

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

    // Google Sheets에 분석결과 캐싱 (비동기, 실패 무시)
    writeAiCache(code, displayTicker, content).catch(() => { });

    return NextResponse.json({ content, cachedAt: new Date().toISOString() });
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
