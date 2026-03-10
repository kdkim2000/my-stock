import React from "react";
import { Activity } from "lucide-react";

interface IndicatorsSectionProps {
  indicatorsQuery: any;
}

export function IndicatorsSection({ indicatorsQuery }: IndicatorsSectionProps) {
  return (
    <section id="section-indicators" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
      <Activity className="w-4 h-4 shrink-0 text-muted-foreground" />
      보조지표
    </h2>
      <p className="text-xs text-muted-foreground mb-4">
        KIS 일봉 데이터 기반 RSI(14), MACD(12,26,9) — 참고용이며 투자 권유가 아닙니다.
      </p>
      {indicatorsQuery.isPending && !indicatorsQuery.data ? (
        <p className="text-sm text-muted-foreground">로딩 중…</p>
      ) : indicatorsQuery.error ? (
        <p className="text-sm text-muted-foreground">보조지표를 불러올 수 없습니다.</p>
      ) : indicatorsQuery.data ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {indicatorsQuery.data.date && (
            <div>
              <p className="text-muted-foreground">기준일</p>
              <p>{indicatorsQuery.data.date}</p>
            </div>
          )}
          {indicatorsQuery.data.rsi != null ? (
            <div>
              <p className="text-muted-foreground">RSI(14)</p>
              <p>
                {indicatorsQuery.data.rsi.toFixed(1)}
                {indicatorsQuery.data.rsi >= 70 && (
                  <span className="ml-1 text-xs text-muted-foreground">(과매수)</span>
                )}
                {indicatorsQuery.data.rsi <= 30 && (
                  <span className="ml-1 text-xs text-muted-foreground">(과매도)</span>
                )}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground">RSI(14)</p>
              <p>—</p>
            </div>
          )}
          {indicatorsQuery.data.macd ? (
            <>
              <div>
                <p className="text-muted-foreground">MACD</p>
                <p>{indicatorsQuery.data.macd.macd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">시그널</p>
                <p>{indicatorsQuery.data.macd.signal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">히스토그램</p>
                <p>{indicatorsQuery.data.macd.histogram.toFixed(2)}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="text-muted-foreground">MACD</p>
              <p>—</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">KIS 연동 후 일봉 데이터로 계산됩니다.</p>
      )}
    </section>
  );
}
