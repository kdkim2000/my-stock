/**
 * 펀더멘털 분석 전용 DART 연동 — 3대 재무제표(B/S, I/S, C/F), 다년도 데이터, 공시 문서 파싱 뼈대
 * 기존 lib/dart-api.ts의 getCorpCodeByStockCode, getFnlttSinglAcnt 활용
 */

import {
  getCorpCodeByStockCode,
  getFnlttSinglAcnt,
  type DartAccountItem,
} from "@/lib/dart-api";

function parseNum(s: unknown): number {
  if (s == null || s === "") return 0;
  const v = String(s).replace(/,/g, "");
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function amountFrom(item: DartAccountItem): number {
  const s = item.thstrm_amount ?? item.thstrm_q_amount ?? "";
  return parseNum(s);
}

function normalizeAccountName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/g, "").trim().replace(/\s/g, "");
}

/** 대차대조표 (기존 + 현금및현금성자산) */
const BS_KEYS: Record<string, string> = {
  자산총계: "totalAssets",
  부채총계: "totalLiabilities",
  자본총계: "totalEquity",
  유동자산: "currentAssets",
  비유동자산: "nonCurrentAssets",
  유동부채: "currentLiabilities",
  비유동부채: "nonCurrentLiabilities",
  현금및현금성자산: "cashAndEquivalents",
  차입금: "borrowings",
};

/** 손익계산서 (기존 + 감가상각비) */
const IS_KEYS: Record<string, string> = {
  매출액: "revenue",
  영업수익: "revenue",
  영업이익: "operatingIncome",
  당기순이익: "netIncome",
  매출총이익: "grossProfit",
  판매비와관리비: "sellingAndAdminExpenses",
  감가상각비: "depreciation",
  무형자산상각비: "amortization",
};

/** 현금흐름표 */
const CF_KEYS: Record<string, string> = {
  영업활동으로인한현금흐름: "operating",
  "영업활동으로 인한 현금흐름": "operating",
  투자활동으로인한현금흐름: "investing",
  "투자활동으로 인한 현금흐름": "investing",
  재무활동으로인한현금흐름: "financing",
  "재무활동으로 인한 현금흐름": "financing",
};

function pickFromList(
  list: DartAccountItem[],
  keys: Record<string, string>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of list) {
    const raw = (item.account_nm ?? "").trim();
    const normalized = normalizeAccountName(raw);
    for (const [key, ourKey] of Object.entries(keys)) {
      if (raw === key || normalized === key.replace(/\s/g, "")) {
        out[ourKey] = amountFrom(item);
        break;
      }
    }
  }
  return out;
}

export interface FundamentalBalanceSheet {
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  currentAssets?: number;
  nonCurrentAssets?: number;
  currentLiabilities?: number;
  nonCurrentLiabilities?: number;
  cashAndEquivalents?: number;
  borrowings?: number;
}

export interface FundamentalIncomeStatement {
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
  grossProfit?: number;
  depreciation?: number;
  amortization?: number;
}

export interface FundamentalCashFlow {
  operating?: number;
  investing?: number;
  financing?: number;
}

export interface FundamentalYearData {
  year: string;
  balanceSheet: FundamentalBalanceSheet;
  incomeStatement: FundamentalIncomeStatement;
  cashFlow: FundamentalCashFlow;
}

export interface FundamentalFinancialsResponse {
  code: string;
  corpCode: string | null;
  latestYear: string;
  multiYear: FundamentalYearData[];
}

/** DART reprt_code: 3Q → 2Q → 1Q → 연간 순으로 최신 분기 데이터 우선 */
const REPRT_CODE_FALLBACK = ["11014", "11012", "11013", "11011"] as const;

/**
 * 최근 5개년 재무 트렌드 전용. 연도별로 11014(3Q)→11012(2Q)→11013(1Q)→11011(연간) 순으로 시도해
 * 데이터가 있는 가장 최신 분기 리포트만 사용.
 */
export async function getDartTrendOnly(
  stockCode: string
): Promise<{ code: string; corpCode: string | null; multiYear: FundamentalYearData[] } | null> {
  const code = String(stockCode ?? "").trim().padStart(6, "0");
  if (!/^\d{6}$/.test(code)) return null;

  const corpCode = await getCorpCodeByStockCode(code);
  if (!corpCode) return null;

  const year = new Date().getFullYear();
  const multiYear: FundamentalYearData[] = [];

  for (let y = year; y >= year - 4; y--) {
    let list: Awaited<ReturnType<typeof getFnlttSinglAcnt>> = [];
    let usedReprt = "";
    for (const reprtCode of REPRT_CODE_FALLBACK) {
      list = await getFnlttSinglAcnt(corpCode, String(y), reprtCode);
      if (list.length > 0) {
        usedReprt = reprtCode;
        break;
      }
    }
    if (list.length === 0) continue;

    const balanceSheet = pickFromList(list, BS_KEYS) as FundamentalBalanceSheet;
    const incomeStatement = pickFromList(list, IS_KEYS) as FundamentalIncomeStatement;
    const cashFlow = pickFromList(list, CF_KEYS) as FundamentalCashFlow;

    multiYear.push({
      year: String(y),
      balanceSheet,
      incomeStatement,
      cashFlow,
    });
    if (process.env.NODE_ENV === "development" && usedReprt) {
      console.log("[DART] getDartTrendOnly year=%s reprt=%s", y, usedReprt);
    }
  }

  if (multiYear.length === 0) return null;

  return { code, corpCode, multiYear };
}

/**
 * DART fnlttSinglAcnt로 B/S, I/S, C/F 추출 (최근 5개년)
 */
export async function getFundamentalFinancials(
  stockCode: string
): Promise<FundamentalFinancialsResponse | null> {
  const code = String(stockCode ?? "").trim().padStart(6, "0");
  if (!/^\d{6}$/.test(code)) return null;

  const corpCode = await getCorpCodeByStockCode(code);
  if (!corpCode) return null;

  const year = new Date().getFullYear();
  const multiYear: FundamentalYearData[] = [];

  for (let y = year; y >= year - 4; y--) {
    let list: Awaited<ReturnType<typeof getFnlttSinglAcnt>> = [];
    for (const reprtCode of REPRT_CODE_FALLBACK) {
      list = await getFnlttSinglAcnt(corpCode, String(y), reprtCode);
      if (list.length > 0) break;
    }
    if (list.length === 0) continue;

    const balanceSheet = pickFromList(list, BS_KEYS) as FundamentalBalanceSheet;
    const incomeStatement = pickFromList(list, IS_KEYS) as FundamentalIncomeStatement;
    const cashFlow = pickFromList(list, CF_KEYS) as FundamentalCashFlow;

    multiYear.push({
      year: String(y),
      balanceSheet,
      incomeStatement,
      cashFlow,
    });
  }

  if (multiYear.length === 0) return null;

  if (process.env.NODE_ENV === "development") {
    console.log("[DART] getFundamentalFinancials code=%s multiYear=%d years=%s", code, multiYear.length, multiYear.map((m) => m.year).join(","));
  }

  return {
    code,
    corpCode,
    latestYear: multiYear[0]!.year,
    multiYear,
  };
}

/** DART document.xml 파싱 — 사업의 내용, MD&A, 주석 등 텍스트 추출 */
export interface DartDocumentSections {
  businessOverview?: string;
  mda?: string;
  notes?: string;
}

const DART_DOCUMENT_BASE = "https://opendart.fss.or.kr/api";

/** list API 응답 항목 */
interface DartListEntry {
  rcept_no?: string;
  report_nm?: string;
  [key: string]: unknown;
}

/** list API: corp_code의 최근 사업보고서(A001) 접수번호 조회 */
async function getDartReportRceptNo(corpCode: string, key: string): Promise<string | null> {
  const url = `${DART_DOCUMENT_BASE}/list.json?crtfc_key=${encodeURIComponent(key)}&corp_code=${encodeURIComponent(corpCode)}&pblntf_detail_ty=A001&page_no=1&page_count=5`;
  const res = await fetch(url);
  if (!res.ok) {
    if (process.env.NODE_ENV === "development") {
      console.log("[DART] getDartReportRceptNo: HTTP %d corp=%s", res.status, corpCode);
    }
    return null;
  }
  const data = (await res.json()) as { status?: string; list?: DartListEntry[]; message?: string };
  if (data.status !== "000" || !Array.isArray(data.list) || data.list.length === 0) {
    if (process.env.NODE_ENV === "development") {
      console.log("[DART] getDartReportRceptNo: no list corp=%s status=%s listLen=%s message=%s", corpCode, data.status ?? "(none)", Array.isArray(data.list) ? data.list.length : 0, data.message ?? "");
    }
    return null;
  }
  const rceptNo = data.list[0]?.rcept_no;
  const out = typeof rceptNo === "string" && rceptNo.trim() ? rceptNo.trim() : null;
  if (!out && process.env.NODE_ENV === "development") {
    console.log("[DART] getDartReportRceptNo: first item has no rcept_no corp=%s", corpCode);
  }
  return out;
}

const DART_VIEWER_BASE = "https://dart.fss.or.kr/dsaf001/main.do";

/**
 * 최근 2개월 내 잠정실적 공시 링크 조회. list.json에 bgn_de/end_de로 기간 제한 후 report_nm에 '잠정' 포함 건 사용.
 */
export async function getDartPreliminaryLink(corpCode: string): Promise<string | null> {
  const key = process.env.DART_API_KEY?.trim();
  if (!key) return null;
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 2);
  const bgnDe = start.toISOString().slice(0, 10).replace(/-/g, "");
  const endDe = end.toISOString().slice(0, 10).replace(/-/g, "");
  const url = `${DART_DOCUMENT_BASE}/list.json?crtfc_key=${encodeURIComponent(key)}&corp_code=${encodeURIComponent(corpCode)}&bgn_de=${bgnDe}&end_de=${endDe}&page_no=1&page_count=100`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string; list?: DartListEntry[] };
    if (data.status !== "000" || !Array.isArray(data.list)) return null;
    const found = data.list.find(
      (e) => typeof e.report_nm === "string" && e.report_nm.includes("잠정")
    );
    const rceptNo = found?.rcept_no;
    if (typeof rceptNo !== "string" || !rceptNo.trim()) return null;
    return `${DART_VIEWER_BASE}?rcpNo=${encodeURIComponent(rceptNo.trim())}`;
  } catch {
    return null;
  }
}

/**
 * DART 잠정실적 링크 + 사업보고서 문서(MD&A 등). corpCode 필요.
 */
export async function getDartPreliminaryAndDocument(corpCode: string): Promise<{
  preliminaryLink: string | null;
  document: DartDocumentSections;
}> {
  const [preliminaryLink, document] = await Promise.all([
    getDartPreliminaryLink(corpCode),
    getDartDocumentSections(corpCode),
  ]);
  return { preliminaryLink, document };
}

/** document API: ZIP 다운로드 후 사업보고서 XML(00760) 추출 및 텍스트 반환 */
async function fetchAndExtractDocumentXml(rceptNo: string, key: string): Promise<string | null> {
  const url = `${DART_DOCUMENT_BASE}/document.xml?crtfc_key=${encodeURIComponent(key)}&rcept_no=${encodeURIComponent(rceptNo)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(buf);
  const entries = zip.getEntries();
  const rceptBase = rceptNo.replace(/-/g, "");
  const targetEntry = entries.find(
    (e) => !e.isDirectory && (e.entryName.includes("00760") || e.entryName === `${rceptBase}_00760.xml`)
  );
  if (!targetEntry) return null;
  const raw = targetEntry.getData();
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
  let text: string;
  try {
    text = buffer.toString("utf-8");
    const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
    if (replacementCount > 10) {
      const iconv = await import("iconv-lite");
      text = iconv.decode(buffer, "euc-kr");
    }
  } catch {
    const iconv = await import("iconv-lite");
    text = iconv.decode(buffer, "euc-kr");
  }
  return text;
}

/** XML/HTML 태그 제거 후 텍스트만 반환 */
function stripTags(xml: string): string {
  return xml
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 사업보고서 본문에서 섹션별 텍스트 추출 (헤더 키워드 기준) */
function parseDocumentSections(xmlText: string): DartDocumentSections {
  const text = stripTags(xmlText);
  const out: DartDocumentSections = {};

  const sectionMarkers: { key: keyof DartDocumentSections; start: string; nextStarts: string[] }[] = [
    { key: "businessOverview", start: "사업의 내용", nextStarts: ["이사의 경영진단", "이사의 경영진단 (MD&A)", "제2절"] },
    { key: "mda", start: "이사의 경영진단", nextStarts: ["재무제표 등에 대한 주석", "주석", "제3절", "부록"] },
    { key: "notes", start: "재무제표 등에 대한 주석", nextStarts: ["부록", "별표", "제4절"] },
  ];

  for (const { key, start, nextStarts } of sectionMarkers) {
    const idx = text.indexOf(start);
    if (idx === -1) {
      if (key === "notes" && !out.notes) {
        const notesIdx = text.indexOf("주석", Math.floor(text.length * 0.2));
        if (notesIdx !== -1) {
          const content = text.slice(notesIdx).trim().slice(0, 50000);
          if (content.length > 50) out.notes = content;
        }
      }
      continue;
    }
    let endIdx = text.length;
    const afterStart = text.slice(idx + start.length);
    for (const next of nextStarts) {
      const nextIdx = afterStart.indexOf(next);
      if (nextIdx !== -1 && nextIdx < endIdx) endIdx = nextIdx;
    }
    const slice = text.slice(idx, idx + start.length + endIdx).trim();
    const content = slice.length > 50 ? slice : undefined;
    if (content) out[key] = content.slice(0, 50000);
  }

  return out;
}

/**
 * 최근 사업보고서 문서 목록 조회 후 document.xml 다운로드·파싱.
 * list API로 rcept_no 획득 → document API로 ZIP 다운로드 → 00760.xml 추출 → 사업의 내용/MD&A/주석 추출.
 */
export async function getDartDocumentSections(
  corpCode: string,
  rceptNo?: string
): Promise<DartDocumentSections> {
  const key = process.env.DART_API_KEY?.trim();
  if (!key) return {};

  try {
    const rcept = rceptNo ?? (await getDartReportRceptNo(corpCode, key));
    if (!rcept) {
      if (process.env.NODE_ENV === "development") {
        console.log("[DART] getDartDocumentSections: no rcept_no for corp=%s", corpCode);
      }
      return {};
    }
    const xmlText = await fetchAndExtractDocumentXml(rcept, key);
    if (!xmlText) {
      if (process.env.NODE_ENV === "development") {
        console.log("[DART] getDartDocumentSections: no XML for rcept_no=%s", rcept);
      }
      return {};
    }
    const sections = parseDocumentSections(xmlText);
    if (process.env.NODE_ENV === "development") {
      const keys = Object.keys(sections).filter((k) => (sections as Record<string, unknown>)[k]);
      if (keys.length > 0) {
        console.log("[DART] getDartDocumentSections corp=%s rcept=%s sections=%s", corpCode, rcept, keys.join(","));
      }
    }
    return sections;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[DART] getDartDocumentSections error:", e);
    }
    return {};
  }
}
