import React from "react";
import { CircleDollarSign } from "lucide-react";

interface ValuationSectionProps {
  kis?: any;
  info?: any;
}

export function ValuationSection({ kis, info }: ValuationSectionProps) {
  const per = kis?.per ?? info?.per ?? null;
  const pbr = kis?.pbr ?? info?.pbr ?? null;
  const eps = kis?.eps ?? info?.eps ?? null;
  const bps = kis?.bps ?? info?.bps ?? null;
  const fmtNum = (n: number | null | undefined) =>
    n != null && n > 0 ? (n >= 1 ? n.toFixed(1) : n.toFixed(2)) : "—";
  const hasPer = per != null && per > 0;
  const hasPbr = pbr != null && pbr > 0;
  const hasAny = hasPer || hasPbr || (eps != null && eps > 0) || (bps != null && bps > 0) || (kis?.forwardEps != null && kis.forwardEps > 0);

  return (
    <section id="section-valuation" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CircleDollarSign className="w-4 h-4 shrink-0 text-muted-foreground" />
          가치평가
        </h2>
        <span className="text-xs text-muted-foreground">최근 실적 반영 (KIS 기준)</span>
      </div>
      {!hasAny ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
          가치평가 데이터를 불러올 수 없습니다.
        </p>
      ) : (
        <div className="space-y-5">
          {/* PER · PBR — 한눈에 보는 핵심 */}
          <div className="rounded-lg border-2 border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              주요 지표
            </p>
            <div className="flex flex-wrap gap-8">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">PER</span>
                <span className="text-2xl font-bold tabular-nums tracking-tight">
                  {fmtNum(per)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">배</span>
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">PBR</span>
                <span className="text-2xl font-bold tabular-nums tracking-tight">
                  {fmtNum(pbr)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">배</span>
                </span>
              </div>
            </div>
          </div>
          {/* EPS · BPS · Forward EPS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">EPS</span>
              <span className="font-semibold tabular-nums text-lg">
                {eps != null && eps > 0 ? Math.round(eps).toLocaleString() : "—"}
                <span className="ml-1 text-sm font-normal text-muted-foreground">원</span>
              </span>
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">BPS</span>
              <span className="font-semibold tabular-nums text-lg">
                {bps != null && bps > 0 ? Math.round(bps).toLocaleString() : "—"}
                <span className="ml-1 text-sm font-normal text-muted-foreground">원</span>
              </span>
            </div>
            {kis?.forwardEps != null && kis.forwardEps > 0 && (
              <div className="rounded-lg border border-border/50 bg-muted/10 p-4 flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Forward EPS</span>
                <span className="font-semibold tabular-nums text-lg">
                  {Math.round(kis.forwardEps).toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">원</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
