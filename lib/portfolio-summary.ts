import type { SheetTransactionRow } from "@/types/sheet";
import type { PortfolioSummaryResponse } from "@/types/api";
import { sortTransactionsByDate } from "./sort-transactions";
import { getTickerCodeMap } from "./ticker-mapping";
import { getCurrentPrice } from "./kis-api";

/**
 * ticker → KIS 6자리 종목코드. codeMap은 getTickerCodeMap()으로 조회(마스터 시트 → 집계 시트 → 하드코딩 fallback).
 */
function resolveTickerToCodeWithMap(
  ticker: string,
  codeMap: Record<string, string>
): string | undefined {
  const t = ticker.trim();
  if (!t) return undefined;
  if (/^\d{6}$/.test(t)) return t;
  const sixDigit = t.match(/^(\d{6})/)?.[1];
  if (sixDigit) return sixDigit;
  return codeMap[t] ?? undefined;
}

/** 종목코드 정규화: 공백 제거, 숫자만 있으면 6자리 앞 0 채우기. KIS API 호출 전 적용. */
function normalizeTickerCode(code: string | undefined): string | undefined {
  if (code == null) return undefined;
  const s = String(code).trim();
  if (!s) return undefined;
  if (/^\d{6}$/.test(s)) return s;
  if (/^\d+$/.test(s) && s.length <= 6) return s.padStart(6, "0");
  return undefined;
}

/**
 * 매매 내역을 거래일 순으로 처리해 보유 종목별 매수 원가(가중평균)를 계산합니다.
 * 수량이 0이 되면 원가 리셋 후 다음 매수부터 새 매수단가를 적용합니다.
 * KIS 미연동 시 현재 평가 금액 = 총 매수 금액, 평가 손익 = 0 으로 둡니다.
 */
export function computePortfolioSummaryFromTransactions(
  transactions: SheetTransactionRow[]
): PortfolioSummaryResponse {
  const sorted = sortTransactionsByDate(transactions);
  const byTicker: Record<string, { buyQty: number; buyValue: number }> = {};

  for (const row of sorted) {
    const t = (row.Ticker || "").trim();
    if (!t) continue;
    if (!byTicker[t]) byTicker[t] = { buyQty: 0, buyValue: 0 };
    const q = row.Quantity || 0;
    const price = row.Price || 0;

    if (row.Type === "매수") {
      byTicker[t].buyQty += q;
      byTicker[t].buyValue += price * q;
    } else {
      const p = byTicker[t];
      const costOfSold = p.buyQty > 0 ? (p.buyValue * q) / p.buyQty : 0;
      p.buyQty -= q;
      p.buyValue -= costOfSold;
      if (p.buyQty < 0) p.buyQty = 0;
      if (p.buyValue < 0) p.buyValue = 0;
    }
  }

  let totalBuyAmount = 0;
  const positions: PortfolioSummaryResponse["positions"] = [];

  for (const [ticker, p] of Object.entries(byTicker)) {
    if (p.buyQty <= 0) continue;
    totalBuyAmount += p.buyValue;
    positions.push({
      ticker,
      quantity: p.buyQty,
      buyAmount: p.buyValue,
      marketValue: p.buyValue,
      profitLoss: 0,
    });
  }

  return {
    totalBuyAmount,
    totalMarketValue: totalBuyAmount,
    profitLoss: 0,
    positions,
  };
}

/**
 * KIS 현재가로 포트폴리오 요약 보강.
 * 보유수량(quantity)이 0보다 큰 종목만 현재가를 조회합니다.
 * (매수 총량 = 매도 총량인 종목은 positions에 없으므로 조회하지 않음.)
 * 매핑된 종목만 조회, 실패 시 해당 종목은 매수금액=평가금액으로 유지.
 */
export async function enrichPortfolioSummaryWithKis(
  summary: PortfolioSummaryResponse
): Promise<PortfolioSummaryResponse> {
  const positions = summary.positions ?? [];
  if (positions.length === 0) return summary;

  const codeMap = await getTickerCodeMap();
  let totalMarketValue = 0;
  let totalProfitLoss = 0;
  const enriched = await Promise.all(
    positions.map(async (p) => {
      const needCurrentPrice = p.quantity > 0;
      const trimmed = String(p.ticker).trim();
      let code = needCurrentPrice
        ? resolveTickerToCodeWithMap(trimmed, codeMap)
        : undefined;
      const codeBeforeNormalize = code;
      code = normalizeTickerCode(code);
      if (needCurrentPrice && code == null) {
        if (codeBeforeNormalize == null || codeBeforeNormalize === "") {
          console.warn("[평가손익] 단계3/4: 종목코드 없음 (마스터·집계 시트 또는 하드코딩에 ticker 없음) ticker=%s", trimmed);
        } else {
          console.warn("[평가손익] 단계4: 종목코드 정규화 실패 (6자리 숫자 아님) ticker=%s rawCode=%s", trimmed, codeBeforeNormalize);
        }
      }
      const currentPrice = code ? await getCurrentPrice(code) : null;
      if (needCurrentPrice && code != null && currentPrice == null) {
        console.warn("[평가손익] 단계5: 현재가 조회 실패 ticker=%s code=%s", trimmed, code);
      }
      const marketValue =
        needCurrentPrice && currentPrice != null
          ? currentPrice * p.quantity
          : p.buyAmount;
      const profitLoss = marketValue - p.buyAmount;
      totalMarketValue += marketValue;
      totalProfitLoss += profitLoss;
      return {
        ...p,
        marketValue,
        profitLoss,
      };
    })
  );

  return {
    totalBuyAmount: summary.totalBuyAmount,
    totalMarketValue,
    profitLoss: totalProfitLoss,
    profitLossRate:
      summary.totalBuyAmount > 0
        ? (totalProfitLoss / summary.totalBuyAmount) * 100
        : undefined,
    positions: enriched,
  };
}
