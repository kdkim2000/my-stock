import { getTickerMaster, getTickerAggregation } from "./google-sheets";

/**
 * 종목명(한글) ↔ 6자리 종목코드 매핑 (ARCHITECTURE §6, PRD §3.2)
 * 초기 스캐폴딩: 샘플만 포함. 시트 미사용 시 fallback으로 사용.
 */
const TICKER_TO_CODE: Record<string, string> = {
  LG전자: "066570",
  삼성전자: "005930",
};

const CODE_TO_TICKER: Record<string, string> = Object.fromEntries(
  Object.entries(TICKER_TO_CODE).map(([k, v]) => [v, k])
);

export function tickerToCode(ticker: string): string | undefined {
  return TICKER_TO_CODE[ticker] ?? undefined;
}

export function codeToTicker(code: string): string | undefined {
  return CODE_TO_TICKER[code] ?? undefined;
}

export function getAllTickerCodes(): Record<string, string> {
  return { ...TICKER_TO_CODE };
}

/**
 * 종목코드 매핑 단일 진입점. (1) 마스터 시트 (2) 종목별 집계 시트 Code 컬럼 (3) ticker-mapping.ts 순으로 조회.
 * KIS 현재가 조회 등에서 사용. ticker는 trim된 키로 저장.
 */
export async function getTickerCodeMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};

  const master = await getTickerMaster();
  for (const row of master) {
    const t = row.Ticker.trim();
    const code = String(row.Code ?? "").trim();
    if (t && code) map[t] = code;
  }

  const aggregation = await getTickerAggregation();
  for (const row of aggregation) {
    const t = row.Ticker.trim();
    const code = row.Code?.trim();
    if (t && code && map[t] === undefined) map[t] = code;
  }

  for (const [ticker, code] of Object.entries(TICKER_TO_CODE)) {
    const t = ticker.trim();
    if (t && map[t] === undefined) map[t] = code;
  }

  return map;
}
