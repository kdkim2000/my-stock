import { parseNum } from "../utils";
import { kisGet } from "./client";
import { getAccessToken } from "./token";
import { getBaseUrl, KIS_TR_PATH } from "./config";
import { getLatestQuarterEnd, pickFirstOutput } from "./utils";

export interface KisStockFundamentals {
  balanceSheet: { totalAssets?: number; totalLiabilities?: number; totalEquity?: number };
  incomeStatement: { revenue?: number; operatingIncome?: number; netIncome?: number };
  ratios: { per: number; pbr: number; eps?: number; bps?: number };
}

export async function getKisStockFundamentals(
  tickerCode: string,
  currentPrice?: number
): Promise<KisStockFundamentals | null> {
  const code = String(tickerCode ?? "").trim();
  if (!/^\d{6}$/.test(code)) return null;

  const ratioOut = await getKisFinancialRatio(code);
  let per = 0;
  let pbr = 0;
  let eps = 0;
  let bps = 0;
  let balanceSheet: KisStockFundamentals["balanceSheet"] = {};
  let incomeStatement: KisStockFundamentals["incomeStatement"] = {};

  if (ratioOut) {
    per = parseNum(ratioOut.per ?? ratioOut.prdy_per ?? ratioOut.PER ?? ratioOut.stck_per);
    pbr = parseNum(ratioOut.pbr ?? ratioOut.prdy_pbr ?? ratioOut.PBR ?? ratioOut.stck_pbr);
    eps = parseNum(ratioOut.eps ?? ratioOut.EPS ?? ratioOut.prdy_eps ?? ratioOut.stck_eps);
    bps = parseNum(ratioOut.bps ?? ratioOut.BPS ?? ratioOut.prdy_bps ?? ratioOut.stck_bps);
  }

  const hasRatioFromApi = per > 0 || pbr > 0 || eps !== 0 || bps !== 0;
  if (!hasRatioFromApi) {
    const fromSearch = await getKisStockFundamentalsFromSearchInfo(code, currentPrice);
    if (fromSearch) return fromSearch;
    return null;
  }

  let finalPer = per;
  let finalPbr = pbr;
  if (currentPrice != null && currentPrice > 0) {
    if (finalPer <= 0 && eps > 0) finalPer = currentPrice / eps;
    if (finalPbr <= 0 && bps > 0) finalPbr = currentPrice / bps;
  }
  return {
    balanceSheet,
    incomeStatement,
    ratios: { per: finalPer, pbr: finalPbr, eps: eps || undefined, bps: bps || undefined },
  };
}

async function getKisStockFundamentalsFromSearchInfo(
  code: string,
  currentPrice?: number
): Promise<KisStockFundamentals | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const appkey = process.env.KIS_APP_KEY;
  const appsecret = process.env.KIS_APP_SECRET;
  if (!appkey || !appsecret) return null;
  const baseUrl = getBaseUrl();
  const path = KIS_TR_PATH.CTPF1604R ?? "/uapi/domestic-stock/v1/quotations/search-info";
  const isVps = baseUrl.includes("openapivts");
  const envTrId = process.env.KIS_SEARCH_INFO_TR_ID?.trim();
  const defaultTrId = isVps ? "VFHKST02010100" : "FHKST02010100";
  const trId = envTrId != null && envTrId !== "" ? envTrId : defaultTrId;
  const body = await kisGet(path, trId, code);
  if (!body) return null;
  const out = pickFirstOutput(body);
  if (!out || typeof out !== "object") return null;

  const per = parseNum(out.per ?? out.prdy_per ?? out.PER ?? out.stck_per);
  const pbr = parseNum(out.pbr ?? out.prdy_pbr ?? out.PBR ?? out.stck_pbr);
  const eps = parseNum(out.eps ?? out.EPS ?? out.prdy_eps ?? out.stck_eps);
  const bps = parseNum(out.bps ?? out.BPS ?? out.prdy_bps ?? out.stck_bps);
  const totalAssets = parseNum(out.tot_aset ?? out.total_assets ?? out.자산총계);
  const totalEquity = parseNum(out.tot_eqty ?? out.total_equity ?? out.자본총계);
  const totalLiabilities = parseNum(out.tot_liab ?? out.total_liabilities ?? out.부채총계);
  const revenue = parseNum(out.rev ?? out.revenue ?? out.매출액);
  const operatingIncome = parseNum(out.op_inc ?? out.operating_income ?? out.영업이익);
  const netIncome = parseNum(out.net_inc ?? out.net_income ?? out.당기순이익);

  const balance: KisStockFundamentals["balanceSheet"] = {};
  if (totalAssets > 0) balance.totalAssets = totalAssets;
  if (totalLiabilities > 0) balance.totalLiabilities = totalLiabilities;
  if (totalEquity > 0) balance.totalEquity = totalEquity;

  const income: KisStockFundamentals["incomeStatement"] = {};
  if (revenue > 0) income.revenue = revenue;
  if (operatingIncome !== 0) income.operatingIncome = operatingIncome;
  if (netIncome !== 0) income.netIncome = netIncome;

  let finalPer = per;
  let finalPbr = pbr;
  if (currentPrice != null && currentPrice > 0) {
    if (finalPer <= 0 && eps > 0) finalPer = currentPrice / eps;
    if (finalPbr <= 0 && bps > 0) finalPbr = currentPrice / bps;
  }
  const hasAny =
    finalPer > 0 || finalPbr > 0 || eps !== 0 || bps !== 0 ||
    Object.keys(balance).length > 0 || Object.keys(income).length > 0;
  if (!hasAny) return null;
  return {
    balanceSheet: balance,
    incomeStatement: income,
    ratios: { per: finalPer, pbr: finalPbr, eps: eps || undefined, bps: bps || undefined },
  };
}

export async function getKisBalanceSheet(code: string): Promise<Record<string, number> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) {
    if (process.env.NODE_ENV === "development") console.log("[KIS] balanceSheet skip: invalid code");
    return null;
  }
  const path = KIS_TR_PATH.FHKST66430100;
  if (!path) return null;
  const codeStr = String(code).trim();
  const quarterEnd = getLatestQuarterEnd();
  let body = await kisGet(path, "FHKST66430100", codeStr, { FID_INPUT_DATE_1: quarterEnd, FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0" });
  if (!body) body = await kisGet(path, "FHKST66430100", codeStr, { FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0" });
  if (!body) return null;
  const out = pickFirstOutput(body);
  if (!out) return null;
  const totalAssets = parseNum(out.total_aset ?? out.tot_aset ?? out.total_assets ?? out.자산총계 ?? out.TOT_ASET);
  const totalLiabilities = parseNum(out.total_lblt ?? out.tot_liab ?? out.total_liabilities ?? out.부채총계 ?? out.TOT_LIAB);
  const totalEquity = parseNum(out.total_cptl ?? out.tot_eqty ?? out.total_equity ?? out.자본총계 ?? out.TOT_EQTY);
  const cur = parseNum(out.cras ?? out.cur_aset ?? out.current_assets ?? out.유동자산 ?? out.CUR_ASET);
  const nonCur = parseNum(out.fxas ?? out.non_cur_aset ?? out.noncurrent_assets ?? out.비유동자산 ?? out.NON_CUR_ASET);
  const curLiab = parseNum(out.flow_lblt ?? out.cur_liab ?? out.current_liabilities ?? out.유동부채 ?? out.CUR_LIAB);
  const nonCurLiab = parseNum(out.fix_lblt ?? out.non_cur_liab ?? out.noncurrent_liabilities ?? out.비유동부채 ?? out.NON_CUR_LIAB);
  const result: Record<string, number> = {
    totalAssets,
    totalLiabilities,
    totalEquity,
  };
  if (cur !== 0) result.currentAssets = cur;
  if (nonCur !== 0) result.nonCurrentAssets = nonCur;
  if (curLiab !== 0) result.currentLiabilities = curLiab;
  if (nonCurLiab !== 0) result.nonCurrentLiabilities = nonCurLiab;
  return result;
}

export async function getKisIncomeStatement(code: string): Promise<Record<string, number> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) {
    if (process.env.NODE_ENV === "development") console.log("[KIS] incomeStatement skip: invalid code");
    return null;
  }
  const path = KIS_TR_PATH.FHKST66430200;
  if (!path) return null;
  const codeStr = String(code).trim();
  const quarterEnd = getLatestQuarterEnd();
  let body = await kisGet(path, "FHKST66430200", codeStr, { FID_INPUT_DATE_1: quarterEnd, FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0" });
  if (!body) body = await kisGet(path, "FHKST66430200", codeStr, { FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0" });
  if (!body) return null;
  const out = pickFirstOutput(body);
  if (!out) return null;
  const revenue = parseNum(out.sale_account ?? out.rev ?? out.revenue ?? out.매출액 ?? out.REV);
  const operatingIncome = parseNum(out.op_prfi ?? out.bsop_prti ?? out.op_inc ?? out.operating_income ?? out.영업이익 ?? out.OP_INC);
  const netIncome = parseNum(out.thtr_ntin ?? out.net_inc ?? out.net_income ?? out.당기순이익 ?? out.NET_INC);
  return { revenue, operatingIncome, netIncome };
}

const financeExtraParams = () => ({
  FID_INPUT_DATE_1: getLatestQuarterEnd(),
  FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0",
});

const FINANCIAL_RATIO_NUM_KEYS = [
  "grs", "bsop_prfi_inrt", "ntin_inrt", "roe_val", "eps", "sps", "bps", "rsrv_rate", "lblt_rate",
  "per", "pbr", "prdy_per", "prdy_pbr", "stck_per", "stck_pbr", "prdy_eps", "stck_eps", "prdy_bps", "stck_bps",
  "PER", "PBR", "EPS", "BPS",
] as const;

function normalizeFinancialRatioOutput(raw: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    if (FINANCIAL_RATIO_NUM_KEYS.includes(k as (typeof FINANCIAL_RATIO_NUM_KEYS)[number])) {
      const n = parseNum(v);
      if (!Number.isNaN(n)) out[k] = n;
    } else if (typeof v === "number" && !Number.isNaN(v)) {
      out[k] = v;
    } else if (typeof v === "string" && /^-?\d+\.?\d*$/.test(v.trim())) {
      const n = parseNum(v);
      if (!Number.isNaN(n)) out[k] = n;
    } else if (typeof v === "string") {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function getKisFinancialRatio(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430300;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  const body = await kisGet(path, "FHKST66430300", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  const out = pickFirstOutput(body);
  return normalizeFinancialRatioOutput(out);
}

export async function getKisProfitRatio(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430400;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  let body = await kisGet(path, "FHKST66430400", codeStr, financeExtraParams());
  if (!body) body = await kisGet(path, "FHKST66430400", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  return pickFirstOutput(body);
}

export async function getKisStabilityRatio(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430600;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  let body = await kisGet(path, "FHKST66430600", codeStr, financeExtraParams());
  if (!body) body = await kisGet(path, "FHKST66430600", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  return pickFirstOutput(body);
}

export async function getKisGrowthRatio(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430800;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  let body = await kisGet(path, "FHKST66430800", codeStr, financeExtraParams());
  if (!body) body = await kisGet(path, "FHKST66430800", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  return pickFirstOutput(body);
}

export async function getKisOtherMajorRatios(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430500;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  let body = await kisGet(path, "FHKST66430500", codeStr, financeExtraParams());
  if (!body) body = await kisGet(path, "FHKST66430500", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  return pickFirstOutput(body);
}
