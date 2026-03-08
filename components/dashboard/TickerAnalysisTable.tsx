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

  if (analysis.isPending || portfolio.isPending) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        로딩 중…
      </div>
    );
  }
  if (analysis.error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm">
        종목별 분석을 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex rounded-lg border border-border/60 bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("held")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "held" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            보유 종목만
          </button>
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === "all" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            과거 투자 포함
          </button>
        </div>
        <input
          type="text"
          placeholder="종목 검색"
          value={filterTicker}
          onChange={(e) => setFilterTicker(e.target.value)}
          className="rounded-lg border border-border/60 bg-background px-3 py-1.5 text-sm w-36 sm:w-44 focus:outline-none focus:ring-2 focus:ring-ring/20"
          aria-label="종목 검색"
        />
        <div className="flex flex-wrap gap-1.5">
          {SORT_KEYS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => toggleSort(key)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                sortKey === key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {label} {sortKey === key ? (sortAsc ? "↑" : "↓") : ""}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 py-8 text-center text-muted-foreground text-sm">
          표시할 종목이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="p-3 text-left text-xs font-medium text-muted-foreground">종목</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">매수</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">매도</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">총매수</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">총매도</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">평가</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">실현손익</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">실현률</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">보유</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">평가손익</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">평가률</th>
                <th className="p-3 text-right text-xs font-medium text-muted-foreground">승률</th>
                <th className="p-3 text-left text-xs font-medium text-muted-foreground">참고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ticker} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
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
