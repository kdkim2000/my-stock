import { kisGet } from "./client";
import { KIS_TR_PATH } from "./config";
import { dateToYmd, toKisDate00, extractListFromKisBody } from "./utils";

function isInvestorTradeRow(obj: unknown): boolean {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return false;
  const k = Object.keys(obj as Record<string, unknown>).join(" ").toLowerCase();
  return /stck_bsop|bsop_dt|prsn_ntby|frgn_ntby|orgn_ntby|일자|순매수/.test(k);
}

function transposeOutputToRows(output: Record<string, unknown>): unknown[] {
  const entries = Object.entries(output);
  if (entries.length === 0) return [];
  const firstArr = entries[0]![1];
  if (!Array.isArray(firstArr)) return [];
  const len = firstArr.length;
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < len; i++) {
    const row: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      if (Array.isArray(v) && v.length === len) row[k] = v[i];
      else row[k] = v;
    }
    rows.push(row);
  }
  return rows;
}

function parseInvestorTradeDailyBody(raw: Record<string, unknown>): unknown[] {
  let result: unknown[] = [];
  const keysToTry = ["output", "output2", "output1"] as const;
  for (const key of keysToTry) {
    const val = raw[key];
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      const first = val[0];
      if (typeof first === "object" && first !== null && !Array.isArray(first) && isInvestorTradeRow(first)) {
        result = val;
        break;
      }
      continue;
    }
    if (val != null && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const values = Object.values(obj);
      const allArrays = values.length > 0 && values.every((v) => Array.isArray(v));
      const sameLength =
        allArrays &&
        (values as unknown[][]).every((arr) => (arr as unknown[]).length === (values[0] as unknown[]).length);
      if (sameLength) {
        result = transposeOutputToRows(obj);
        break;
      }
      const rowArray = values.find(
        (v) =>
          Array.isArray(v) &&
          v.length > 0 &&
          typeof v[0] === "object" &&
          v[0] !== null &&
          !Array.isArray(v[0]) &&
          isInvestorTradeRow(v[0])
      );
      if (rowArray) {
        result = rowArray as unknown[];
        break;
      }
    }
  }
  if (result.length === 0) {
    const fallback = extractListFromKisBody(raw);
    if (
      Array.isArray(fallback) &&
      fallback.length > 0 &&
      typeof fallback[0] === "object" &&
      fallback[0] !== null &&
      !Array.isArray(fallback[0]) &&
      isInvestorTradeRow(fallback[0])
    )
      result = fallback;
  }
  return result;
}

function normalizeRowDateKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(-8);
  if (digits.length === 6) return `20${digits}`;
  if (digits.length === 4) return `${new Date().getFullYear()}${digits}`;
  return digits.padStart(8, "0");
}

function getRowDateKey(r: Record<string, unknown>): string {
  const dateKeys = ["stck_bsop_date", "stck_bsop_dt", "일자", "date"];
  for (const k of dateKeys) if (r[k] != null) return normalizeRowDateKey(String(r[k])) || "";
  return "";
}

const TRADING_TREND_DAYS = 30;

export async function getKisInvestorTradeDaily(
  code: string,
  _startDate?: string,
  _endDate?: string
): Promise<unknown[]> {
  if (!/^\d{6}$/.test(String(code).trim())) return [];
  const path = KIS_TR_PATH.FHPTJ04160001;
  if (!path) return [];
  const codeStr = String(code).trim();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - TRADING_TREND_DAYS);
  const startYmd = dateToYmd(startDate);
  const endYmd = dateToYmd(endDate);

  const byDate: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i <= TRADING_TREND_DAYS; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const ymd = dateToYmd(d);
    if (ymd > endYmd) break;
    const body = await kisGet(path, "FHPTJ04160001", codeStr, {
      FID_INPUT_DATE_1: ymd,
      FID_ORG_ADJ_PRC: "",
      FID_ETC_CLS_CODE: "1",
    });
    if (!body) continue;
    const output2 = body.output2;
    const rows = Array.isArray(output2) ? output2 : parseInvestorTradeDailyBody(body);
    for (const row of rows) {
      if (row == null || typeof row !== "object" || Array.isArray(row)) continue;
      const key = getRowDateKey(row as Record<string, unknown>);
      if (key && key >= startYmd && key <= endYmd && !byDate[key]) byDate[key] = row as Record<string, unknown>;
    }
  }
  return Object.values(byDate).sort((a, b) => getRowDateKey(a).localeCompare(getRowDateKey(b)));
}

export async function getKisDailyTradeVolume(
  code: string,
  _startDate?: string,
  _endDate?: string
): Promise<unknown[]> {
  if (!/^\d{6}$/.test(String(code).trim())) return [];
  const path = KIS_TR_PATH.FHKST03010800;
  if (!path) return [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - TRADING_TREND_DAYS);
  const startYmd = dateToYmd(startDate);
  const endYmd = dateToYmd(endDate);
  const body = await kisGet(path, "FHKST03010800", String(code).trim(), {
    FID_INPUT_DATE_1: toKisDate00(startDate),
    FID_INPUT_DATE_2: toKisDate00(endDate),
    FID_COND_MRKT_DIV_CODE_1: process.env.KIS_COND_MRKT_DIV_CODE ?? "J",
    FID_INPUT_ISCD_1: String(code).trim(),
    FID_PERIOD_DIV_CODE: "D",
  });
  if (!body) return [];
  const raw = body as Record<string, unknown>;
  let result: unknown[] = [];
  for (const key of ["output", "output2"] as const) {
    const val = raw[key];
    if (Array.isArray(val)) {
      result = val;
      break;
    }
    if (val != null && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const values = Object.values(obj);
      const allArrays = values.length > 0 && values.every((v) => Array.isArray(v));
      const sameLength =
        allArrays &&
        (values as unknown[][]).every((arr) => (arr as unknown[]).length === (values[0] as unknown[]).length);
      if (sameLength) {
        result = transposeOutputToRows(obj);
        break;
      }
      result = extractListFromKisBody(raw);
      break;
    }
  }
  if (result.length === 0) result = extractListFromKisBody(raw);
  result = result.filter((r) => {
    if (r == null || typeof r !== "object" || Array.isArray(r)) return false;
    const rowYmd = getRowDateKey(r as Record<string, unknown>);
    return rowYmd >= startYmd && rowYmd <= endYmd;
  });
  return (result as Record<string, unknown>[]).sort((a, b) =>
    getRowDateKey(a).localeCompare(getRowDateKey(b))
  );
}

export async function getKisDailyPrice(code: string): Promise<unknown[]> {
  if (!/^\d{6}$/.test(String(code).trim())) return [];
  const path = KIS_TR_PATH.FHKST01010400;
  if (!path) return [];
  const body = await kisGet(path, "FHKST01010400", String(code).trim(), {
    FID_COND_MRKT_DIV_CODE: "UN",
    FID_PERIOD_DIV_CODE: "D",
    FID_ORG_ADJ_PRC: "1",
  });
  if (!body) return [];
  const output = body.output;
  if (!Array.isArray(output)) return [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - TRADING_TREND_DAYS);
  const startYmd = dateToYmd(startDate);
  const endYmd = dateToYmd(endDate);
  return output.filter((r) => {
    if (r == null || typeof r !== "object" || Array.isArray(r)) return false;
    const key = getRowDateKey(r as Record<string, unknown>);
    return key >= startYmd && key <= endYmd;
  });
}
