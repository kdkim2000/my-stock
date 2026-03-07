import { AppNav } from "@/components/AppNav";
import { SummaryCards } from "@/components/dashboard/SummaryCards";
import { CumulativePnlChart } from "@/components/dashboard/CumulativePnlChart";
import { PositionConcentrationChart } from "@/components/dashboard/PositionConcentrationChart";
import { PnLContributionChart } from "@/components/dashboard/PnLContributionChart";
import { TickerAnalysisTable } from "@/components/dashboard/TickerAnalysisTable";
import { TagSummaryTable } from "@/components/dashboard/TagSummaryTable";
import { TransactionTable } from "@/components/transactions/TransactionTable";

const SECTION_SPACING = "mt-8";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background">
      <AppNav />
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <h1 className="text-xl font-semibold text-foreground mb-6">투자 지원 대시보드</h1>
        <SummaryCards />
        <section id="ticker-analysis" className={`${SECTION_SPACING} scroll-mt-4`}>
          <h2 className="text-base font-semibold text-foreground mb-4">종목별 분석</h2>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <TickerAnalysisTable />
          </div>
        </section>
        <section className={SECTION_SPACING}>
          <h2 className="text-base font-semibold text-foreground mb-4">누적 수익금 추이</h2>
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <CumulativePnlChart />
          </div>
        </section>
        <section className={`${SECTION_SPACING} grid grid-cols-1 lg:grid-cols-2 gap-8`}>
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">포지션 집중도</h2>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <PositionConcentrationChart />
            </div>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">손익 기여도 · 손실 포지션</h2>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <PnLContributionChart />
            </div>
          </div>
        </section>
        <section id="tags" className={`${SECTION_SPACING} scroll-mt-4`}>
          <h2 className="text-base font-semibold text-foreground mb-4">전략별 성과 (Tags)</h2>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <TagSummaryTable />
          </div>
        </section>
        <section id="journal" className={`${SECTION_SPACING} scroll-mt-4`}>
          <h2 className="text-base font-semibold text-foreground mb-4">매매 내역</h2>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <TransactionTable />
          </div>
        </section>
      </div>
    </main>
  );
}
