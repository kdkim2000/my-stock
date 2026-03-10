import { chartNum } from "@/lib/utils";
import { tradingDateLabel } from "./utils";

export function pickKey<T>(r: Record<string, unknown>, keys: string[], fn: (v: unknown) => T): T {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
    const val = r[k];
    if (val === undefined || val === null) continue;
    return fn(val);
  }
  return fn(undefined);
}

export function findKeyByPattern(keys: string[], pattern: RegExp): string | undefined {
  const lower = keys.map((k) => k.toLowerCase());
  for (let i = 0; i < keys.length; i++) {
    if (pattern.test(keys[i]!) || pattern.test(lower[i]!)) return keys[i];
  }
  return undefined;
}

export function normalizeDateStr(s: string): string {
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(-8);
  if (digits.length === 6) return `20${digits}`;
  if (digits.length === 4) {
    const y = new Date().getFullYear();
    return `${y}${digits}`;
  }
  return digits.padStart(8, "0");
}

export function dateStrToSortKey(s: string): number {
  const norm = s ? normalizeDateStr(s) : "";
  if (!norm || norm.length !== 8) return 0;
  const n = parseInt(norm, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function ymdToIso(ymd: string): string {
  if (ymd.length >= 8) return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  return ymd;
}

export type InvestorCumulativePoint = {
  date: string;
  personal_cum: number;
  inst_cum: number;
  foreign_cum: number;
};

export function buildInvestorCumulativeChartData(
  rows: Record<string, unknown>[]
): InvestorCumulativePoint[] {
  const dateKeys = ["stck_bsop_date", "stck_bsop_dt", "일자", "date"];
  const prsnKeys = ["prsn_ntby_qty", "prsn_ntby_amt", "개인순매수수량"];
  const orgnKeys = ["orgn_ntby_qty", "orgn_ntby_amt", "기관순매수수량"];
  const frgnKeys = ["frgn_ntby_qty", "frgn_ntby_amt", "외국인순매수수량"];

  const first = rows[0];
  const isArrayRow = Array.isArray(first);
  const firstObj = !isArrayRow && first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  const allKeys = firstObj ? Object.keys(firstObj) : [];

  const resolvedDate = findKeyByPattern(allKeys, /bsop|date|일자/) ?? dateKeys.find((k) => allKeys.includes(k));
  const resolvedPrsn = findKeyByPattern(allKeys, /prsn|개인/) ?? prsnKeys.find((k) => allKeys.includes(k));
  const resolvedOrgn = findKeyByPattern(allKeys, /orgn|기관/) ?? orgnKeys.find((k) => allKeys.includes(k));
  const resolvedFrgn = findKeyByPattern(allKeys, /frgn|외국인/) ?? frgnKeys.find((k) => allKeys.includes(k));

  const getDate = (r: Record<string, unknown> | unknown[]) => {
    if (Array.isArray(r)) return String(r[0] ?? "");
    return resolvedDate ? String((r as Record<string, unknown>)[resolvedDate] ?? "") : pickKey(r as Record<string, unknown>, dateKeys, (v) => (v != null ? String(v) : ""));
  };
  const getNum = (r: Record<string, unknown> | unknown[], keys: string[], fallbackKey?: string, arrIndex?: number) => {
    if (Array.isArray(r) && typeof arrIndex === "number") return chartNum(r[arrIndex]);
    const o = r as Record<string, unknown>;
    if (fallbackKey && o[fallbackKey] != null) return chartNum(o[fallbackKey]);
    return pickKey(o, keys, chartNum);
  };

  const mapped = rows.map((r) => {
    const row = r as Record<string, unknown> | unknown[];
    const rawDate = getDate(row);
    const ymd = rawDate ? normalizeDateStr(rawDate) : "";
    const personal = isArrayRow ? getNum(row, [], undefined, 1) : getNum(row, prsnKeys, resolvedPrsn);
    const inst = isArrayRow ? getNum(row, [], undefined, 3) : getNum(row, orgnKeys, resolvedOrgn);
    const foreign = isArrayRow ? getNum(row, [], undefined, 2) : getNum(row, frgnKeys, resolvedFrgn);
    return { ymd, personal, inst, foreign };
  });

  const byDate: Record<string, { personal: number; inst: number; foreign: number }> = {};
  for (const row of mapped) {
    if (!row.ymd || row.ymd.length !== 8) continue;
    if (!byDate[row.ymd]) byDate[row.ymd] = { personal: 0, inst: 0, foreign: 0 };
    byDate[row.ymd]!.personal += row.personal;
    byDate[row.ymd]!.inst += row.inst;
    byDate[row.ymd]!.foreign += row.foreign;
  }
  const sorted = Object.entries(byDate)
    .sort(([a], [b]) => dateStrToSortKey(a) - dateStrToSortKey(b))
    .map(([ymd, v]) => ({ ymd, ...v }));

  let personal_cum = 0;
  let inst_cum = 0;
  let foreign_cum = 0;
  const out: InvestorCumulativePoint[] = [];
  for (const row of sorted) {
    personal_cum += row.personal;
    inst_cum += row.inst;
    foreign_cum += row.foreign;
    out.push({
      date: ymdToIso(row.ymd),
      personal_cum,
      inst_cum,
      foreign_cum,
    });
  }
  return out;
}

export function buildDailyVolumeChartData(
  rows: Record<string, unknown>[]
): { date: string; dateLabel: string; 매수: number; 매도: number }[] {
  const dateKeys = ["stck_bsop_date", "stck_bsop_dt", "일자", "date"];
  const buyKeys = ["buy_vol", "prsn_buy_qty", "frgn_buy_qty", "orgn_buy_qty", "매수체결량", "shnu_qty"];
  const sellKeys = ["sell_vol", "prsn_sell_qty", "frgn_sell_qty", "orgn_sell_qty", "매도체결량", "seln_qty"];
  const volKeys = ["acml_vol", "acml_tr_pbmn", "거래량", "vol"];

  const first = rows[0];
  const isArrayRow = Array.isArray(first);
  const firstObj = !isArrayRow && first && typeof first === "object" ? (first as Record<string, unknown>) : null;
  const allKeys = firstObj ? Object.keys(firstObj) : [];

  const resolvedDate =
    findKeyByPattern(allKeys, /bsop|date|일자|dt/) ??
    dateKeys.find((k) => allKeys.includes(k));
  const resolvedBuy =
    findKeyByPattern(allKeys, /buy|매수|shnu/) ?? buyKeys.find((k) => allKeys.includes(k));
  const resolvedSell =
    findKeyByPattern(allKeys, /sell|매도|seln/) ?? sellKeys.find((k) => allKeys.includes(k));
  const resolvedVol = findKeyByPattern(allKeys, /acml_vol|acml|거래량|vol/) ?? volKeys.find((k) => allKeys.includes(k));

  const getDate = (r: Record<string, unknown> | unknown[]) => {
    if (Array.isArray(r)) return String(r[0] ?? "");
    return resolvedDate ? String((r as Record<string, unknown>)[resolvedDate] ?? "") : pickKey(r as Record<string, unknown>, dateKeys, (v) => (v != null ? String(v) : ""));
  };
  const getNum = (r: Record<string, unknown> | unknown[], keys: string[], fallbackKey?: string, arrIndex?: number) => {
    if (Array.isArray(r) && typeof arrIndex === "number") return chartNum(r[arrIndex]);
    const o = r as Record<string, unknown>;
    if (fallbackKey && o[fallbackKey] !== undefined && o[fallbackKey] !== null) return chartNum(o[fallbackKey]);
    return pickKey(o, keys, chartNum);
  };

  const sorted = [...rows].sort((a, b) => {
    const da = getDate(a as Record<string, unknown> | unknown[]);
    const db = getDate(b as Record<string, unknown> | unknown[]);
    return dateStrToSortKey(da) - dateStrToSortKey(db);
  });
  return sorted.map((r) => {
    const row = r as Record<string, unknown> | unknown[];
    const dateStr = getDate(row);
    let buy = isArrayRow ? getNum(row, [], undefined, 1) : getNum(row, buyKeys, resolvedBuy);
    let sell = isArrayRow ? getNum(row, [], undefined, 2) : getNum(row, sellKeys, resolvedSell);
    if (buy === 0 && sell === 0 && !isArrayRow) {
      const o = row as Record<string, unknown>;
      buy = chartNum(o.prsn_buy_qty) + chartNum(o.frgn_buy_qty) + chartNum(o.orgn_buy_qty);
      sell = chartNum(o.prsn_sell_qty) + chartNum(o.frgn_sell_qty) + chartNum(o.orgn_sell_qty);
    }
    if (buy === 0 && sell === 0 && resolvedVol) {
      const vol = getNum(row, volKeys, resolvedVol);
      if (vol > 0) {
        buy = vol;
        sell = 0;
      }
    }
    return {
      date: dateStr,
      dateLabel: tradingDateLabel(dateStr || undefined),
      매수: buy,
      매도: sell,
    };
  });
}

export function ohlcYDomain(
  data: { low: number; high: number }[],
  paddingRatio = 0.025
): [number, number] {
  if (data.length === 0) return [0, 100];
  const minLow = Math.min(...data.map((d) => d.low));
  const maxHigh = Math.max(...data.map((d) => d.high));
  const range = maxHigh - minLow;
  const pad = range > 0 ? Math.max(range * paddingRatio, range * 0.01) : Math.max(minLow * 0.01, 1);
  return [minLow - pad, maxHigh + pad];
}

export function buildDailyOhlcChartData(
  rows: Record<string, unknown>[]
): { date: string; dateLabel: string; open: number; high: number; low: number; close: number; bodyHigh: number; bodyLow: number; isUp: boolean }[] {
  const sorted = [...rows].sort((a, b) => {
    const da = String((a as Record<string, unknown>).stck_bsop_date ?? (a as Record<string, unknown>).date ?? "");
    const db = String((b as Record<string, unknown>).stck_bsop_date ?? (b as Record<string, unknown>).date ?? "");
    return dateStrToSortKey(da) - dateStrToSortKey(db);
  });
  return sorted.map((r) => {
    const o = r as Record<string, unknown>;
    const open = chartNum(o.stck_oprc);
    const high = chartNum(o.stck_hgpr);
    const low = chartNum(o.stck_lwpr);
    const close = chartNum(o.stck_clpr);
    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const rawDate = String(o.stck_bsop_date ?? o.date ?? "");
    return {
      date: rawDate.length >= 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate,
      dateLabel: tradingDateLabel(rawDate || undefined),
      open,
      high,
      low,
      close,
      bodyHigh,
      bodyLow,
      isUp: close >= open,
    };
  });
}
