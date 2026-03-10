export const formatFundamentalNum = (v: number) => {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}만`;
  return String(v);
};

export const formatRatioVal = (v: unknown): string => {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isNaN(v) ? "—" : (v >= 1 || v <= -1 ? v.toFixed(1) : v.toFixed(2));
  if (typeof v === "string") return v;
  return String(v);
};

export function formatEstimateVal(
  v: unknown,
  opts: { isAmount?: boolean; isRate?: boolean }
): string {
  if (v == null) return "—";
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  if (Number.isNaN(n)) return typeof v === "string" ? v : "—";
  if (opts.isAmount) return formatFundamentalNum(n);
  if (opts.isRate) return `${n}%`;
  return n >= 1 || n <= -1 ? n.toFixed(1) : n.toFixed(2);
}

export function formatStacYymm(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).replace(/\D/g, "").slice(0, 6);
  if (s.length !== 6) return null;
  return `${s.slice(0, 4)}.${s.slice(4, 6)}`;
}

export function formatOpinionDate(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).replace(/\D/g, "").slice(0, 8);
  if (s.length !== 8) return String(v);
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}

export function getOpinionBadgeClass(opinion: string | undefined): string {
  if (!opinion) return "bg-muted text-muted-foreground";
  const o = opinion.toUpperCase().replace(/\s/g, "");
  if (/BUY|매수|강력매수|추가매수/.test(o)) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30";
  if (/SELL|매도|강력매도|감소/.test(o)) return "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30";
  if (/HOLD|중립|유지|보유/.test(o)) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30";
  return "bg-muted text-muted-foreground";
}

export const INVESTOR_TRADE_DAILY_LABELS: Record<string, string> = {
  stck_bsop_date: "일자",
  stck_bsop_dt: "일자",
  prsn_ntby_qty: "개인 순매수(수량)",
  frgn_ntby_qty: "외국인 순매수(수량)",
  orgn_ntby_qty: "기관 순매수(수량)",
  prsn_ntby_amt: "개인 순매수(금액)",
  frgn_ntby_amt: "외국인 순매수(금액)",
  orgn_ntby_amt: "기관 순매수(금액)",
  prsn_seln_qty: "개인 매도(수량)",
  frgn_seln_qty: "외국인 매도(수량)",
  orgn_seln_qty: "기관 매도(수량)",
  prsn_shnu_qty: "개인 매수(수량)",
  frgn_shnu_qty: "외국인 매수(수량)",
  orgn_shnu_qty: "기관 매수(수량)",
  acml_vol: "누적거래량",
  acml_tr_pbmn: "누적거래대금",
};

export const DAILY_TRADE_VOLUME_LABELS: Record<string, string> = {
  stck_bsop_date: "일자",
  stck_bsop_dt: "일자",
  acml_vol: "누적거래량",
  acml_tr_pbmn: "누적거래대금",
  prsn_buy_qty: "개인 매수(수량)",
  prsn_sell_qty: "개인 매도(수량)",
  frgn_buy_qty: "외국인 매수(수량)",
  frgn_sell_qty: "외국인 매도(수량)",
  orgn_buy_qty: "기관 매수(수량)",
  orgn_sell_qty: "기관 매도(수량)",
  buy_vol: "매수체결량",
  sell_vol: "매도체결량",
};

export function tradingColumnLabel(key: string, labels: Record<string, string>): string {
  return labels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatTradingVal(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") {
    if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    return v;
  }
  if (typeof v === "number") {
    if (Number.isNaN(v)) return "—";
    return v >= 0 ? v.toLocaleString("ko-KR") : `-${Math.abs(v).toLocaleString("ko-KR")}`;
  }
  return String(v);
}

export function tradingDateLabel(s: unknown): string {
  if (s == null) return "";
  const str = typeof s === "string" ? s : String(s);
  const norm = str.replace(/\D/g, "");
  if (norm.length >= 8) {
    const ymd = norm.slice(-8);
    return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  }
  return str;
}
