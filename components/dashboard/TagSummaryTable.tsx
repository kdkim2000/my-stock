"use client";

import { useAnalysisSummary } from "@/hooks/useAnalysisSummary";

export function TagSummaryTable() {
  const { data, isPending, error } = useAnalysisSummary();
  const rows = data?.tagSummaries ?? [];

  if (isPending) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm">
        로딩 중…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm">
        전략별 데이터를 불러올 수 없습니다.
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 px-4 py-6 text-center text-muted-foreground text-sm">
        Tags가 있는 매도 이력이 없습니다. 매매 내역에 <span className="font-medium text-foreground">#태그</span>를 입력하면 전략별 성과가 집계됩니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="p-3 text-left text-xs font-medium text-muted-foreground">전략(태그)</th>
            <th className="p-3 text-right text-xs font-medium text-muted-foreground">매도 건수</th>
            <th className="p-3 text-right text-xs font-medium text-muted-foreground">실현손익</th>
            <th className="p-3 text-right text-xs font-medium text-muted-foreground">승률</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .sort((a, b) => b.realizedPnL - a.realizedPnL)
            .map((r) => (
              <tr key={r.tag} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="p-3 font-medium">#{r.tag}</td>
                <td className="p-3 text-right">{r.sellCount}</td>
                <td
                  className={`p-3 text-right ${r.realizedPnL >= 0 ? "text-profit" : "text-loss"}`}
                >
                  {Math.round(r.realizedPnL).toLocaleString()}원
                </td>
                <td className="p-3 text-right">{r.winRate.toFixed(1)}%</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
