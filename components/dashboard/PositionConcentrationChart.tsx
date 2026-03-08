"use client";

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
import { useMemo } from "react";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";

const MAX_BARS = 10;
const BAR_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 67%, 58%)",
  "hsl(0, 84%, 60%)",
  "hsl(190, 90%, 40%)",
  "hsl(330, 81%, 60%)",
  "hsl(50, 100%, 45%)",
  "hsl(170, 70%, 40%)",
  "hsl(260, 60%, 55%)",
];

export function PositionConcentrationChart() {
  const { data, isPending, error } = usePortfolioSummary();

  const chartData = useMemo(() => {
    const positions = (data?.positions ?? []).filter((p) => p.quantity > 0);
    const total = data?.totalMarketValue ?? 0;
    if (total <= 0 || positions.length === 0) return [];

    const withShare = positions
      .map((p) => ({
        ticker: p.ticker,
        비중: total > 0 ? (p.marketValue / total) * 100 : 0,
        marketValue: p.marketValue,
      }))
      .sort((a, b) => b.비중 - a.비중);

    const top = withShare.slice(0, MAX_BARS);
    const rest = withShare.slice(MAX_BARS);
    if (rest.length > 0) {
      const otherShare = rest.reduce((s, r) => s + r.비중, 0);
      const otherValue = rest.reduce((s, r) => s + r.marketValue, 0);
      return [...top, { ticker: "기타", 비중: otherShare, marketValue: otherValue }];
    }
    return top;
  }, [data?.positions, data?.totalMarketValue]);

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
  if (chartData.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/10 text-muted-foreground text-sm">
        보유 종목이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">종목별 평가금액 비중</p>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 48, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              unit="%"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis type="category" dataKey="ticker" width={44} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number | undefined, name, props) => [
                value != null ? `${value.toFixed(1)}%` : "",
                "비중",
              ]}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const p = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border/50 bg-card px-3 py-2 text-sm shadow-md">
                    <p className="font-semibold text-foreground">{p.ticker}</p>
                    <p className="tabular-nums">비중 {p.비중?.toFixed(1)}%</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      평가금액 {Number(p.marketValue).toLocaleString()}원
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="비중" name="비중" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={chartData[i].ticker === "기타" ? "hsl(0,0%,70%)" : BAR_COLORS[i % BAR_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
