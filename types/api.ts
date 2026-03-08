import type { SheetTransactionRow } from "./sheet";

export interface TransactionsResponse {
  transactions: SheetTransactionRow[];
}

export interface PortfolioSummaryResponse {
  totalBuyAmount: number;
  totalMarketValue: number;
  profitLoss: number;
  profitLossRate?: number;
  positions?: { ticker: string; quantity: number; buyAmount: number; marketValue: number; profitLoss: number }[];
}

/** 종목별 분석 한 줄 */
export interface TickerAnalysisRow {
  ticker: string;
  buyCount: number;
  sellCount: number;
  totalBuyAmount: number;
  totalSellAmount: number;
  realizedPnL: number;
  realizedRate: number;
  winCount: number;
  winRate: number;
}

/** 전략(태그)별 분석 한 줄 */
export interface TagSummaryRow {
  tag: string;
  realizedPnL: number;
  sellCount: number;
  winCount: number;
  winRate: number;
}

/** 분석 요약 (실현손익, 승률, 종목별, 태그별) */
export interface AnalysisSummaryResponse {
  totalRealizedPnL: number;
  totalWinCount: number;
  totalSellCount: number;
  winRate: number;
  tickers: TickerAnalysisRow[];
  tagSummaries?: TagSummaryRow[];
}

/** 누적 수익금 추이 차트용 한 점 */
export interface CumulativePnlPoint {
  date: string;
  cumulativeRealized: number;
  cumulativeTotal?: number;
}

/** KIS 현재가 API(inquire-price) 확장 응답 — 시세·전일대비 등 */
export interface KisPriceInfo {
  /** 현재가 */
  stckPrpr: number;
  /** 전일 대비 변화량 */
  prdyVrss: number;
  /** 전일 대비 변화율 (%) */
  prdyCtrt: number;
  /** 시가 */
  stckOprc?: number;
  /** 고가 */
  stckHgpr?: number;
  /** 저가 */
  stckLwpr?: number;
  /** 누적 거래량 */
  acmlVol?: number;
  /** 종목명 (응답에 있을 경우) */
  stckShrnIscd?: string;
}

/** 일봉 한 건 (KIS inquire-daily-itemchartprice) */
export interface KisDailyChartPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** 보조지표 (KIS 일봉 기반 계산) */
export interface TechnicalIndicatorsResponse {
  date: string;
  rsi: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
}

/** 수익성 비율 */
export interface ProfitabilityRatios {
  roe: number;
  roa: number;
  operatingMargin: number;
  netProfitMargin: number;
}

/** 안정성 비율 */
export interface StabilityRatios {
  debtRatio: number;
  currentRatio: number;
}

/** 성장성 비율 */
export interface GrowthRatios {
  revenueGrowth: number;
  netIncomeGrowth: number;
}

/** 기타 주요 비율 */
export interface OtherRatios {
  per: number;
  pbr: number;
}

/** 재무비율 통합 */
export interface FinancialRatios {
  profitability: ProfitabilityRatios;
  stability: StabilityRatios;
  growth: GrowthRatios;
  other: OtherRatios;
}

/** 대차대조표 주요 항목 (DART 계정명 → 금액) */
export interface DartBalanceSheet {
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  currentAssets?: number;
  nonCurrentAssets?: number;
  currentLiabilities?: number;
  nonCurrentLiabilities?: number;
}

/** 손익계산서 주요 항목 */
export interface DartIncomeStatement {
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
  grossProfit?: number;
  sellingAndAdminExpenses?: number;
}

/** DART 재무 API 응답 */
export interface DartFinancialsResponse {
  balanceSheet: DartBalanceSheet;
  incomeStatement: DartIncomeStatement;
  ratios: FinancialRatios;
  bsnsYear: string;
}

/** KIS 종목투자의견 — 한 종목에 대한 통합/대표 의견 */
export interface KisTickerOpinion {
  /** 의견 코드 또는 구분 */
  opinionCode?: string;
  /** 의견명 (매수/매도/중립 등) */
  opinionName?: string;
  /** 목표가 */
  targetPrice?: number;
  /** 전망 또는 비고 */
  outlook?: string;
  /** 제시일 (YYYYMMDD 또는 ISO) */
  date?: string;
  [key: string]: unknown;
}

/** KIS 증권사별 투자의견 한 건 */
export interface KisBrokerOpinion {
  /** 증권사명 */
  brokerName?: string;
  /** 의견 (매수/매도/중립 등) */
  opinion?: string;
  /** 목표가 */
  targetPrice?: number;
  /** 제시일 */
  date?: string;
  [key: string]: unknown;
}

/** KIS 응답에 포함된 PER/PBR/EPS/BPS (투자의견 API 등에서 함께 내려오는 경우) */
export interface KisPriceIndicators {
  per?: number | null;
  pbr?: number | null;
  eps?: number | null;
  bps?: number | null;
}

/** KIS 투자의견 통합 (종목 + 증권사별). 일부 TR에서는 per/pbr/eps가 함께 내려와 priceIndicators로 노출 */
export interface KisInvestmentOpinion {
  tickerOpinion: KisTickerOpinion | null;
  brokerOpinions: KisBrokerOpinion[];
  /** 투자의견 API 응답 1행에 포함된 PER/PBR/EPS/BPS (가치평가 fallback용) */
  priceIndicators?: KisPriceIndicators | null;
}

/** KIS 대차대조표 (FHKST66430100) 파싱 결과 */
export interface KisBalanceSheetData {
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  currentAssets?: number;
  nonCurrentAssets?: number;
  currentLiabilities?: number;
  nonCurrentLiabilities?: number;
  [key: string]: number | undefined;
}

/** KIS 손익계산서 (FHKST66430200) 파싱 결과 */
export interface KisIncomeStatementData {
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
  [key: string]: number | undefined;
}

/** KIS 재무/비율 API 원본 응답 (필드명 한·영 혼용) */
export type KisRatioData = Record<string, unknown>;

/** KIS 추정실적 (HHKST668300C0) — Forward EPS 등 */
export type KisEstimatePerformData = Record<string, unknown>;

/** KIS 투자자매매동향 일별·일별 체결량 행 (원시 배열) */
export type KisTradingTrendRow = Record<string, unknown>;

/** 종목 상세용 통합 정보 — KIS 종목정보·시세 + 52주 고저 + 재무(선택) */
export interface TickerDetailInfo {
  /** 6자리 종목코드 */
  code: string;
  /** 종목명(티커) */
  ticker: string;
  /** 현재가 시세 (KIS inquire-price 확장) */
  priceInfo: KisPriceInfo | null;
  /** 52주 최고가 (일봉 기반 계산, 없으면 null) */
  weekly52High: number | null;
  /** 52주 최저가 (일봉 기반 계산, 없으면 null) */
  weekly52Low: number | null;
  /** PER 등은 KIS 종목정보 API 연동 후 추가 */
  per?: number | null;
  pbr?: number | null;
  eps?: number | null;
  bps?: number | null;
  /** DART 재무제표·비율 (선택) */
  financials?: DartFinancialsResponse | null;
  /** KIS 투자의견 (종목 + 증권사별) */
  investmentOpinion?: KisInvestmentOpinion | null;
}

/** POST /api/ai/trading-guide 요청 body */
export interface TradingGuideRequest {
  code: string;
  ticker?: string;
}

/** POST /api/ai/trading-guide 성공 응답 */
export interface TradingGuideResponse {
  content: string;
}
