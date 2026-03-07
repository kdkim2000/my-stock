"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAnalysisSummary } from "@/hooks/useAnalysisSummary";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import type { TickerAnalysisRow } from "@/types/api";

type SortKey =
  | "ticker"
  | "marketValue"
  | "realizedPnL"
  | "realizedRate"
  | "winRate"
  | "totalBuyAmount"
  | "totalSellAmount";

const SORT_KEYS: { key: SortKey; label: string }[] = [
  { key: "ticker", label: "종목" },
  { key: "marketValue", label: "평가금액" },
  { key: "realizedPnL", label: "실현손익" },
  { key: "realizedRate", label: "실현수익률" },
  { key: "winRate", label: "승률" },
  { key: "totalBuyAmount", label: "총매수금액" },
  { key: "totalSellAmount", label: "총매도금액" },
];

/** 보유 종목만 보기 | 과거 투자 포함 전체 */
type ViewMode = "held" | "all";

export function TickerAnalysisTable() {
  const analysis = useAnalysisSummary();
  const portfolio = usePortfolioSummary();
  const [sortKey, setSortKey] = useState<SortKey>("marketValue");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterTicker, setFilterTicker] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("held");

  const positionsByTicker = useMemo(() => {
    const map: Record<string, { quantity: number; buyAmount: number; marketValue: number; profitLoss: number }> = {};
    for (const p of portfolio.data?.positions ?? []) {
      map[p.ticker] = {
        quantity: p.quantity,
        buyAmount: p.buyAmount,
        marketValue: p.marketValue,
        profitLoss: p.profitLoss,
      };
    }
    return map;
  }, [portfolio.data?.positions]);

  const rows = useMemo(() => {
    const list: (TickerAnalysisRow & {
      quantity: number;
      profitLoss: number;
      profitLossRate: number;
      marketValue: number;
    })[] = (analysis.data?.tickers ?? [])
      .filter((r) => !filterTicker || r.ticker.toUpperCase().includes(filterTicker.toUpperCase()))
      .map((r) => {
        const pos = positionsByTicker[r.ticker];
        const quantity = pos?.quantity ?? 0;
        const profitLoss = pos?.profitLoss ?? 0;
        const buyAmount = pos?.buyAmount ?? 0;
        const marketValue = pos?.marketValue ?? 0;
        const profitLossRate = buyAmount > 0 ? (profitLoss / buyAmount) * 100 : 0;
        return { ...r, quantity, profitLoss, profitLossRate, marketValue };
      })
      .filter((r) => viewMode === "all" || r.quantity > 0);

    const cmp = (a: (typeof list)[0], b: (typeof list)[0]) => {
      let va: number | string = a[sortKey];
      let vb: number | string = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") {
        return sortAsc ? va - vb : vb - va;
      }
      const sa = String(va);
      const sb = String(vb);
      return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    };
    list.sort(cmp);
    return list;
  }, [analysis.data?.tickers, filterTicker, positionsByTicker, sortKey, sortAsc, viewMode]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((x) => !x);
    else {
      setSortKey(key);
      setSortAsc(key === "ticker");
    }
  };

  if (analysis.isPending || portfolio.isPending)
    return <div className="text-muted-foreground">로딩 중...</div>;
  if (analysis.error) return <div className="text-destructive">종목별 분석을 불러올 수 없습니다.</div>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded border border-input bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("held")}
            className={`rounded px-3 py-1.5 text-sm ${viewMode === "held" ? "bg-background shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            보유 종목만
          </button>
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`rounded px-3 py-1.5 text-sm ${viewMode === "all" ? "bg-background shadow" : "text-muted-foreground hover:text-foreground"}`}
          >
            과거 투자 포함
          </button>
        </div>
        <input
          type="text"
          placeholder="종목 검색"
          value={filterTicker}
          onChange={(e) => setFilterTicker(e.target.value)}
          className="rounded border px-3 py-1.5 text-sm"
        />
        <div className="flex flex-wrap gap-1">
          {SORT_KEYS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`rounded px-2 py-1 text-sm ${sortKey === key ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              {label} {sortKey === key ? (sortAsc ? "↑" : "↓") : ""}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">표시할 종목이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">종목</th>
                <th className="p-3 text-right">매수횟수</th>
                <th className="p-3 text-right">매도횟수</th>
                <th className="p-3 text-right">총매수금액</th>
                <th className="p-3 text-right">총매도금액</th>
                <th className="p-3 text-right">평가금액</th>
                <th className="p-3 text-right">실현손익</th>
                <th className="p-3 text-right">실현수익률</th>
                <th className="p-3 text-right">보유수량</th>
                <th className="p-3 text-right">평가손익</th>
                <th className="p-3 text-right">평가수익률</th>
                <th className="p-3 text-right">승률</th>
                <th className="p-3 text-left">참고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className="border-b hover:bg-muted/30">
                  <td className="p-3 font-medium">
                    <Link href={`/dashboard/ticker/${encodeURIComponent(r.ticker)}`} className="hover:underline">
                      {r.ticker}
                    </Link>
                  </td>
                  <td className="p-3 text-right">{r.buyCount}</td>
                  <td className="p-3 text-right">{r.sellCount}</td>
                  <td className="p-3 text-right">{r.totalBuyAmount.toLocaleString()}</td>
                  <td className="p-3 text-right">{r.totalSellAmount.toLocaleString()}</td>
                  <td className="p-3 text-right">{r.marketValue.toLocaleString()}</td>
                  <td className={`p-3 text-right ${r.realizedPnL >= 0 ? "text-profit" : "text-loss"}`}>
                    {Math.round(r.realizedPnL).toLocaleString()}
                  </td>
                  <td className={`p-3 text-right ${r.realizedRate >= 0 ? "text-profit" : "text-loss"}`}>
                    {r.realizedRate.toFixed(1)}%
                  </td>
                  <td className="p-3 text-right">{r.quantity.toLocaleString()}</td>
                  <td className={`p-3 text-right ${r.profitLoss >= 0 ? "text-profit" : "text-loss"}`}>
                    {Math.round(r.profitLoss).toLocaleString()}
                  </td>
                  <td className={`p-3 text-right ${r.profitLossRate >= 0 ? "text-profit" : "text-loss"}`}>
                    {r.profitLossRate.toFixed(1)}%
                  </td>
                  <td className="p-3 text-right">{r.winRate.toFixed(1)}%</td>
                  <td className="p-3">
                    {r.quantity > 0 && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium">보유</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
