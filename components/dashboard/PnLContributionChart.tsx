"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";

const MAX_BARS = 12;
const PROFIT_COLOR = "hsl(0, 84%, 60%)";
const LOSS_COLOR = "hsl(217, 91%, 60%)";

export function PnLContributionChart() {
  const { data, isPending, error } = usePortfolioSummary();

  const { chartData, lossPositions } = useMemo(() => {
    const positions = (data?.positions ?? []).filter((p) => p.quantity > 0);
    const sorted = [...positions].sort((a, b) => b.profitLoss - a.profitLoss);
    const chartData = sorted.slice(0, MAX_BARS).map((p) => ({
      ticker: p.ticker,
      평가손익: p.profitLoss,
      수익률: p.buyAmount > 0 ? (p.profitLoss / p.buyAmount) * 100 : 0,
    }));
    const lossPositions = positions
      .filter((p) => p.profitLoss < 0)
      .map((p) => ({
        ticker: p.ticker,
        profitLoss: p.profitLoss,
        rate: p.buyAmount > 0 ? (p.profitLoss / p.buyAmount) * 100 : 0,
      }))
      .sort((a, b) => a.profitLoss - b.profitLoss);
    return { chartData, lossPositions };
  }, [data?.positions]);

  if (isPending) {
    return (
      <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
        로딩 중…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm">
        포지션 데이터를 불러올 수 없습니다.
      </div>
    );
  }

  const hasPositions = (data?.positions ?? []).some((p) => p.quantity > 0);
  if (!hasPositions) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 text-muted-foreground text-sm">
        보유 종목이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-muted-foreground mb-2">종목별 평가손익 (기여도)</p>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 48, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v >= 0 ? `${(v / 10000).toFixed(0)}만` : `-${(Math.abs(v) / 10000).toFixed(0)}만`)}
              />
              <YAxis type="category" dataKey="ticker" width={44} tick={{ fontSize: 11 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm shadow-md">
                      <p className="font-semibold text-foreground">{p.ticker}</p>
                      <p className={`tabular-nums ${p.평가손익 >= 0 ? "text-profit" : "text-loss"}`}>
                        평가손익 {p.평가손익 >= 0 ? "+" : ""}
                        {p.평가손익?.toLocaleString()}원
                      </p>
                      <p className="text-muted-foreground text-xs mt-0.5">수익률 {p.수익률?.toFixed(1)}%</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="평가손익" name="평가손익" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.평가손익 >= 0 ? PROFIT_COLOR : LOSS_COLOR}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {lossPositions.length > 0 && (
        <div>
          <p className="font-medium mb-2 text-sm text-muted-foreground">손실 포지션 (손절·재평가 후보)</p>
          <div className="overflow-x-auto rounded-lg border border-border/50 text-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/40">
                  <th className="p-2 text-left text-xs font-medium text-muted-foreground">종목</th>
                  <th className="p-2 text-right text-xs font-medium text-muted-foreground">평가손익</th>
                  <th className="p-2 text-right text-xs font-medium text-muted-foreground">수익률</th>
                </tr>
              </thead>
              <tbody>
                {lossPositions.slice(0, 8).map((p) => (
                  <tr key={p.ticker} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="p-2 font-medium">
                      <Link href={`/dashboard/ticker/${encodeURIComponent(p.ticker)}`} className="hover:underline">
                        {p.ticker}
                      </Link>
                    </td>
                    <td className="p-2 text-right text-loss">{p.profitLoss.toLocaleString()}</td>
                    <td className="p-2 text-right text-loss">{p.rate.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
