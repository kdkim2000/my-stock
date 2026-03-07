"use client";

import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { useAnalysisSummary } from "@/hooks/useAnalysisSummary";

export function SummaryCards() {
  const portfolio = usePortfolioSummary();
  const analysis = useAnalysisSummary();
  const isPending = portfolio.isPending || analysis.isPending;
  const error = portfolio.error ?? analysis.error;
  if (isPending) return <div className="text-muted-foreground">로딩 중...</div>;
  if (error) return <div className="text-destructive">지표를 불러올 수 없습니다.</div>;

  const s = portfolio.data ?? { totalBuyAmount: 0, totalMarketValue: 0, profitLoss: 0 };
  const a = analysis.data ?? { totalRealizedPnL: 0, winRate: 0 };
  const profitClass = s.profitLoss >= 0 ? "text-profit" : "text-loss";
  const realizedClass = a.totalRealizedPnL >= 0 ? "text-profit" : "text-loss";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">실현손익</p>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${realizedClass}`}>{Math.round(a.totalRealizedPnL).toLocaleString()}원</p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">평가손익 (미실현)</p>
        <p className={`mt-1 text-xl font-semibold tabular-nums ${profitClass}`}>{Math.round(s.profitLoss).toLocaleString()}원</p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">전체 승률 (참고)</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{a.winRate.toFixed(1)}%</p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">총 자산</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{s.totalMarketValue.toLocaleString()}원</p>
      </div>
    </div>
  );
}
