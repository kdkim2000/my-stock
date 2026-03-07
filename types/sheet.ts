/** Google Sheets 행 스키마 (PRD §4) */
export interface SheetTransactionRow {
  Date: string;
  Ticker: string;
  Type: "매수" | "매도";
  Quantity: number;
  Price: number;
  Fee: number;
  Tax: number;
  Journal: string;
  Tags: string;
}

/** 종목코드 마스터 시트 행 (탭: GOOGLE_SHEET_TICKER_MASTER). 1행 헤더, 2행부터 Ticker, Code */
export interface TickerMasterRow {
  Ticker: string;
  Code: string;
}

/** 종목별 집계 시트 행 (탭: GOOGLE_SHEET_AGGREGATION). Ticker, Code(선택), 매수횟수, 매도횟수, ... */
export interface TickerAggregationRow {
  Ticker: string;
  Code?: string;
  buyCount: number;
  sellCount: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  realizedPnL: number;
  quantity: number;
}

export type RawSheetRow = (string | number)[];
