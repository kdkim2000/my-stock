"use client";

import { useAnalysisSummary } from "@/hooks/useAnalysisSummary";

export function TagSummaryTable() {
  const { data, isPending, error } = useAnalysisSummary();
  const rows = data?.tagSummaries ?? [];

  if (isPending) return <div className="text-muted-foreground">로딩 중...</div>;
  if (error) return <div className="text-destructive">전략별 데이터를 불러올 수 없습니다.</div>;
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Tags가 있는 매도 이력이 없습니다. 매매 내역에 #태그 를 입력하면 전략별 성과가 집계됩니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="p-3 text-left">전략(태그)</th>
            <th className="p-3 text-right">매도 건수</th>
            <th className="p-3 text-right">실현손익</th>
            <th className="p-3 text-right">승률</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .sort((a, b) => b.realizedPnL - a.realizedPnL)
            .map((r) => (
              <tr key={r.tag} className="border-b hover:bg-muted/30">
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
