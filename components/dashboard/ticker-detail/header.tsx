import React, { ReactNode } from "react";
import {
  RefreshCw,
  TrendingUp,
  CircleDollarSign,
  Table2,
  LayoutList,
  BarChart2,
  MessageSquare,
  FileText,
  Wallet,
  Activity,
  Sparkles,
  Calendar,
} from "lucide-react";

export interface TickerDetailHeaderProps {
  tickerOrCode: string;
  code: string;
  tickerStr: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  priceInfo?: {
    stckPrpr: number;
    prdyVrss: number;
    prdyCtrt: number;
  };
  hasPosition: boolean;
  position?: {
    quantity: number;
    marketValue: number;
    profitLoss: number;
  };
}

export const sectionNavLinks: { href: string; label: string; icon: ReactNode }[] = [
  { href: "#section-quote", label: "시세", icon: <TrendingUp className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-valuation", label: "가치평가", icon: <CircleDollarSign className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-financial-kis", label: "재무", icon: <Table2 className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-ratio-kis", label: "비율", icon: <LayoutList className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-estimate-kis", label: "추정실적", icon: <Table2 className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-trade-kis", label: "매매동향", icon: <BarChart2 className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-opinion", label: "투자의견", icon: <MessageSquare className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-dart-income", label: "DART 손익", icon: <BarChart2 className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-cashflow", label: "현금흐름", icon: <Table2 className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-disclosure", label: "공시", icon: <FileText className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-portfolio", label: "포트폴리오", icon: <Wallet className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-indicators", label: "보조지표", icon: <Activity className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-ai-guide", label: "AI 분석", icon: <Sparkles className="w-3.5 h-3.5 shrink-0" /> },
  { href: "#section-journal", label: "매매 일지", icon: <Calendar className="w-3.5 h-3.5 shrink-0" /> },
];

export function TickerDetailHeader({
  tickerOrCode,
  code,
  tickerStr,
  isRefreshing,
  onRefresh,
  priceInfo,
  hasPosition,
  position,
}: TickerDetailHeaderProps) {
  return (
    <header className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      <div className="p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                {tickerStr}
              </h1>
              <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {code || "—"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">종목 상세 정보</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing || !code}
              className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/70 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "갱신 중…" : "갱신"}
            </button>
            {priceInfo ? (
              <div className="text-right">
                <p className="text-2xl md:text-3xl font-bold tabular-nums tracking-tight">
                  {priceInfo.stckPrpr.toLocaleString()}
                  <span className="text-lg font-normal text-muted-foreground ml-1">원</span>
                </p>
                <p className={`text-sm font-medium tabular-nums mt-0.5 ${priceInfo.prdyVrss >= 0 ? "text-profit" : "text-loss"}`}>
                  {priceInfo.prdyVrss >= 0 ? "+" : ""}
                  {priceInfo.prdyVrss.toLocaleString()}원
                  <span className="ml-1 opacity-90">
                    ({priceInfo.prdyCtrt >= 0 ? "+" : ""}
                    {priceInfo.prdyCtrt}%)
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">시세 없음</p>
            )}
          </div>
        </div>
        {hasPosition && position && (
          <div className="mt-6 pt-6 border-t border-border/50 flex flex-wrap gap-6 rounded-lg bg-muted/30 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              보유 <span className="font-semibold text-foreground tabular-nums">{position.quantity.toLocaleString()}</span>주
            </span>
            <span className="text-sm text-muted-foreground">
              평가 <span className="font-semibold text-foreground tabular-nums">{position.marketValue.toLocaleString()}</span>원
            </span>
            <span className={`text-sm font-medium tabular-nums ${position.profitLoss >= 0 ? "text-profit" : "text-loss"}`}>
              평가손익 {position.profitLoss >= 0 ? "+" : ""}
              {position.profitLoss.toLocaleString()}원
            </span>
          </div>
        )}
      </div>
      <nav
        className="border-t border-border/50 bg-muted/20 px-4 py-3 overflow-x-auto scrollbar-thin"
        aria-label="이 페이지 내 섹션"
      >
        <div className="flex gap-1.5 min-w-max">
          {sectionNavLinks.map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/50 transition-colors whitespace-nowrap"
            >
              {icon}
              {label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
