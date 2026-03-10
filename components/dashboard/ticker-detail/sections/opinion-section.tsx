import React from "react";
import { MessageSquare } from "lucide-react";
import { formatOpinionDate, getOpinionBadgeClass } from "../utils";

interface OpinionSectionProps {
  opinionQuery: any;
}

export function OpinionSection({ opinionQuery }: OpinionSectionProps) {
  return (
    <section id="section-opinion" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
          투자의견
        </h2>
        <span className="text-xs text-muted-foreground">참고용 정보 · 투자 권유 아님</span>
      </div>
      {opinionQuery.isPending ? (
        <p className="text-sm text-muted-foreground">로딩 중…</p>
      ) : opinionQuery.error ? (
        <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
          투자의견을 불러올 수 없습니다.
        </p>
      ) : (() => {
        const opinion = opinionQuery.data;
        const ticker = opinion?.tickerOpinion;
        const brokers = opinion?.brokerOpinions ?? [];
        const hasAny = ticker || brokers.length > 0;
        const withPrice = brokers.filter((b: any) => b.targetPrice != null && b.targetPrice > 0);
        const avgPrice =
          withPrice.length > 0
            ? Math.round(withPrice.reduce((a: number, b: any) => a + (b.targetPrice ?? 0), 0) / withPrice.length)
            : 0;
        if (!hasAny) {
          return (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
              이 종목은 KIS 투자의견 데이터가 제공되지 않을 수 있습니다. (일부 종목은 증권사 DB 미제공)
            </p>
          );
        }
        return (
          <div className="space-y-5">
            {/* 대표 의견 — 한눈에 보는 요약 */}
            {ticker && (
              <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  대표 의견
                </p>
                <div className="flex flex-wrap items-end gap-6">
                  {(ticker.opinionName || ticker.outlook) && (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${getOpinionBadgeClass(ticker.opinionName ?? ticker.outlook)}`}
                    >
                      {ticker.opinionName ?? ticker.outlook}
                    </span>
                  )}
                  {ticker.targetPrice != null && ticker.targetPrice > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">목표가</p>
                      <p className="text-2xl font-bold tabular-nums tracking-tight">
                        {ticker.targetPrice.toLocaleString()}
                        <span className="ml-1 text-base font-normal text-muted-foreground">원</span>
                      </p>
                    </div>
                  )}
                  {ticker.date && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">제시일</p>
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {formatOpinionDate(ticker.date)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 컨센서스 한 줄 요약 */}
            {brokers.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {brokers.length}개 증권사
                </span>
                {avgPrice > 0 && (
                  <span>
                    평균 목표가 <span className="font-semibold tabular-nums text-foreground">{avgPrice.toLocaleString()}원</span>
                  </span>
                )}
              </div>
            )}

            {/* 증권사별 테이블 */}
            {brokers.length > 0 && (
              <div className="rounded-lg border border-border/50 bg-muted/10 overflow-hidden">
                <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border/60">
                      <tr>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[28%] min-w-[80px]">
                          증권사
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[22%] min-w-[72px]">
                          의견
                        </th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[28%] min-w-[90px]">
                          목표가
                        </th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[22%] min-w-[88px]">
                          제시일
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {brokers.map((row: any, i: number) => (
                        <tr
                          key={i}
                          className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2.5 px-4 font-medium text-foreground">
                            {row.brokerName ?? "—"}
                          </td>
                          <td className="py-2.5 px-4">
                            {row.opinion ? (
                              <span
                                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getOpinionBadgeClass(row.opinion)}`}
                              >
                                {row.opinion}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                            {row.targetPrice != null && row.targetPrice > 0
                              ? `${row.targetPrice.toLocaleString()}원`
                              : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground tabular-nums text-xs">
                            {row.date ? formatOpinionDate(row.date) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </section>
  );
}
