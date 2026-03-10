import React from "react";
import { Wallet } from "lucide-react";

interface PortfolioSectionProps {
  analysisRow: any;
  position: any;
}

export function PortfolioSection({ analysisRow, position }: PortfolioSectionProps) {
  return (
    <section id="section-portfolio" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
      <Wallet className="w-4 h-4 shrink-0 text-muted-foreground" />
      내 포트폴리오
    </h2>
      {analysisRow || position ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {analysisRow && (
            <>
              <div>
                <p className="text-muted-foreground">매수 횟수</p>
                <p>{analysisRow.buyCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">매도 횟수</p>
                <p>{analysisRow.sellCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">총 매수금액</p>
                <p>{analysisRow.totalBuyAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">총 매도금액</p>
                <p>{analysisRow.totalSellAmount.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">실현손익</p>
                <p className={analysisRow.realizedPnL >= 0 ? "text-profit" : "text-loss"}>
                  {Math.round(analysisRow.realizedPnL).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">실현수익률</p>
                <p className={analysisRow.realizedRate >= 0 ? "text-profit" : "text-loss"}>
                  {analysisRow.realizedRate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">승률</p>
                <p>{analysisRow.winRate.toFixed(1)}%</p>
              </div>
            </>
          )}
          {position && (
            <>
              <div>
                <p className="text-muted-foreground">보유 수량</p>
                <p>{position.quantity.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">평균 단가</p>
                <p>
                  {position.quantity > 0
                    ? (position.buyAmount / position.quantity).toFixed(0)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">평가금액</p>
                <p>{position.marketValue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">평가손익</p>
                <p className={position.profitLoss >= 0 ? "text-profit" : "text-loss"}>
                  {position.profitLoss.toLocaleString()}
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">이 종목의 매매 이력이 없습니다.</p>
      )}
    </section>
  );
}
