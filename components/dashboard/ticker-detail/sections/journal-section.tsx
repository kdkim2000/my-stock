import React from "react";
import { Calendar } from "lucide-react";

interface JournalSectionProps {
  transactions: any[];
}

export function JournalSection({ transactions }: JournalSectionProps) {
  return (
    <section id="section-journal" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
          최근 매매 일지
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          이 종목에 대한 Google 시트 매매 내역입니다. 최신순으로 표시됩니다.
        </p>
      </div>

      {transactions.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-muted-foreground">
            <span>총 {transactions.length}건</span>
            <span>
              매수 {transactions.filter((r) => r.Type === "매수").length}건 / 매도 {transactions.filter((r) => r.Type === "매도").length}건
            </span>
          </div>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-[2px] border-b border-border/60">
                  <tr>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground min-w-[7rem] whitespace-nowrap">일자</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground w-[72px]">구분</th>
                    <th className="py-2.5 px-3 text-right text-xs font-medium text-muted-foreground">수량</th>
                    <th className="py-2.5 px-3 text-right text-xs font-medium text-muted-foreground">단가</th>
                    <th className="py-2.5 px-3 text-right text-xs font-medium text-muted-foreground">금액</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground min-w-[100px]">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {[...transactions]
                    .sort((a, b) => String(b.Date ?? "").localeCompare(String(a.Date ?? "")))
                    .map((row, i) => {
                      const amount = (row.Quantity || 0) * (row.Price || 0);
                      const isBuy = row.Type === "매수";
                      return (
                        <tr
                          key={i}
                          className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-2.5 px-3 text-foreground tabular-nums whitespace-nowrap">{row.Date}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                isBuy
                                  ? "bg-profit/10 text-profit dark:bg-profit/20 dark:text-profit"
                                  : "bg-loss/10 text-loss dark:bg-loss/20 dark:text-loss"
                              }`}
                            >
                              {row.Type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{row.Quantity.toLocaleString("ko-KR")}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{row.Price.toLocaleString("ko-KR")}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                            {amount.toLocaleString("ko-KR")}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[180px] truncate" title={row.Journal || undefined}>
                            {row.Journal?.trim() || (row.Tags?.trim() ? `#${row.Tags}` : "—")}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
          {(transactions.some((r) => (r.Fee ?? 0) !== 0 || (r.Tax ?? 0) !== 0)) && (
            <p className="text-[10px] text-muted-foreground mt-2">
              * 수수료·세금이 있는 건은 시트에서 확인할 수 있습니다.
            </p>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/5 p-6 text-center">
          <Calendar className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" aria-hidden />
          <p className="text-sm font-medium text-muted-foreground mb-1">이 종목의 매매 내역이 없습니다</p>
          <p className="text-xs text-muted-foreground/80">Google 시트에 매수/매도 기록을 추가하면 여기에 표시됩니다.</p>
        </div>
      )}
    </section>
  );
}
