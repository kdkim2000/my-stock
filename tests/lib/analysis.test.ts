import { describe, it, expect } from "vitest";
import { computeAnalysis } from "../../lib/analysis";
import type { SheetTransactionRow } from "../../types/sheet";

function row(overrides: Partial<SheetTransactionRow>): SheetTransactionRow {
  return {
    Date: "2024-01-01",
    Ticker: "삼성전자",
    Type: "매수",
    Quantity: 10,
    Price: 10000,
    Fee: 0,
    Tax: 0,
    Journal: "",
    Tags: "",
    ...overrides,
  };
}

describe("computeAnalysis", () => {
  it("빈 거래 내역 시 기본값 반환", () => {
    const result = computeAnalysis([]);
    expect(result.totalRealizedPnL).toBe(0);
    expect(result.winRate).toBe(0);
    expect(result.tickers).toHaveLength(0);
  });

  it("매수만 있으면 실현손익 0", () => {
    const result = computeAnalysis([
      row({ Type: "매수", Quantity: 10, Price: 10000 }),
    ]);
    expect(result.totalRealizedPnL).toBe(0);
  });

  it("단순 매수 후 매도: 실현손익 계산 정확", () => {
    const result = computeAnalysis([
      row({ Date: "2024-01-01", Type: "매수", Quantity: 10, Price: 10000 }),
      row({ Date: "2024-01-02", Type: "매도", Quantity: 10, Price: 12000 }),
    ]);
    // 실현손익 = (12000 - 10000) * 10 = 20,000
    expect(result.totalRealizedPnL).toBe(20000);
    expect(result.winRate).toBe(100);
  });

  it("손실 매도: 실현손익 음수", () => {
    const result = computeAnalysis([
      row({ Date: "2024-01-01", Type: "매수", Quantity: 5, Price: 20000 }),
      row({ Date: "2024-01-02", Type: "매도", Quantity: 5, Price: 18000 }),
    ]);
    // 실현손익 = (18000 - 20000) * 5 = -10,000
    expect(result.totalRealizedPnL).toBe(-10000);
    expect(result.winRate).toBe(0);
  });

  it("같은 종목 분할 매수 후 분할 매도: 가중평균 단가 적용", () => {
    const result = computeAnalysis([
      row({ Date: "2024-01-01", Type: "매수", Quantity: 10, Price: 10000 }),
      row({ Date: "2024-01-02", Type: "매수", Quantity: 10, Price: 20000 }),
      // 가중평균 = (10*10000 + 10*20000) / 20 = 15000
      row({ Date: "2024-01-03", Type: "매도", Quantity: 20, Price: 18000 }),
    ]);
    // 실현손익 = (18000 - 15000) * 20 = 60,000
    expect(result.totalRealizedPnL).toBe(60000);
  });

  it("여러 종목 혼합 거래: 종목별 집계 정확", () => {
    const result = computeAnalysis([
      row({ Ticker: "A", Date: "2024-01-01", Type: "매수", Quantity: 10, Price: 1000 }),
      row({ Ticker: "B", Date: "2024-01-01", Type: "매수", Quantity: 5, Price: 2000 }),
      row({ Ticker: "A", Date: "2024-01-02", Type: "매도", Quantity: 10, Price: 1500 }),
      row({ Ticker: "B", Date: "2024-01-02", Type: "매도", Quantity: 5, Price: 1800 }),
    ]);
    const tickerA = result.tickers.find((t) => t.ticker === "A");
    const tickerB = result.tickers.find((t) => t.ticker === "B");
    expect(tickerA?.realizedPnL).toBe(5000);  // (1500-1000)*10
    expect(tickerB?.realizedPnL).toBe(-1000); // (1800-2000)*5
    // 전체
    expect(result.totalRealizedPnL).toBe(4000);
    expect(result.winRate).toBe(50); // 1승 1패
  });

  it("승률: 매도 건 기준으로 계산", () => {
    const result = computeAnalysis([
      // 매도 1: 이익
      row({ Ticker: "A", Date: "2024-01-01", Type: "매수", Quantity: 1, Price: 100 }),
      row({ Ticker: "A", Date: "2024-01-02", Type: "매도", Quantity: 1, Price: 200 }),
      // 매도 2: 이익
      row({ Ticker: "A", Date: "2024-01-03", Type: "매수", Quantity: 1, Price: 100 }),
      row({ Ticker: "A", Date: "2024-01-04", Type: "매도", Quantity: 1, Price: 150 }),
      // 매도 3: 손실
      row({ Ticker: "A", Date: "2024-01-05", Type: "매수", Quantity: 1, Price: 200 }),
      row({ Ticker: "A", Date: "2024-01-06", Type: "매도", Quantity: 1, Price: 100 }),
    ]);
    // 2승 1패 = 66.7%
    expect(result.winRate).toBeCloseTo(66.7, 0);
  });

  it("태그 집계: #전략A 태그가 있는 매도 건 집계", () => {
    const result = computeAnalysis([
      row({ Date: "2024-01-01", Type: "매수", Quantity: 10, Price: 1000, Tags: "#전략A" }),
      row({ Date: "2024-01-02", Type: "매도", Quantity: 10, Price: 1500, Tags: "#전략A" }),
    ]);
    const tagA = result.tagSummaries?.find((t) => t.tag === "전략A");
    expect(tagA).toBeDefined();
    expect(tagA?.realizedPnL).toBe(5000);
  });
});
