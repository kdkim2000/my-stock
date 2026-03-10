import React from "react";
import { TrendingUp } from "lucide-react";
import { formatFundamentalNum } from "../utils";

interface QuoteSectionProps {
  priceInfo?: any;
  info?: any;
}

export function QuoteSection({ priceInfo, info }: QuoteSectionProps) {
  return (
    <section id="section-quote" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 shrink-0 text-muted-foreground" />
        시세 요약
      </h2>
      {!priceInfo && !info?.weekly52High && (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
          KIS API 연동 시 시세·52주 고저가 표시됩니다.
        </p>
      )}
      {(priceInfo || info?.weekly52High != null || info?.weekly52Low != null) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 당일 시세 */}
          {(priceInfo?.stckOprc != null || priceInfo?.stckHgpr != null || priceInfo?.stckLwpr != null || priceInfo?.acmlVol != null) && (
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">당일 시세</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                {priceInfo?.stckOprc != null && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">시가</span>
                    <span className="font-semibold tabular-nums">{priceInfo.stckOprc.toLocaleString()}</span>
                  </div>
                )}
                {priceInfo?.stckHgpr != null && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">고가</span>
                    <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">{priceInfo.stckHgpr.toLocaleString()}</span>
                  </div>
                )}
                {priceInfo?.stckLwpr != null && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">저가</span>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{priceInfo.stckLwpr.toLocaleString()}</span>
                  </div>
                )}
                {priceInfo?.acmlVol != null && priceInfo.acmlVol > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">거래량</span>
                    <span className="font-semibold tabular-nums" title={priceInfo.acmlVol.toLocaleString()}>
                      {formatFundamentalNum(priceInfo.acmlVol)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">주</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* 52주 고저 */}
          {(info?.weekly52High != null || info?.weekly52Low != null) && (
            <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">52주</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {info?.weekly52High != null && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">52주 최고</span>
                    <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">{info.weekly52High.toLocaleString()}</span>
                  </div>
                )}
                {info?.weekly52Low != null && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">52주 최저</span>
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{info.weekly52Low.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
