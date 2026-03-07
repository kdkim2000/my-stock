"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCumulativePnl } from "@/hooks/useCumulativePnl";

export function CumulativePnlChart() {
  const [period, setPeriod] = useState<"6m" | "1y">("6m");
  const { data, isPending, error } = useCumulativePnl(period);

  if (isPending) return <div className="text-muted-foreground">로딩 중...</div>;
  if (error) return <div className="text-destructive">누적 수익 데이터를 불러올 수 없습니다.</div>;

  const points = data ?? [];
  const displayData = points.map((p) => ({ ...p, name: p.date }));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">누적 실현 수익금 추이</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setPeriod("6m")}
            className={`rounded px-2 py-1 text-sm ${period === "6m" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            6개월
          </button>
          <button
            type="button"
            onClick={() => setPeriod("1y")}
            className={`rounded px-2 py-1 text-sm ${period === "1y" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            1년
          </button>
        </div>
      </div>
      <div className="h-[280px] w-full">
        {displayData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            기간 내 데이터가 없습니다.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v ? String(v).slice(0, 10) : "")}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => (v / 10000).toFixed(0) + "만"}
              />
              <Tooltip
                formatter={(value: number | undefined) => [
                  value != null ? Math.round(value).toLocaleString() + "원" : "",
                  "누적 실현손익",
                ]}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="cumulativeRealized"
                name="누적 실현손익"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.2)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
