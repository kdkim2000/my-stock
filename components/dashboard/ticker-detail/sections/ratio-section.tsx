import React, { Fragment } from "react";
import { LayoutList } from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Bar,
} from "recharts";
import { formatRatioVal } from "../utils";
import {
  buildRadarDataFromRatio,
  buildRatioOnlyBarData,
  buildValueOnlyBarData,
  renderRatioKisCard,
} from "../ratio-utils";
import { RATIO_KIS_GROUPS } from "../constants";
import { RatioSectionSkeleton } from "../skeletons";

interface RatioSectionProps {
  fundamentalData: any;
}

export function RatioSection({ fundamentalData }: RatioSectionProps) {
  if (fundamentalData.isPending) {
    return (
      <section id="section-ratio-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
          <LayoutList className="w-4 h-4 shrink-0 text-muted-foreground" />
          비율 (KIS)
        </h2>
        <RatioSectionSkeleton />
      </section>
    );
  }
  const kis = fundamentalData.kis;
  const finRatio = (kis?.financialRatio ?? null) as Record<string, unknown> | null;
  const allRatioRecs = [
    finRatio,
    kis?.profitRatio as Record<string, unknown> | null ?? null,
    kis?.stabilityRatio as Record<string, unknown> | null ?? null,
    kis?.growthRatio as Record<string, unknown> | null ?? null,
    kis?.otherMajorRatios as Record<string, unknown> | null ?? null,
  ];
  const radarData = buildRadarDataFromRatio(finRatio);
  const ratioOnlyBarData = buildRatioOnlyBarData(allRatioRecs);
  const valueOnlyBarData = buildValueOnlyBarData(allRatioRecs);
  const ratioCards = RATIO_KIS_GROUPS.map((group) => {
    const data = kis?.[group.dataKey] as Record<string, unknown> | null;
    const card = renderRatioKisCard(group.title, data, group.items);
    if (!card) return null;
    return <Fragment key={group.title}>{card}</Fragment>;
  });
  const hasAny = ratioCards.some((c) => c != null);
  const hasCharts = radarData.length >= 3 || ratioOnlyBarData.length >= 2 || valueOnlyBarData.length >= 2;
  return (
    <section id="section-ratio-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
        <LayoutList className="w-4 h-4 shrink-0 text-muted-foreground" />
        비율 (KIS)
      </h2>
      {!hasAny && (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
          KIS 비율 데이터를 가져올 수 없습니다. (일부 종목은 미제공)
        </p>
      )}
      {hasAny && (
        <div className="space-y-4">
          {hasCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {radarData.length >= 3 && (
                <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">비율 비교 (레이더)</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} tick={{ fontSize: 10 }} tickFormatter={(v) => String(v)} />
                      <Radar name="비율" dataKey="value" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.4} />
                      <Tooltip formatter={(v: number | undefined) => v != null ? `${v}%` : ""} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {ratioOnlyBarData.length >= 2 && (
                <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">비율만 비교 (%)</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={ratioOnlyBarData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-24} textAnchor="end" height={44} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v: number | undefined) => v != null ? `${v}%` : ""} />
                      <Bar dataKey="value" name="비율" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {valueOnlyBarData.length >= 2 && (
                <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">값만 비교 (EPS·BPS 등)</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={valueOnlyBarData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-24} textAnchor="end" height={44} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1e8 ? `${(v / 1e8).toFixed(0)}억` : v >= 1e4 ? `${(v / 1e4).toFixed(0)}만` : String(v))} />
                      <Tooltip formatter={(v: number | undefined) => formatRatioVal(v)} />
                      <Bar dataKey="value" name="값" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ratioCards}
          </div>
        </div>
      )}
    </section>
  );
}
