import React from "react";
import { BarChart2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  Bar,
} from "recharts";
import { TradeSectionSkeleton } from "../skeletons";
import {
  buildDailyOhlcChartData,
  ohlcYDomain,
  buildInvestorCumulativeChartData,
  buildDailyVolumeChartData,
} from "../chart-utils";

interface TradeSectionProps {
  fundamentalData: any;
}

export function TradeSection({ fundamentalData }: TradeSectionProps) {
  const kis = fundamentalData.kis;
  const daily = kis?.investorTradeDaily ?? [];
  const vol = kis?.dailyTradeVolume ?? [];
  const dailyPrice = kis?.dailyPrice ?? [];
  const hasDaily = Array.isArray(daily) && daily.length > 0;
  const hasVol = Array.isArray(vol) && vol.length > 0;
  const hasOhlc = Array.isArray(dailyPrice) && dailyPrice.length > 0;
  const hasAny = hasDaily || hasVol || hasOhlc;
  // fundamental 로딩 중이거나 kis 자체가 없을 때 스켈레톤
  const isLoading = fundamentalData.isPending || !kis;
  if (isLoading) {
    return (
      <section id="section-trade-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 shrink-0 text-muted-foreground" />
          매매동향 (KIS)
        </h2>
        <TradeSectionSkeleton />
      </section>
    );
  }

  return (
    <section id="section-trade-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
        <BarChart2 className="w-4 h-4 shrink-0 text-muted-foreground" />
        매매동향 (KIS)
      </h2>
      {!hasAny && (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
          KIS 매매동향 데이터를 가져올 수 없습니다. (일부 종목·기간은 미제공)
        </p>
      )}
      {hasAny && (
      <div className="space-y-8">
        {hasOhlc && (() => {
          const ohlcData = buildDailyOhlcChartData(dailyPrice as Record<string, unknown>[]);
          if (ohlcData.length === 0) return null;
          const [yMin, yMax] = ohlcYDomain(ohlcData);
          return (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">주식현재가 일자별 (최근 30일) — 시가·종가·고가·저가</h3>
              <p className="text-xs text-muted-foreground mb-2">시가·종가·고가·저가 각각 연결 선차트</p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ohlcData} margin={{ top: 10, right: 12, left: 12, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(0, Math.floor(ohlcData.length / 8))}
                      axisLine={{ strokeWidth: 1 }}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v))}
                      domain={[yMin, yMax]}
                      width={44}
                      axisLine={false}
                      tickLine={true}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]?.payload) return null;
                        const p = payload[0].payload as (typeof ohlcData)[0];
                        return (
                          <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
                            <p className="font-medium text-foreground mb-1">{p.date}</p>
                            <p>시가 {p.open.toLocaleString("ko-KR")}</p>
                            <p>고가 {p.high.toLocaleString("ko-KR")}</p>
                            <p>저가 {p.low.toLocaleString("ko-KR")}</p>
                            <p>종가 {p.close.toLocaleString("ko-KR")}</p>
                          </div>
                        );
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="open" name="시가" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} connectNulls />
                    <Line type="monotone" dataKey="high" name="고가" stroke="hsl(var(--color-profit))" strokeWidth={1.5} dot={false} connectNulls />
                    <Line type="monotone" dataKey="low" name="저가" stroke="hsl(var(--color-loss))" strokeWidth={1.5} dot={false} connectNulls />
                    <Line type="monotone" dataKey="close" name="종가" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
        {!hasDaily && hasVol && (
          <p className="text-xs text-muted-foreground">투자자 매매동향 (일별) 데이터는 이 종목/기간에 제공되지 않습니다.</p>
        )}
        {hasDaily && daily.length > 0 && (() => {
          const chartData = buildInvestorCumulativeChartData(daily as Record<string, unknown>[]);
          if (chartData.length === 0) {
            return (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">투자자별 매매동향 (일별) — 누적 순매수량 (최근 30일)</h3>
                <p className="text-xs text-muted-foreground">최근 30일 데이터가 없습니다.</p>
              </div>
            );
          }
          return (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">투자자별 매매동향 (일별) — 누적 순매수량 (최근 30일)</h3>
              <p className="text-xs text-muted-foreground mb-2">최근 30일 누적. 양수: 순매수, 음수: 순매도.</p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      interval={Math.max(0, Math.floor(chartData.length / 8))}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v <= -10000 ? `${(v / 10000).toFixed(0)}만` : String(v))}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => [value != null ? value.toLocaleString("ko-KR") : "", ""]}
                      labelFormatter={(_, payload) => (payload?.[0]?.payload as { date?: string } | undefined)?.date ?? ""}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="personal_cum" name="개인 순매수 누적" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="inst_cum" name="기관 순매수 누적" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="foreign_cum" name="외국인 순매수 누적" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
        {hasVol && vol.length > 0 && (() => {
          const chartData = buildDailyVolumeChartData(vol as Record<string, unknown>[]);
          return (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">일별 매수·매도 체결량 (최근 30일)</h3>
              <p className="text-xs text-muted-foreground mb-2">최근 30일 일별 매수·매도 체결량 추이입니다.</p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v))} />
                    <Tooltip
                      formatter={(value: number | undefined) => [value != null ? value.toLocaleString("ko-KR") : "", ""]}
                      labelFormatter={(_, payload) => (payload?.[0]?.payload as { dateLabel?: string; date?: string } | undefined)?.dateLabel ?? payload?.[0]?.payload?.date ?? ""}
                    />
                    <Legend />
                    <Bar dataKey="매수" name="매수 체결량" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="매도" name="매도 체결량" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
      </div>
      )}
    </section>
  );
}
