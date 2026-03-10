/**
 * DART 전자공시 Open API — 재무제표·비율
 * - 회사목록(corpCode) → 종목코드(6자리) to corp_code(8자리)
 * - 단일회사 주요계정(fnlttSinglAcnt) → 대차대조표·손익계산서
 * @see https://opendart.fss.or.kr
 */

const DART_BASE = "https://opendart.fss.or.kr/api";

/** 인증키 미설정 시 null */
function getApiKey(): string | null {
  const key = process.env.DART_API_KEY?.trim();
  return key || null;
}

/** corp_code 목록 캐시: stock_code(6자리) → corp_code(8자리) */
let corpCodeMapCache: Record<string, string> | null = null;
let corpCodeCacheTime = 0;
const CORP_CODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

import { parseNum } from "./utils";

/**
 * 종목코드(6자리) → DART corp_code(8자리). 목록은 ZIP+XML로 캐시.
 */
export async function getCorpCodeByStockCode(stockCode: string): Promise<string | null> {
  const code = String(stockCode ?? "").trim().padStart(6, "0");
  if (code.length !== 6 || !/^\d{6}$/.test(code)) return null;
  const key = getApiKey();
  if (!key) {
    if (process.env.NODE_ENV === "development") console.log("[DART] corpCode: DART_API_KEY not set");
    return null;
  }

  const now = Date.now();
  if (corpCodeMapCache && now - corpCodeCacheTime < CORP_CODE_CACHE_TTL_MS) {
    return corpCodeMapCache[code] ?? null;
  }

  try {
    const url = `${DART_BASE}/corpCode.xml?crtfc_key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const zip = new (await import("adm-zip")).default(Buffer.from(buf));
    const entry = zip.getEntry("CORPCODE.xml");
    if (!entry) return null;
    const xmlText = entry.getData().toString("utf-8");
    const map: Record<string, string> = {};
    const listBlocks = xmlText.split(/<list\s*>/i).slice(1);
    for (const block of listBlocks) {
      const corpMatch = block.match(/<corp_code>([^<]*)<\/corp_code>/);
      const stockMatch = block.match(/<stock_code>([^<]*)<\/stock_code>/);
      const corpCode = (corpMatch?.[1] ?? "").trim();
      const stockCodeItem = (stockMatch?.[1] ?? "").trim();
      if (corpCode && /^\d{5,6}$/.test(stockCodeItem)) {
        const normalized = stockCodeItem.padStart(6, "0");
        map[normalized] = corpCode;
      }
    }
    corpCodeMapCache = map;
    corpCodeCacheTime = now;
    const corp = map[code] ?? null;
    if (process.env.NODE_ENV === "development" && !corp) {
      console.log("[DART] corpCode: stock code %s not found in DART list (map size=%d)", code, Object.keys(map).length);
    }
    return corp;
  } catch (e) {
    console.error("[DART] corpCode fetch error:", e);
    return null;
  }
}

/** DART fnlttSinglAcnt 항목 한 건 */
export interface DartAccountItem {
  account_nm: string;
  thstrm_amount: string;
  frmtrm_amount?: string;
  thstrm_q_amount?: string;
  frmtrm_q_amount?: string;
}

/** 당기/전기 금액 추출 */
function amountFrom(item: DartAccountItem, useQuarter = false): number {
  const s = useQuarter ? item.thstrm_q_amount ?? item.thstrm_amount : item.thstrm_amount;
  return parseNum(s);
}

/**
 * 단일회사 주요계정(재무제표) 조회. 사업보고서(11011) 기준.
 */
export async function getFnlttSinglAcnt(
  corpCode: string,
  bsnsYear: string,
  reprtCode = "11011"
): Promise<DartAccountItem[]> {
  const key = getApiKey();
  if (!key) return [];
  const url = `${DART_BASE}/fnlttSinglAcnt.json?crtfc_key=${encodeURIComponent(key)}&corp_code=${encodeURIComponent(corpCode)}&bsns_year=${encodeURIComponent(bsnsYear)}&reprt_code=${encodeURIComponent(reprtCode)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { status?: string; message?: string; list?: DartAccountItem[] };
  if (data.status !== "000") {
    if (process.env.NODE_ENV === "development") {
      console.log("[DART] fnlttSinglAcnt corp=%s year=%s status=%s message=%s", corpCode, bsnsYear, data.status, data.message ?? "");
    }
    return [];
  }
  const rawList = data.list;
  const list = Array.isArray(rawList) ? rawList : [];
  if (process.env.NODE_ENV === "development" && list.length === 0 && rawList != null) {
    console.log("[DART] fnlttSinglAcnt corp=%s year=%s status=000 but list not array: %s", corpCode, bsnsYear, typeof rawList);
  }
  return list;
}

/** 대차대조표 주요 항목 (계정명 매칭) */
const BS_KEYS: Record<string, string> = {
  자산총계: "totalAssets",
  부채총계: "totalLiabilities",
  자본총계: "totalEquity",
  자본금: "capitalStock",
  유동자산: "currentAssets",
  비유동자산: "nonCurrentAssets",
  유동부채: "currentLiabilities",
  비유동부채: "nonCurrentLiabilities",
};

/** 손익계산서 주요 항목 (DART 계정명 변형 포함: 영업수익=매출액 등) */
const IS_KEYS: Record<string, string> = {
  매출액: "revenue",
  영업수익: "revenue",
  영업이익: "operatingIncome",
  당기순이익: "netIncome",
  매출총이익: "grossProfit",
  판매비와관리비: "sellingAndAdminExpenses",
};

/** 공백 제거한 계정명 → 우리 키. DART 응답이 "자산 총계" 등으로 올 수 있음 */
function buildNormalizedMap(keys: Record<string, string>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [accountName, ourKey] of Object.entries(keys)) {
    m.set(accountName, ourKey);
    const normalized = accountName.replace(/\s/g, "");
    if (normalized !== accountName) m.set(normalized, ourKey);
  }
  return m;
}
const BS_KEYS_NORM = buildNormalizedMap(BS_KEYS);
const IS_KEYS_NORM = buildNormalizedMap(IS_KEYS);

/** 괄호 및 내용 제거 후 매칭 (예: "매출액(수익)" → "매출액") */
function normalizeAccountName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/g, "").trim();
}

/** DART 리스트에서 발행주식수 추출 (PER/PBR 계산용). 계정과목명 변형·괄호제거 포함 */
const SHARES_ACCOUNT_NAMES = [
  "발행주식수",
  "유통주식수",
  "주식총수",
  "발행주식총수",
  "자기주식을 제외한 발행주식수",
  "자기주식제외발행주식수",
  "보통주발행주식수",
  "우선주발행주식수",
];
function pickSharesOutstanding(list: DartAccountItem[]): number | undefined {
  for (const item of list) {
    const raw = (item.account_nm ?? "").trim();
    const name = normalizeAccountName(raw).replace(/\s/g, "");
    for (const key of SHARES_ACCOUNT_NAMES) {
      if (raw === key || name === key.replace(/\s/g, "")) {
        const v = amountFrom(item);
        if (v > 0) return Math.round(v);
      }
    }
    // 괄호 안 제거 후 매칭 (예: "자기주식을 제외한 발행주식수 (보통주)")
    const base = raw.replace(/\s*\([^)]*\)\s*$/g, "").replace(/\s/g, "");
    if (base === "자기주식을제외한발행주식수" || base === "발행주식총수" || base === "발행주식수") {
      const v = amountFrom(item);
      if (v > 0) return Math.round(v);
    }
    // 발행·주식수 포함 항목 (과목명 변형 대응)
    if (/발행.*주식.*수/.test(raw) || /주식.*총.*수/.test(raw.replace(/\s/g, ""))) {
      const v = amountFrom(item);
      if (v > 0 && v < 1e15) return Math.round(v); // 주식수는 보통 억 단위 이하
    }
  }
  return undefined;
}

function pickByKeys(
  list: DartAccountItem[],
  keys: Record<string, string>,
  normalizedMap: Map<string, string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of list) {
    const raw = (item.account_nm ?? "").trim();
    const name = normalizeAccountName(raw);
    const noSpaces = name.replace(/\s/g, "");
    const ourKey =
      keys[raw] ?? keys[name] ?? normalizedMap.get(raw) ?? normalizedMap.get(name) ?? normalizedMap.get(noSpaces);
    if (ourKey) out[ourKey] = amountFrom(item);
  }
  return out;
}

/**
 * 재무비율 계산 (당기 수치 기준). PER/PBR은 주가·발행주식수 필요 시 별도.
 */
export function computeRatios(
  balanceSheet: Record<string, number>,
  incomeStatement: Record<string, number>,
  currentPrice?: number,
  sharesOutstanding?: number
): {
  profitability: { roe: number; roa: number; operatingMargin: number; netProfitMargin: number };
  stability: { debtRatio: number; currentRatio: number };
  growth: { revenueGrowth: number; netIncomeGrowth: number };
  other: { per: number; pbr: number };
} {
  const ta = balanceSheet.totalAssets || 0;
  const te = balanceSheet.totalEquity || 0;
  const tl = balanceSheet.totalLiabilities || 0;
  const ca = balanceSheet.currentAssets || 0;
  const cl = balanceSheet.currentLiabilities || 0;
  const rev = incomeStatement.revenue || 0;
  const op = incomeStatement.operatingIncome || 0;
  const ni = incomeStatement.netIncome || 0;

  const roe = te > 0 ? (ni / te) * 100 : 0;
  const roa = ta > 0 ? (ni / ta) * 100 : 0;
  const operatingMargin = rev > 0 ? (op / rev) * 100 : 0;
  const netProfitMargin = rev > 0 ? (ni / rev) * 100 : 0;
  const debtRatio = te > 0 ? (tl / te) * 100 : 0;
  const currentRatio = cl > 0 ? (ca / cl) * 100 : 0;

  let per = 0;
  let pbr = 0;
  if (currentPrice != null && currentPrice > 0 && sharesOutstanding != null && sharesOutstanding > 0) {
    const eps = sharesOutstanding > 0 ? ni / sharesOutstanding : 0;
    const bps = sharesOutstanding > 0 ? te / sharesOutstanding : 0;
    per = eps > 0 ? currentPrice / eps : 0;
    pbr = bps > 0 ? currentPrice / bps : 0;
  }

  return {
    profitability: { roe, roa, operatingMargin, netProfitMargin },
    stability: { debtRatio, currentRatio },
    growth: { revenueGrowth: 0, netIncomeGrowth: 0 },
    other: { per, pbr },
  };
}

/**
 * 종목코드(6자리)로 최근 사업연도 재무제표·비율 조회. 캐시는 API Route에서 처리.
 */
export async function getFinancialsByStockCode(
  stockCode: string,
  currentPrice?: number
): Promise<{
  balanceSheet: Record<string, number>;
  incomeStatement: Record<string, number>;
  ratios: ReturnType<typeof computeRatios>;
  bsnsYear: string;
  sharesOutstanding?: number;
} | null> {
  const corpCode = await getCorpCodeByStockCode(stockCode);
  if (!corpCode) return null;
  const year = new Date().getFullYear();
  let list: Awaited<ReturnType<typeof getFnlttSinglAcnt>> = [];
  let usedYear = year;
  for (let y = year; y >= year - 4; y--) {
    list = await getFnlttSinglAcnt(corpCode, String(y), "11011");
    if (list.length > 0) {
      usedYear = y;
      break;
    }
  }
  if (list.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[DART] getFinancialsByStockCode: empty list for corp=%s years %s..%s", corpCode, year, year - 4);
    }
    return null;
  }
  if (process.env.NODE_ENV === "development" && list.length > 0) {
    const names = list.slice(0, 30).map((i) => i.account_nm);
    console.log("[DART] fnlttSinglAcnt corp=%s year=%s listLen=%d sample account_nm=%s", corpCode, usedYear, list.length, JSON.stringify(names));
  }
  const balanceSheet = pickByKeys(list, BS_KEYS, BS_KEYS_NORM);
  const incomeStatement = pickByKeys(list, IS_KEYS, IS_KEYS_NORM);
  let sharesOutstanding = pickSharesOutstanding(list);
  // 발행주식수 항목이 없는 경우 자본금/액면가(5,000원)로 추정 (국내 상장사 다수 해당)
  if (sharesOutstanding == null && balanceSheet.capitalStock != null && balanceSheet.capitalStock > 0) {
    const estimated = Math.round(balanceSheet.capitalStock / 5000);
    if (estimated > 0 && estimated < 1e12) sharesOutstanding = estimated;
  }
  const ratios = computeRatios(balanceSheet, incomeStatement, currentPrice, sharesOutstanding);
  return {
    balanceSheet,
    incomeStatement,
    ratios,
    bsnsYear: String(usedYear),
    sharesOutstanding,
  };
}
