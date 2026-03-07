/**
 * 기술적 보조지표 — KIS 일봉(종가) 기반 RSI, MACD 계산
 * 참고: RSI(Wilder 14), MACD(12,26,9)
 */

/** EMA 계산 */
function ema(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = prices[0];
  for (let i = 0; i < prices.length; i++) {
    const v = i === 0 ? prices[0] : prices[i] * k + prev * (1 - k);
    result.push(v);
    prev = v;
  }
  return result;
}

/**
 * RSI (Relative Strength Index) — period 기본 14
 * @returns 마지막 RSI 값 (0~100), 데이터 부족 시 null
 */
export function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i]! - closes[i - 1]!;
    if (change > 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * MACD (12, 26, 9) — 최근 일봉 기준
 * @returns { macd, signal, histogram } 마지막 값, 데이터 부족 시 null
 */
export function computeMACD(closes: number[], fast = 12, slow = 26, signalPeriod = 9): {
  macd: number;
  signal: number;
  histogram: number;
} | null {
  if (closes.length < slow + signalPeriod) return null;
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i]! - emaSlow[i]!);
  }
  const signalLine = ema(macdLine, signalPeriod);
  const lastIdx = macdLine.length - 1;
  const macd = macdLine[lastIdx]!;
  const signal = signalLine[lastIdx]!;
  return {
    macd: Math.round(macd * 100) / 100,
    signal: Math.round(signal * 100) / 100,
    histogram: Math.round((macd - signal) * 100) / 100,
  };
}

export interface TechnicalIndicatorsResult {
  /** 최근 일자 (YYYY-MM-DD) */
  date: string;
  /** RSI(14) 0~100 */
  rsi: number | null;
  /** MACD(12,26,9) 최근 값 */
  macd: { macd: number; signal: number; histogram: number } | null;
}

/**
 * 종가 배열과 마지막 날짜로 RSI·MACD 최신값 반환
 */
export function getTechnicalIndicators(
  closes: number[],
  lastDate: string
): TechnicalIndicatorsResult {
  return {
    date: lastDate,
    rsi: computeRSI(closes, 14),
    macd: computeMACD(closes, 12, 26, 9),
  };
}
