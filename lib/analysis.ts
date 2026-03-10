import type { SheetTransactionRow } from "@/types/sheet";
import type {
  AnalysisSummaryResponse,
  TickerAnalysisRow,
  TagSummaryRow,
  CumulativePnlPoint,
} from "@/types/api";
import { sortTransactionsByDate } from "./sort-transactions";
import { PositionTracker } from "./position-tracker";

/**
 * Tags/Journal 문자열에서 #태그 형태 추출 (중복 제거)
 */
function parseTags(text: string): string[] {
  if (!text?.trim()) return [];
  const tokens = (text + "").split(/[\s,#]+/).filter(Boolean);
  const tags = tokens
    .filter((t) => t.startsWith("#"))
    .map((t) => t.replace(/^#+/, "").trim())
    .filter(Boolean);
  return [...new Set(tags)];
}

/**
 * 실현손익(거래일 기준 가중평균)·승률(매도 건 단위)·종목별 집계 계산.
 * - 거래일 순 처리. 같은 날은 원본 행 순서로 2차 정렬.
 * - 수량이 0이 되면 해당 구간 실현손익 확정 후, 다음 매수부터 새 매수단가 적용.
 * - 매도 시: 당시 보유분의 매수 평균가로 매도 원가 계산.
 * - 추가 매수 시: (남은 수량×기존 평균가 + 추가 매수금액) / 총 수량으로 가중평균.
 */
export function computeAnalysis(
  transactions: SheetTransactionRow[]
): AnalysisSummaryResponse {
  const sorted = sortTransactionsByDate(transactions);
  const byTicker: Record<
    string,
    {
      buyCount: number;
      totalBuyAmount: number;
      totalSellAmount: number;
      realizedPnL: number;
      totalSellCost: number;
      sellCount: number;
      winCount: number;
    }
  > = {};
  const byTag: Record<string, { realizedPnL: number; sellCount: number; winCount: number }> = {};

  const tracker = new PositionTracker();

  for (const row of sorted) {
    const t = row.Ticker?.trim() || "";
    if (!t) continue;
    if (!byTicker[t])
      byTicker[t] = {
        buyCount: 0,
        totalBuyAmount: 0,
        totalSellAmount: 0,
        realizedPnL: 0,
        totalSellCost: 0,
        sellCount: 0,
        winCount: 0,
      };

    const res = tracker.process(row);
    if (!res) continue;

    const q = row.Quantity || 0;
    const price = row.Price || 0;

    if (row.Type === "매수") {
      byTicker[t].buyCount += 1;
      byTicker[t].totalBuyAmount += price * q;
    } else {
      const p = byTicker[t];
      const realized = res.realizedPnL ?? 0;
      p.realizedPnL += realized;
      p.totalSellCost += res.costOfSold;
      p.totalSellAmount += price * q;
      p.sellCount += 1;
      if (realized >= 0) p.winCount += 1;
      const tags = parseTags((row.Tags ?? "") + " " + (row.Journal ?? ""));
      for (const tag of tags) {
        if (!byTag[tag]) byTag[tag] = { realizedPnL: 0, sellCount: 0, winCount: 0 };
        byTag[tag].realizedPnL += realized;
        byTag[tag].sellCount += 1;
        if (realized >= 0) byTag[tag].winCount += 1;
      }
    }
  }

  let totalRealizedPnL = 0;
  let totalSellCount = 0;
  let totalWinCount = 0;
  const tickers: TickerAnalysisRow[] = [];

  for (const [ticker, p] of Object.entries(byTicker)) {
    totalRealizedPnL += p.realizedPnL;
    totalSellCount += p.sellCount;
    totalWinCount += p.winCount;
    const realizedRate =
      p.totalSellCost > 0 ? (p.realizedPnL / p.totalSellCost) * 100 : 0;
    const winRate =
      p.sellCount > 0 ? (p.winCount / p.sellCount) * 100 : 0;
    tickers.push({
      ticker,
      buyCount: p.buyCount,
      sellCount: p.sellCount,
      totalBuyAmount: p.totalBuyAmount,
      totalSellAmount: p.totalSellAmount,
      realizedPnL: p.realizedPnL,
      realizedRate,
      winCount: p.winCount,
      winRate,
    });
  }

  const winRate =
    totalSellCount > 0 ? (totalWinCount / totalSellCount) * 100 : 0;

  const tagSummaries: TagSummaryRow[] = Object.entries(byTag).map(
    ([tag, v]) => ({
      tag,
      realizedPnL: v.realizedPnL,
      sellCount: v.sellCount,
      winCount: v.winCount,
      winRate: v.sellCount > 0 ? (v.winCount / v.sellCount) * 100 : 0,
    })
  );

  return {
    totalRealizedPnL,
    totalWinCount,
    totalSellCount,
    winRate,
    tickers,
    tagSummaries,
  };
}

/** 기간(일) 계산: 6m ≈ 180, 1y = 365 */
function periodToDays(period: "6m" | "1y"): number {
  return period === "6m" ? 180 : 365;
}

/**
 * 일자별 실현손익 누적 시계열 생성 (전체 기간 계산 후 최근 period 일만 반환)
 */
export function computeCumulativePnl(
  transactions: SheetTransactionRow[],
  period: "6m" | "1y"
): CumulativePnlPoint[] {
  const sorted = sortTransactionsByDate(transactions);
  const days = periodToDays(period);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const tracker = new PositionTracker();
  const dailyRealized: Record<string, number> = {};

  for (const row of sorted) {
    const res = tracker.process(row);
    if (!res) continue;

    if (row.Type !== "매수" && res.realizedPnL !== null) {
      const dateKey = row.Date;
      dailyRealized[dateKey] = (dailyRealized[dateKey] ?? 0) + res.realizedPnL;
    }
  }

  const dates = Object.keys(dailyRealized).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );
  let cumulative = 0;
  const allPoints: CumulativePnlPoint[] = dates.map((date) => {
    cumulative += dailyRealized[date] ?? 0;
    return { date, cumulativeRealized: cumulative };
  });
  return allPoints.filter((p) => new Date(p.date) >= cutoff);
}
