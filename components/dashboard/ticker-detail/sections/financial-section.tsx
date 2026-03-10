import React from "react";
import { Table2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from "recharts";
import { formatFundamentalNum } from "../utils";
import { FinancialSectionSkeleton } from "../skeletons";

interface FinancialSectionProps {
  fundamentalData: any;
}

export function FinancialSection({ fundamentalData }: FinancialSectionProps) {
  return (
    <section id="section-financial-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Table2 className="w-4 h-4 shrink-0 text-muted-foreground" />
          재무 요약 (KIS)
        </h2>
      </div>
      {fundamentalData.isPending ? (
        <FinancialSectionSkeleton />
      ) : (() => {
        const kis = fundamentalData.kis;
        const bs = kis?.balanceSheet;
        const inc = kis?.incomeStatement;
        const hasBs = bs && (bs.totalAssets != null || bs.totalLiabilities != null || bs.totalEquity != null);
        const hasInc = inc && (inc.revenue != null || inc.operatingIncome != null || inc.netIncome != null);
        const hasAny = hasBs || hasInc;
        if (!hasAny) {
          return (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
              KIS 재무 데이터를 가져올 수 없습니다. (일부 종목은 미제공)
            </p>
          );
        }
        const bsItems = [
          { key: "totalAssets", label: "자산총계" },
          { key: "totalLiabilities", label: "부채총계" },
          { key: "totalEquity", label: "자본총계" },
          { key: "currentAssets", label: "유동자산" },
          { key: "currentLiabilities", label: "유동부채" },
        ].filter((item) => bs && bs[item.key] != null);
        
        const incItems = [
          { key: "revenue", label: "매출액" },
          { key: "operatingIncome", label: "영업이익" },
          { key: "netIncome", label: "당기순이익" },
        ].filter((item) => inc && inc[item.key] != null);

        const bsChartData: { name: string; value: number; label: string }[] = [];
        if (bs) {
          if (bs.totalAssets != null) bsChartData.push({ name: "자산총계", value: bs.totalAssets, label: formatFundamentalNum(bs.totalAssets) });
          if (bs.totalLiabilities != null) bsChartData.push({ name: "부채총계", value: bs.totalLiabilities, label: formatFundamentalNum(bs.totalLiabilities) });
          if (bs.totalEquity != null) bsChartData.push({ name: "자본총계", value: bs.totalEquity, label: formatFundamentalNum(bs.totalEquity) });
          if (bs.currentAssets != null) bsChartData.push({ name: "유동자산", value: bs.currentAssets, label: formatFundamentalNum(bs.currentAssets) });
          if (bs.currentLiabilities != null) bsChartData.push({ name: "유동부채", value: bs.currentLiabilities, label: formatFundamentalNum(bs.currentLiabilities) });
        }
        
        const incChartData: { name: string; value: number; label: string }[] = [];
        if (inc) {
          if (inc.revenue != null) incChartData.push({ name: "매출액", value: inc.revenue, label: formatFundamentalNum(inc.revenue) });
          if (inc.operatingIncome != null) incChartData.push({ name: "영업이익", value: inc.operatingIncome, label: formatFundamentalNum(inc.operatingIncome) });
          if (inc.netIncome != null) incChartData.push({ name: "당기순이익", value: inc.netIncome, label: formatFundamentalNum(inc.netIncome) });
        }
        
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 재무상태 — 대차대조표 */}
              {hasBs && bs && bsItems.length > 0 && (
                <div className="rounded-lg border-2 border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    재무상태 (대차대조표)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4">
                    {bsItems.map((item) => (
                      <div key={item.key} className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <span className="text-lg font-bold tabular-nums tracking-tight">
                          {formatFundamentalNum(bs[item.key] as number)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 손익 — 손익계산서 */}
              {hasInc && inc && incItems.length > 0 && (
                <div className="rounded-lg border-2 border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    손익 (손익계산서)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4">
                    {incItems.map((item) => (
                      <div key={item.key} className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <span className="text-lg font-bold tabular-nums tracking-tight">
                          {formatFundamentalNum(inc[item.key] as number)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {(bsChartData.length > 0 || incChartData.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {bsChartData.length > 0 && (
                  <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">대차대조표 비교</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={bsChartData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickFormatter={(v) => formatFundamentalNum(v)} dataKey="value" />
                        <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number | undefined) => formatFundamentalNum(v ?? 0)} labelFormatter={(name) => name} />
                        <Bar dataKey="value" name="금액" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {incChartData.length > 0 && (
                  <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">손익계산서 비교</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={incChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => formatFundamentalNum(v)} />
                        <Tooltip formatter={(v: number | undefined) => formatFundamentalNum(v ?? 0)} labelFormatter={(name) => name} />
                        <Bar dataKey="value" name="금액" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </section>
  );
}
