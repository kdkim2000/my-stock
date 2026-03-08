import { AppNav } from "@/components/AppNav";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { CumulativePnlChart } from "@/components/dashboard/CumulativePnlChart";
import { PositionConcentrationChart } from "@/components/dashboard/PositionConcentrationChart";
import { PnLContributionChart } from "@/components/dashboard/PnLContributionChart";
import { TickerAnalysisTable } from "@/components/dashboard/TickerAnalysisTable";
import { TagSummaryTable } from "@/components/dashboard/TagSummaryTable";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { BarChart2, LayoutList, PieChart, Tag, FileText, TrendingUp } from "lucide-react";

const SECTION_CLASS = "rounded-2xl border border-border/50 bg-card p-6 shadow-sm scroll-mt-6";
const SECTION_TITLE_CLASS = "text-lg font-semibold text-foreground mb-5 flex items-center gap-2";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      <AppNav />
      <div className="px-4 py-6 md:px-6 md:py-8 lg:px-8 max-w-6xl mx-auto space-y-8">
        {/* Hero */}
        <header className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            투자 지원 대시보드
          </h1>
          <p className="text-sm text-muted-foreground">
            포트폴리오 요약, 종목별 분석, 누적 수익 추이, 전략별 성과를 한눈에 확인합니다.
          </p>
        </header>

        <SummaryCards />

        <section id="ticker-analysis" className={SECTION_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>
            <LayoutList className="w-5 h-5 shrink-0 text-muted-foreground" />
            종목별 분석
          </h2>
          <div className="rounded-lg border border-border/50 bg-muted/5 overflow-hidden">
            <TickerAnalysisTable />
          </div>
        </section>

        <section className={SECTION_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>
            <TrendingUp className="w-5 h-5 shrink-0 text-muted-foreground" />
            누적 수익금 추이
          </h2>
          <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
            <CumulativePnlChart />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={SECTION_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>
              <PieChart className="w-5 h-5 shrink-0 text-muted-foreground" />
              포지션 집중도
            </h2>
            <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
              <PositionConcentrationChart />
            </div>
          </div>
          <div className={SECTION_CLASS}>
            <h2 className={SECTION_TITLE_CLASS}>
              <BarChart2 className="w-5 h-5 shrink-0 text-muted-foreground" />
              손익 기여도 · 손실 포지션
            </h2>
            <div className="rounded-lg border border-border/50 bg-muted/5 p-4">
              <PnLContributionChart />
            </div>
          </div>
        </section>

        <section id="tags" className={SECTION_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>
            <Tag className="w-5 h-5 shrink-0 text-muted-foreground" />
            전략별 성과 (Tags)
          </h2>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <TagSummaryTable />
          </div>
        </section>

        <section id="journal" className={SECTION_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>
            <FileText className="w-5 h-5 shrink-0 text-muted-foreground" />
            매매 내역
          </h2>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <TransactionTable />
          </div>
        </section>
      </div>
    </main>
  );
}
