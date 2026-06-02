import React from "react";
import { BarChart2 } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
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
  fundamentalData: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** 캔들스틱 몸통 + 위아래 꼬리를 렌더링하는 커스텀 Recharts Bar shape */
function CandlestickBar(props: {
  x?: number; y?: number; width?: number; height?: number;
  payload?: { high: number; low: number; bodyHigh: number; bodyLow: number; isUp: boolean };
}) {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload || width <= 0 || height <= 0) return null;

  const { high, low, bodyHigh, bodyLow, isUp } = payload;
  const color = isUp
    ? "hsl(var(--color-profit))"
    : "hsl(var(--color-loss))";

  // 스택 바 결과: y = bodyHigh의 SVG y좌표, height = bodyHigh-bodyLow의 픽셀 높이
  // 이를 이용해 high·low 위치를 역산 (픽셀/단위 스케일)
  const bodyRange = bodyHigh - bodyLow;
  const ppu = bodyRange > 0 ? height / bodyRange : 0; // pixels per price unit

  const upperWickTop    = ppu > 0 ? y - (high - bodyHigh) * ppu : y;
  const lowerWickBottom = ppu > 0 ? y + height + (bodyLow - low) * ppu : y + height;

  const cx     = x + width / 2;
  const bodyX  = x + Math.max(width * 0.15, 1);
  const bodyW  = Math.max(width * 0.7, 2);
  const bodyY  = y;
  const bodyH  = Math.max(height, 1);

  return (
    <g>
      {/* 위 꼬리 */}
      <line x1={cx} x2={cx} y1={upperWickTop} y2={bodyY} stroke={color} strokeWidth={1.5} />
      {/* 몸통 */}
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} fill={color} />
      {/* 아래 꼬리 */}
      <line x1={cx} x2={cx} y1={bodyY + bodyH} y2={lowerWickBottom} stroke={color} strokeWidth={1.5} />
    </g>
  );
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
          const interval = Math.max(0, Math.floor(ohlcData.length / 8));
          return (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-1">주가 차트 (최근 30일) — 캔들스틱</h3>
              <p className="text-xs text-muted-foreground mb-3">
                <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: "hsl(var(--color-profit))" }} />상승봉&nbsp;
                <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1 align-middle" style={{ background: "hsl(var(--color-loss))" }} />하락봉
              </p>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={ohlcData}
                    margin={{ top: 10, right: 12, left: 12, bottom: 6 }}
                    barCategoryGap="20%"
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 10 }}
                      interval={interval}
                      axisLine={{ strokeWidth: 1 }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v)}
                      domain={[yMin, yMax]}
                      width={48}
                      axisLine={false}
                      tickLine={false}
                      yAxisId="price"
                    />
                    <YAxis
                      yAxisId="vol"
                      orientation="right"
                      hide
                      // 거래량 축: 최댓값을 실제의 5배로 설정 → 하단 20%에만 표시
                      domain={[0, (max: number) => max * 5]}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0]?.payload as (typeof ohlcData)[0];
                        if (!p) return null;
                        return (
                          <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md space-y-0.5">
                            <p className="font-semibold text-foreground mb-1">{p.date}</p>
                            <p className="text-muted-foreground">시가 <span className="text-foreground font-medium">{p.open.toLocaleString("ko-KR")}</span></p>
                            <p className="text-muted-foreground">고가 <span className="font-medium" style={{ color: "hsl(var(--color-profit))" }}>{p.high.toLocaleString("ko-KR")}</span></p>
                            <p className="text-muted-foreground">저가 <span className="font-medium" style={{ color: "hsl(var(--color-loss))" }}>{p.low.toLocaleString("ko-KR")}</span></p>
                            <p className="text-muted-foreground">종가 <span className="text-foreground font-medium">{p.close.toLocaleString("ko-KR")}</span></p>
                            {p.volume > 0 && (
                              <p className="text-muted-foreground pt-0.5 border-t border-border/40 mt-1">
                                거래량 <span className="text-foreground">{p.volume.toLocaleString("ko-KR")}</span>
                              </p>
                            )}
                          </div>
                        );
                      }}
                    />
                    {/* 거래량 바 (하단 20% 영역에 은은하게) */}
                    <Bar
                      yAxisId="vol"
                      dataKey="volume"
                      radius={[1, 1, 0, 0]}
                      fill="hsl(var(--muted-foreground) / 0.25)"
                      isAnimationActive={false}
                    />
                    {/* 캔들스틱: 투명 하단 스페이서 + 색상 몸통+꼬리 */}
                    <Bar
                      yAxisId="price"
                      stackId="candle"
                      dataKey="candleBottom"
                      fill="transparent"
                      stroke="none"
                      isAnimationActive={false}
                    />
                    <Bar
                      yAxisId="price"
                      stackId="candle"
                      dataKey="candleBodyHeight"
                      shape={<CandlestickBar />}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
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
