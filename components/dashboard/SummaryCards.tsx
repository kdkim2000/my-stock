"use client";

import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { useAnalysisSummary } from "@/hooks/useAnalysisSummary";
import { Banknote, TrendingUp, Target, Wallet } from "lucide-react";

export function SummaryCards() {
  const portfolio = usePortfolioSummary();
  const analysis = useAnalysisSummary();
  const isPending = portfolio.isPending || analysis.isPending;
  const error = portfolio.error ?? analysis.error;

  if (isPending) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm animate-pulse">
            <div className="h-4 w-20 rounded bg-muted/60 mb-3" />
            <div className="h-8 w-28 rounded bg-muted/40" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 text-destructive text-sm">
        지표를 불러올 수 없습니다. 시트 연동 및 KIS API 설정을 확인해 주세요.
      </div>
    );
  }

  const s = portfolio.data ?? { totalBuyAmount: 0, totalMarketValue: 0, profitLoss: 0 };
  const a = analysis.data ?? { totalRealizedPnL: 0, winRate: 0 };
  const profitClass = s.profitLoss >= 0 ? "text-profit" : "text-loss";
  const realizedClass = a.totalRealizedPnL >= 0 ? "text-profit" : "text-loss";

  const cards = [
    {
      label: "실현손익",
      value: `${Math.round(a.totalRealizedPnL).toLocaleString()}원`,
      valueClass: realizedClass,
      icon: Banknote,
    },
    {
      label: "평가손익 (미실현)",
      value: `${Math.round(s.profitLoss).toLocaleString()}원`,
      valueClass: profitClass,
      icon: TrendingUp,
    },
    {
      label: "전체 승률",
      value: `${a.winRate.toFixed(1)}%`,
      valueClass: "text-foreground",
      icon: Target,
    },
    {
      label: "총 자산",
      value: `${s.totalMarketValue.toLocaleString()}원`,
      valueClass: "text-foreground",
      icon: Wallet,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, valueClass, icon: Icon }) => (
        <div
          key={label}
          className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">
                {label}
              </p>
              <p className={`mt-2 text-xl font-bold tabular-nums tracking-tight ${valueClass} truncate`}>
                {value}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2 shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" aria-hidden />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
