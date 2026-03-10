import React from "react";
import { Table2 } from "lucide-react";
import { formatEstimateVal } from "../utils";
import { ESTIMATE_PERFORM_GROUPS } from "../constants";

interface EstimateSectionProps {
  fundamentalData: any;
}

export function EstimateSection({ fundamentalData }: EstimateSectionProps) {
  if (!fundamentalData.kis) return null;
  return (
    <section id="section-estimate-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
        <Table2 className="w-4 h-4 shrink-0 text-muted-foreground" />
        추정실적 (KIS)
      </h2>
      {(!fundamentalData.kis.estimatePerform || Object.keys(fundamentalData.kis.estimatePerform).length === 0) ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
          KIS 추정실적 데이터를 가져올 수 없습니다. (일부 종목은 미제공)
        </p>
      ) : (() => {
        const ep = fundamentalData.kis!.estimatePerform as Record<string, unknown>;
        const hasVal = (v: unknown) => v != null && v !== "" && (typeof v === "number" ? !Number.isNaN(v) : true);
        const getNum = (v: unknown): number | null => {
          if (v == null) return null;
          const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
          return Number.isNaN(n) ? null : n;
        };
        return (
          <div className="space-y-4">
            {ESTIMATE_PERFORM_GROUPS.map((group) => {
              const shown = group.items.filter((item) => hasVal(ep[item.key]));
              if (shown.length === 0) return null;
              return (
                <div key={group.title} className="rounded-lg border border-border/50 bg-muted/10 p-4">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">{group.title}</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3">
                    {shown.map((item) => {
                      const raw = ep[item.key];
                      const num = getNum(raw);
                      const isRate = item.isRate === true;
                      const isPositive = num != null && num > 0;
                      const isNegative = num != null && num < 0;
                      const rateClass = isRate && isNegative
                        ? "text-red-600 dark:text-red-400"
                        : isRate && isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "";
                      const str = formatEstimateVal(raw, {
                        isAmount: item.isAmount,
                        isRate: item.isRate,
                      });
                      return (
                        <div key={item.key} className="flex flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                          <span className={`font-semibold tabular-nums ${rateClass}`}>{str}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </section>
  );
}
