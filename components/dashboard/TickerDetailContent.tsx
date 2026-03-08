"use client";

import { useState, useMemo, useCallback, memo, Fragment, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Activity,
  BarChart2,
  Calendar,
  CircleDollarSign,
  FileText,
  LayoutList,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Table2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "@/lib/api-client";
import { useAnalysisSummary } from "@/hooks/useAnalysisSummary";
import { usePortfolioSummary } from "@/hooks/usePortfolioSummary";
import { useSheetData } from "@/hooks/useSheetData";
import { useFundamentalData } from "@/hooks/useFundamentalData";
import type { TickerDetailInfo, TechnicalIndicatorsResponse } from "@/types/api";
import type { SheetTransactionRow } from "@/types/sheet";

const formatFundamentalNum = (v: number) => {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}만`;
  return String(v);
};

/** KIS 비율/원시 객체에서 숫자 또는 문자열로 표시 */
const formatRatioVal = (v: unknown): string => {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isNaN(v) ? "—" : (v >= 1 || v <= -1 ? v.toFixed(1) : v.toFixed(2));
  if (typeof v === "string") return v;
  return String(v);
};

/** 추정실적(KIS) 전용: 금액은 formatFundamentalNum, 증감율은 %+색상, 나머지는 숫자 */
function formatEstimateVal(
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

/** 결산년월 포맷: 202509.0 → "2025.09" */
function formatStacYymm(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).replace(/\D/g, "").slice(0, 6);
  if (s.length !== 6) return null;
  return `${s.slice(0, 4)}.${s.slice(4, 6)}`;
}

/** 투자의견 제시일 포맷: 20260211 → "2026.02.11" */
function formatOpinionDate(v: unknown): string {
  if (v == null) return "—";
  const s = String(v).replace(/\D/g, "").slice(0, 8);
  if (s.length !== 8) return String(v);
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}

/** 의견 텍스트 → 매수/매도/중립 배지 스타일 */
function getOpinionBadgeClass(opinion: string | undefined): string {
  if (!opinion) return "bg-muted text-muted-foreground";
  const o = opinion.toUpperCase().replace(/\s/g, "");
  if (/BUY|매수|강력매수|추가매수/.test(o)) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30";
  if (/SELL|매도|강력매도|감소/.test(o)) return "bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30";
  if (/HOLD|중립|유지|보유/.test(o)) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30";
  return "bg-muted text-muted-foreground";
}

/** 투자자매매동향 일별 칼럼 영문키 → 한글 라벨 */
const INVESTOR_TRADE_DAILY_LABELS: Record<string, string> = {
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

/** 일별 매수매도체결량 칼럼 영문키 → 한글 라벨 */
const DAILY_TRADE_VOLUME_LABELS: Record<string, string> = {
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

function tradingColumnLabel(key: string, labels: Record<string, string>): string {
  return labels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 매매동향 셀 값 포맷: 8자리 일자 → YYYY-MM-DD, 숫자 → 천단위 구분·부호 */
function formatTradingVal(v: unknown): string {
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

/** 8자리 일자(YYYYMMDD) → 차트용 일자 라벨. 매매동향(KIS) 3종 차트 일자 포맷 통일: YYYY-MM-DD */
function tradingDateLabel(s: unknown): string {
  if (s == null) return "";
  const str = typeof s === "string" ? s : String(s);
  const norm = str.replace(/\D/g, "");
  if (norm.length >= 8) {
    const ymd = norm.slice(-8);
    return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  }
  return str;
}

/** 차트용 숫자 추출: number 또는 숫자 문자열(쉼표 제거) 파싱 */
function chartNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** 객체에서 여러 키 후보 중 첫 번째 유효한 값 반환 (숫자 0 허용) */
function pickKey<T>(r: Record<string, unknown>, keys: string[], fn: (v: unknown) => T): T {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(r, k)) continue;
    const val = r[k];
    if (val === undefined || val === null) continue;
    return fn(val);
  }
  return fn(undefined);
}

/** 첫 행의 키 중 패턴에 맞는 키 하나 반환 (대소문자 무시) */
function findKeyByPattern(keys: string[], pattern: RegExp): string | undefined {
  const lower = keys.map((k) => k.toLowerCase());
  for (let i = 0; i < keys.length; i++) {
    if (pattern.test(keys[i]!) || pattern.test(lower[i]!)) return keys[i];
  }
  return undefined;
}

/**
 * 날짜 문자열을 8자리 YYYYMMDD로 정규화 (차트 라벨/정렬 일관용).
 * - 8자리 이상: 뒤 8자리 사용 (00YYYYMMDD 등)
 * - 6자리: 20YYMMDD
 * - 4자리 MMDD: 현재 연도 붙여 YYYYMMDD (KIS가 MMDD만 줄 때 00001228이 되면 12/28이 20241208보다 작게 정렬되어 좌표가 12/28→12/8로 뒤바뀜)
 */
function normalizeDateStr(s: string): string {
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(-8);
  if (digits.length === 6) return `20${digits}`;
  if (digits.length === 4) {
    const y = new Date().getFullYear();
    return `${y}${digits}`;
  }
  return digits.padStart(8, "0");
}

/** 8자리 일자(YYYYMMDD) 문자열을 비교용 정수로. normalizeDateStr 적용 후 비교 */
function dateStrToSortKey(s: string): number {
  const norm = s ? normalizeDateStr(s) : "";
  if (!norm || norm.length !== 8) return 0;
  const n = parseInt(norm, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** 8자리 YYYYMMDD → YYYY-MM-DD */
function ymdToIso(ymd: string): string {
  if (ymd.length >= 8) return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  return ymd;
}

/**
 * 투자자별 매매동향 일별 → 누적 차트용 배열.
 * 1) 중복 날짜 제거(같은 날짜는 일별 수량 합산). 2) 날짜 오름차순 정렬. 3) 누적 변수로 합산.
 */
export type InvestorCumulativePoint = {
  date: string;
  personal_cum: number;
  inst_cum: number;
  foreign_cum: number;
};

function buildInvestorCumulativeChartData(
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

  const resolvedDate =
    findKeyByPattern(allKeys, /bsop|date|일자/) ?? dateKeys.find((k) => allKeys.includes(k));
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

/** 일별 매수·매도 체결량 → 차트 데이터. 최신이 오른쪽으로. 키 패턴으로 매수/매도/거래량 탐색 */
function buildDailyVolumeChartData(
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

/** OHLC 데이터에서 Y축 도메인 계산 — 최저/최고가에 여유를 두어 선이 잘리지 않게 */
function ohlcYDomain(
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

/** 주식현재가 일자별(KIS) → 시가/종가/고가/저가 박스차트용. 일자 오름차순, 최근 30일 */
function buildDailyOhlcChartData(
  rows: Record<string, unknown>[]
): { date: string; dateLabel: string; open: number; high: number; low: number; close: number; bodyHigh: number; bodyLow: number; isUp: boolean }[] {
  const dateKeys = ["stck_bsop_date", "stck_bsop_dt", "일자", "date"];
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

/** Record<string, unknown>에서 숫자형 키만 필터해 라벨 매핑. KIS 재무비율 API(FHKST66430300) 스펙 필드 포함 */
const RATIO_LABELS: Record<string, string> = {
  per: "PER", pbr: "PBR", eps: "EPS", bps: "BPS", roe: "ROE(%)", roa: "ROA(%)",
  prdy_per: "PER", prdy_pbr: "PBR", stck_per: "PER", stck_pbr: "PBR",
  stac_yymm: "결산년월", roe_val: "ROE(%)", sps: "주당매출액", rsrv_rate: "유보비율(%)", lblt_rate: "부채비율(%)",
  grs: "매출액증가율(%)", bsop_prfi_inrt: "영업이익증가율(%)", ntin_inrt: "순이익증가율(%)",
  op_rt: "영업이익률(%)", op_mgn: "영업이익률", net_rt: "순이익률", net_mgn: "순이익률",
  debt_rt: "부채비율(%)", cur_rt: "유동비율(%)", cpa_rt: "유동비율",
  rev_gr: "매출성장률(%)", inc_gr: "이익성장률(%)",
  cptl_ntin_rate: "자본순이익률", self_cptl_ntin_inrt: "자기자본순이익률", sale_ntin_rate: "매출순이익률", sale_totl_rate: "매출총이익률",
  bram_depn: "유동비율(배)", crnt_rate: "유동비율(%)", quck_rate: "당좌비율",
  equt_inrt: "자본증가율", totl_aset_inrt: "총자산증가율",
  payout_rate: "배당성향", eva: "EVA", ebitda: "EBITDA", ev_ebitda: "EV/EBITDA",
};

/** 비율(KIS) 카테고리별 표시용: 키·라벨·포맷. 결산년월(stac_yymm)은 카드 상단 배지로만 표시 */
const RATIO_KIS_GROUPS: { title: string; dataKey: keyof { financialRatio: unknown; profitRatio: unknown; stabilityRatio: unknown; growthRatio: unknown; otherMajorRatios: unknown }; items: { key: string; label: string; isAmount?: boolean; isRate?: boolean }[] }[] = [
  {
    title: "재무비율",
    dataKey: "financialRatio",
    items: [
      { key: "grs", label: "매출액증가율", isRate: true },
      { key: "bsop_prfi_inrt", label: "영업이익증가율", isRate: true },
      { key: "ntin_inrt", label: "순이익증가율", isRate: true },
      { key: "roe_val", label: "ROE", isRate: true },
      { key: "eps", label: "EPS", isAmount: true },
      { key: "sps", label: "주당매출액", isAmount: true },
      { key: "bps", label: "BPS", isAmount: true },
    ],
  },
  {
    title: "수익성비율",
    dataKey: "profitRatio",
    items: [
      { key: "cptl_ntin_rate", label: "자본순이익률", isRate: true },
      { key: "self_cptl_ntin_inrt", label: "자기자본순이익률", isRate: true },
      { key: "sale_ntin_rate", label: "매출순이익률", isRate: true },
      { key: "sale_totl_rate", label: "매출총이익률", isRate: true },
    ],
  },
  {
    title: "안정성비율",
    dataKey: "stabilityRatio",
    items: [
      { key: "lblt_rate", label: "부채비율", isRate: true },
      { key: "bram_depn", label: "유동비율(배)" },
      { key: "crnt_rate", label: "유동비율", isRate: true },
      { key: "quck_rate", label: "당좌비율" },
    ],
  },
  {
    title: "성장성비율",
    dataKey: "growthRatio",
    items: [
      { key: "grs", label: "매출액증가율", isRate: true },
      { key: "bsop_prfi_inrt", label: "영업이익증가율", isRate: true },
      { key: "equt_inrt", label: "자본증가율", isRate: true },
      { key: "totl_aset_inrt", label: "총자산증가율", isRate: true },
    ],
  },
  {
    title: "기타주요비율",
    dataKey: "otherMajorRatios",
    items: [
      { key: "payout_rate", label: "배당성향" },
      { key: "eva", label: "EVA", isAmount: true },
      { key: "ebitda", label: "EBITDA", isAmount: true },
      { key: "ev_ebitda", label: "EV/EBITDA" },
    ],
  },
];

/** 추정실적(KIS) 표시용: 그룹별 키·라벨·포맷. 중복(영문 동의어) 제외, 한글 우선 */
const ESTIMATE_PERFORM_GROUPS: { title: string; items: { key: string; label: string; isAmount?: boolean; isRate?: boolean }[] }[] = [
  {
    title: "추정손익계산서",
    items: [
      { key: "매출액", label: "매출액", isAmount: true },
      { key: "매출액증감율", label: "매출액 증감율", isRate: true },
      { key: "영업이익", label: "영업이익", isAmount: true },
      { key: "영업이익증감율", label: "영업이익 증감율", isRate: true },
      { key: "순이익", label: "순이익", isAmount: true },
      { key: "순이익증감율", label: "순이익 증감율", isRate: true },
    ],
  },
  {
    title: "투자지표",
    items: [
      { key: "EBITDA", label: "EBITDA", isAmount: true },
      { key: "EPS", label: "EPS(원)", isAmount: true },
      { key: "EPS증감율", label: "EPS 증감율", isRate: true },
      { key: "PER", label: "PER(배)" },
      { key: "EV/EBITDA", label: "EV/EBITDA(배)" },
      { key: "ROE", label: "ROE(%)", isRate: true },
      { key: "부채비율", label: "부채비율(%)", isRate: true },
      { key: "이자보상배율", label: "이자보상배율" },
    ],
  },
];
function toRatioNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}
/** 비율 지표만 (%·배수·비율). 레이더·막대에서 비율끼리 비교용. 유보비율(rsrv_rate) 제외 — 스케일이 커서 다른 비율이 안 보임 */
const RATIO_ONLY_KEYS = new Set([
  "roe_val", "roe", "roa", "grs", "bsop_prfi_inrt", "ntin_inrt", "lblt_rate", "debt_rt",
  "op_rt", "net_rt", "cur_rt", "crnt_rate", "quck_rate", "cpa_rt",
  "cptl_ntin_rate", "self_cptl_ntin_inrt", "sale_ntin_rate", "sale_totl_rate",
  "equt_inrt", "totl_aset_inrt", "payout_rate", "rev_gr", "inc_gr",
  "per", "prdy_per", "stck_per", "pbr", "prdy_pbr", "stck_pbr", "ev_ebitda",
]);
/** 값 지표만 (절대값: EPS, BPS, EBITDA 등). 막대에서 값끼리 비교용 */
const VALUE_ONLY_KEYS = new Set([
  "eps", "bps", "sps", "ebitda", "eva", "bram_depn",
]);

/** 레이더 차트용: 비율만 사용 (유보비율 제외 — 스케일이 커서 다른 비율이 안 보임) */
const RADAR_RATIO_KEYS: { key: string; label: string }[] = [
  { key: "roe_val", label: "ROE" },
  { key: "grs", label: "매출증가율" },
  { key: "bsop_prfi_inrt", label: "영업이익증가" },
  { key: "ntin_inrt", label: "순이익증가" },
  { key: "lblt_rate", label: "부채비율" },
];
function buildRadarDataFromRatio(rec: Record<string, unknown> | null): { subject: string; value: number; fullMark: number }[] {
  if (!rec || typeof rec !== "object") return [];
  const out: { subject: string; value: number; fullMark: number }[] = [];
  for (const { key, label } of RADAR_RATIO_KEYS) {
    const v = toRatioNum(rec[key]);
    if (v != null && !Number.isNaN(v)) {
      const num = Number(v);
      out.push({ subject: label, value: num, fullMark: Math.max(100, Math.ceil(num * 1.2)) });
    }
  }
  return out;
}
/** 여러 비율 레코드에서 비율 키만 모아 막대 차트용 */
function buildRatioOnlyBarData(recs: (Record<string, unknown> | null)[], maxItems = 12): { name: string; value: number }[] {
  const out: { name: string; value: number }[] = [];
  const seen = new Set<string>();
  for (const rec of recs) {
    if (!rec || typeof rec !== "object") continue;
    for (const key of Object.keys(rec)) {
      if (seen.has(key) || !RATIO_ONLY_KEYS.has(key) || key === "stac_yymm") continue;
      const v = toRatioNum(rec[key]);
      if (v != null && !Number.isNaN(v)) {
        seen.add(key);
        out.push({ name: RATIO_LABELS[key] ?? key, value: Number(v) });
        if (out.length >= maxItems) return out;
      }
    }
  }
  return out;
}
/** 여러 비율 레코드에서 값 키만 모아 막대 차트용 */
function buildValueOnlyBarData(recs: (Record<string, unknown> | null)[], maxItems = 10): { name: string; value: number }[] {
  const out: { name: string; value: number }[] = [];
  const seen = new Set<string>();
  for (const rec of recs) {
    if (!rec || typeof rec !== "object") continue;
    for (const key of Object.keys(rec)) {
      if (seen.has(key) || !VALUE_ONLY_KEYS.has(key) || key === "stac_yymm") continue;
      const v = toRatioNum(rec[key]);
      if (v != null && !Number.isNaN(v)) {
        seen.add(key);
        out.push({ name: RATIO_LABELS[key] ?? key, value: Number(v) });
        if (out.length >= maxItems) return out;
      }
    }
  }
  return out;
}
/** 비율(KIS) 단일 카드: 결산년월 배지 + 그룹 항목만 포맷·색상 적용 */
function renderRatioKisCard(
  title: string,
  data: Record<string, unknown> | null,
  items: { key: string; label: string; isAmount?: boolean; isRate?: boolean }[]
) {
  if (!data || typeof data !== "object") return null;
  const hasVal = (v: unknown) => v != null && v !== "" && (typeof v === "number" ? !Number.isNaN(v) : true);
  const getNum = (v: unknown): number | null => {
    if (v == null) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  };
  const shown = items.filter((item) => item.key !== "stac_yymm" && hasVal(data[item.key]));
  if (shown.length === 0) return null;
  const stacStr = formatStacYymm(data.stac_yymm);
  return (
    <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {stacStr && (
          <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground tabular-nums">
            기준 {stacStr}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        {shown.map((item) => {
          const raw = data[item.key];
          const num = getNum(raw);
          const isRate = item.isRate === true;
          const isPositive = num != null && num > 0;
          const isNegative = num != null && num < 0;
          const rateClass = isRate && isNegative
            ? "text-red-600 dark:text-red-400"
            : isRate && isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : "";
          const str = item.isAmount
            ? formatFundamentalNum(Number(raw))
            : isRate
              ? `${num}%`
              : formatRatioVal(raw);
          return (
            <div key={item.key} className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className={`font-semibold tabular-nums ${rateClass}`}>{str}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STALE_TIME_DETAIL_MS = 30 * 60 * 1000; // 상세정보 메모이제이션: 30분간 캐시 유지

function TickerDetailContentInner({ tickerOrCode }: { tickerOrCode: string }) {
  const isCode = /^\d{6}$/.test(tickerOrCode);
  const [revalidateTrigger, setRevalidateTrigger] = useState(0);
  const queryClient = useQueryClient();

  const stockInfoQuery = useQuery<TickerDetailInfo>({
    queryKey: ["kis", "stock-info", tickerOrCode],
    queryFn: async () => {
      const url = isCode
        ? `/api/kis/stock-info?code=${encodeURIComponent(tickerOrCode)}`
        : `/api/kis/stock-info?ticker=${encodeURIComponent(tickerOrCode)}`;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error("Failed to fetch stock info");
      return res.json();
    },
    enabled: !!tickerOrCode,
    staleTime: STALE_TIME_DETAIL_MS,
  });

  const code = stockInfoQuery.data?.code ?? "";
  const fundamentalData = useFundamentalData(code, revalidateTrigger);

  const indicatorsQuery = useQuery<TechnicalIndicatorsResponse>({
    queryKey: ["kis", "indicators", code ?? ""],
    queryFn: async () => {
      const res = await apiFetch(`/api/kis/indicators?code=${encodeURIComponent(code!)}`);
      if (!res.ok) throw new Error("Failed to fetch indicators");
      return res.json();
    },
    enabled: !!code,
    staleTime: STALE_TIME_DETAIL_MS,
  });

  const analysis = useAnalysisSummary();
  const portfolio = usePortfolioSummary();
  const sheet = useSheetData();

  const ticker = stockInfoQuery.data?.ticker ?? tickerOrCode;
  const analysisRow = useMemo(
    () => analysis.data?.tickers?.find((t) => t.ticker === ticker),
    [analysis.data?.tickers, ticker]
  );
  const position = useMemo(
    () => portfolio.data?.positions?.find((p) => p.ticker === ticker),
    [portfolio.data?.positions, ticker]
  );
  const transactions = useMemo(
    () => (sheet.data?.transactions ?? []).filter((r) => (r.Ticker || "").trim() === ticker),
    [sheet.data?.transactions, ticker]
  );

  /** AI 분석 요청용: 상세 정보 요약 + 최근 매매 일지. 페이지에 표시된 데이터를 그대로 전달해 서버 중복 호출을 줄임 */
  const aiContext = useMemo(() => {
    const parts: string[] = [];
    parts.push(`[종목] ${ticker} (코드 ${code})`);

    const priceInfoVal =
      stockInfoQuery.data?.priceInfo ?? fundamentalData.kis?.priceInfo ?? undefined;
    if (priceInfoVal) {
      const p = priceInfoVal;
      parts.push(
        `[시세] 현재가 ${p.stckPrpr.toLocaleString("ko-KR")}원, 전일대비 ${p.prdyVrss >= 0 ? "+" : ""}${p.prdyVrss} (${p.prdyCtrt}%)`
      );
    } else {
      parts.push("[시세] 시세 없음");
    }

    const kis = fundamentalData.kis;
    const ratio = kis?.financialRatio as Record<string, unknown> | null | undefined;
    const per = kis?.per ?? ratio?.per ?? ratio?.stck_per ?? ratio?.prdy_per;
    const pbr = kis?.pbr ?? ratio?.pbr ?? ratio?.stck_pbr ?? ratio?.prdy_pbr;
    const eps = kis?.eps ?? ratio?.eps ?? ratio?.stck_eps ?? ratio?.prdy_eps;
    const bps = kis?.bps ?? ratio?.bps ?? ratio?.stck_bps ?? ratio?.prdy_bps;
    const roe = ratio?.roe ?? ratio?.stck_roe;
    const roa = ratio?.roa ?? ratio?.stck_roa;
    const debtRt = ratio?.debt_rt ?? ratio?.debtRatio;
    const ratioLine = [
      per != null ? `PER ${formatRatioVal(per)}` : null,
      pbr != null ? `PBR ${formatRatioVal(pbr)}` : null,
      eps != null ? `EPS ${formatRatioVal(eps)}` : null,
      bps != null ? `BPS ${formatRatioVal(bps)}` : null,
      roe != null ? `ROE ${formatRatioVal(roe)}%` : null,
      roa != null ? `ROA ${formatRatioVal(roa)}%` : null,
      debtRt != null ? `부채비율 ${formatRatioVal(debtRt)}%` : null,
    ]
      .filter(Boolean)
      .join(", ");
    parts.push(`[가치지표] ${ratioLine || "없음"}`);

    const opinion = kis?.opinion?.tickerOpinion;
    if (opinion) {
      const target = opinion.targetPrice != null ? formatRatioVal(opinion.targetPrice) : "—";
      parts.push(
        `[투자의견] ${opinion.opinionName ?? ""} / 목표가 ${target} / 전망: ${opinion.outlook ?? "—"}`
      );
    } else {
      parts.push("[투자의견] 없음");
    }

    const multiYear = fundamentalData.dart?.multiYear ?? [];
    if (multiYear.length > 0) {
      const dartLines = multiYear.map((y) => {
        const is_ = y.incomeStatement as { revenue?: number; operatingIncome?: number; netIncome?: number };
        const rev = is_.revenue ?? 0;
        const op = is_.operatingIncome ?? 0;
        const net = is_.netIncome ?? 0;
        return `${y.year}: 매출 ${(rev ?? 0).toLocaleString("ko-KR")} / 영업이익 ${(op ?? 0).toLocaleString("ko-KR")} / 당기순이익 ${(net ?? 0).toLocaleString("ko-KR")}`;
      });
      parts.push("[재무 추이] DART 재무 추이 (최근 연도):\n" + dartLines.join("\n"));
    } else {
      parts.push("[재무 추이] 없음");
    }

    const ind = indicatorsQuery.data;
    if (ind) {
      const rsiStr = ind.rsi != null ? ind.rsi.toFixed(1) : "—";
      const macdStr =
        ind.macd != null
          ? `MACD ${ind.macd.macd.toFixed(2)} / Signal ${ind.macd.signal.toFixed(2)} / Histogram ${ind.macd.histogram.toFixed(2)}`
          : "—";
      parts.push(`[보조지표] RSI(14): ${rsiStr}, ${macdStr} (기준일 ${ind.date ?? "—"})`);
    } else {
      parts.push("[보조지표] 없음");
    }

    if (position && position.quantity > 0) {
      const avg = position.buyAmount / position.quantity;
      const rate =
        position.buyAmount > 0
          ? ((position.profitLoss / position.buyAmount) * 100).toFixed(1)
          : "—";
      parts.push(
        `[내 포트폴리오 - 해당 종목] 보유 수량 ${position.quantity.toLocaleString("ko-KR")}주, 평균 단가 ${avg.toFixed(0)}원, 평가금액 ${position.marketValue.toLocaleString("ko-KR")}원, 평가손익 ${position.profitLoss >= 0 ? "+" : ""}${position.profitLoss.toLocaleString("ko-KR")}원 (수익률 ${rate}%)`
      );
    } else {
      parts.push("[내 포트폴리오 - 해당 종목] 해당 종목 보유 없음");
    }

    const detailSummary = parts.join("\n");
    const journalEntries = [...transactions]
      .sort((a, b) => String(b.Date ?? "").localeCompare(String(a.Date ?? "")))
      .slice(0, 30)
      .map((r) => ({
        Date: String(r.Date ?? ""),
        Type: r.Type,
        Quantity: Number(r.Quantity) || 0,
        Price: Number(r.Price) || 0,
        Journal: r.Journal ? String(r.Journal) : undefined,
      }));
    return { detailSummary, journalEntries };
  }, [
    ticker,
    code,
    stockInfoQuery.data?.priceInfo,
    fundamentalData.kis,
    fundamentalData.dart?.multiYear,
    indicatorsQuery.data,
    position,
    transactions,
  ]);

  const priceInfo = useMemo(
    () =>
      stockInfoQuery.data?.priceInfo ??
      fundamentalData.kis?.priceInfo ??
      undefined,
    [stockInfoQuery.data?.priceInfo, fundamentalData.kis?.priceInfo]
  );
  const hasPosition = (position?.quantity ?? 0) > 0;
  const isRefreshing =
    stockInfoQuery.isRefetching || fundamentalData.isRefetching || indicatorsQuery.isRefetching;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["kis", "stock-info", tickerOrCode] });
    void queryClient.refetchQueries({ queryKey: ["kis", "stock-info", tickerOrCode] });
    if (code && /^\d{6}$/.test(code)) {
      setRevalidateTrigger((t) => t + 1); // fundamental: 새 queryKey로 fetch 시 revalidate=1 전달
      queryClient.invalidateQueries({ queryKey: ["fundamental", code] });
      queryClient.invalidateQueries({ queryKey: ["kis", "indicators", code] });
      void queryClient.refetchQueries({ queryKey: ["kis", "indicators", code] });
    }
  }, [queryClient, tickerOrCode, code]);

  /** AI 분석 결과 메모이제이션: 종목(code)별 캐시로 토큰 사용 최소화. 캐시 있으면 API 호출 생략 */
  const aiGuideQuery = useQuery({
    queryKey: ["ai", "trading-guide", code],
    queryFn: async () => {
      const body: { code: string; ticker: string; context?: { detailSummary: string; journalEntries: unknown[] } } = {
        code,
        ticker,
      };
      if (aiContext.detailSummary.trim()) {
        body.context = {
          detailSummary: aiContext.detailSummary,
          journalEntries: aiContext.journalEntries,
        };
      }
      const res = await apiFetch("/api/ai/trading-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { content?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "요청 실패");
      return { content: data.content ?? null };
    },
    enabled: false,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const aiContent = aiGuideQuery.data?.content ?? null;
  const aiError = aiGuideQuery.error?.message ?? null;
  const aiLoading = aiGuideQuery.isFetching;

  /** 캐시 있으면 재요청 생략(토큰 절약). "다시 분석"은 항상 재요청 */
  const requestAiGuide = useCallback(
    (forceRefetch = false) => {
      if (!code) return;
      if (!forceRefetch && aiGuideQuery.data != null) return; // 캐시 사용
      void aiGuideQuery.refetch();
    },
    [code, aiGuideQuery.data, aiGuideQuery.refetch]
  );

  const requestAiGuideRefresh = useCallback(() => {
    if (!code) return;
    void aiGuideQuery.refetch();
  }, [code, aiGuideQuery.refetch]);

  if (!tickerOrCode) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-6 text-muted-foreground shadow-sm">
        종목 코드 또는 종목명을 입력해 주세요.
      </div>
    );
  }

  if (stockInfoQuery.isPending && !stockInfoQuery.data) {
    return <div className="text-muted-foreground">로딩 중...</div>;
  }

  const info = stockInfoQuery.data;

  const sectionNavLinks: { href: string; label: string; icon: ReactNode }[] = [
    { href: "#section-quote", label: "시세", icon: <TrendingUp className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-valuation", label: "가치평가", icon: <CircleDollarSign className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-financial-kis", label: "재무", icon: <Table2 className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-ratio-kis", label: "비율", icon: <LayoutList className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-estimate-kis", label: "추정실적", icon: <Table2 className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-trade-kis", label: "매매동향", icon: <BarChart2 className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-opinion", label: "투자의견", icon: <MessageSquare className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-dart-income", label: "DART 손익", icon: <BarChart2 className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-cashflow", label: "현금흐름", icon: <Table2 className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-disclosure", label: "공시", icon: <FileText className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-portfolio", label: "포트폴리오", icon: <Wallet className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-indicators", label: "보조지표", icon: <Activity className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-ai-guide", label: "AI 분석", icon: <Sparkles className="w-3.5 h-3.5 shrink-0" /> },
    { href: "#section-journal", label: "매매 일지", icon: <Calendar className="w-3.5 h-3.5 shrink-0" /> },
  ];

  return (
    <div className="space-y-8">
      {/* Hero: 종목명 · 코드 · 현재가 · 전일대비 · 갱신 · 보유 요약 */}
      <header className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  {info?.ticker ?? tickerOrCode}
                </h1>
                <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                  {info?.code ?? "—"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">종목 상세 정보</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing || !code}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/70 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 shrink-0 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "갱신 중…" : "갱신"}
              </button>
              {priceInfo ? (
                <div className="text-right">
                  <p className="text-2xl md:text-3xl font-bold tabular-nums tracking-tight">
                    {priceInfo.stckPrpr.toLocaleString()}
                    <span className="text-lg font-normal text-muted-foreground ml-1">원</span>
                  </p>
                  <p className={`text-sm font-medium tabular-nums mt-0.5 ${priceInfo.prdyVrss >= 0 ? "text-profit" : "text-loss"}`}>
                    {priceInfo.prdyVrss >= 0 ? "+" : ""}
                    {priceInfo.prdyVrss.toLocaleString()}원
                    <span className="ml-1 opacity-90">
                      ({priceInfo.prdyCtrt >= 0 ? "+" : ""}
                      {priceInfo.prdyCtrt}%)
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">시세 없음</p>
              )}
            </div>
          </div>
          {hasPosition && position && (
            <div className="mt-6 pt-6 border-t border-border/50 flex flex-wrap gap-6 rounded-lg bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                보유 <span className="font-semibold text-foreground tabular-nums">{position.quantity.toLocaleString()}</span>주
              </span>
              <span className="text-sm text-muted-foreground">
                평가 <span className="font-semibold text-foreground tabular-nums">{position.marketValue.toLocaleString()}</span>원
              </span>
              <span className={`text-sm font-medium tabular-nums ${position.profitLoss >= 0 ? "text-profit" : "text-loss"}`}>
                평가손익 {position.profitLoss >= 0 ? "+" : ""}
                {position.profitLoss.toLocaleString()}원
              </span>
            </div>
          )}
        </div>
        <nav
          className="border-t border-border/50 bg-muted/20 px-4 py-3 overflow-x-auto scrollbar-thin"
          aria-label="이 페이지 내 섹션"
        >
          <div className="flex gap-1.5 min-w-max">
            {sectionNavLinks.map(({ href, label, icon }) => (
              <a
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/50 transition-colors whitespace-nowrap"
              >
                {icon}
                {label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      {/* 시세 요약 — 당일 시세·52주 구간 그룹·포맷·가독성 최적화 */}
      <section id="section-quote" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 shrink-0 text-muted-foreground" />
          시세 요약
        </h2>
        {!priceInfo && !info?.weekly52High && (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
            KIS API 연동 시 시세·52주 고저가 표시됩니다.
          </p>
        )}
        {(priceInfo || info?.weekly52High != null || info?.weekly52Low != null) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 당일 시세 */}
            {(priceInfo?.stckOprc != null || priceInfo?.stckHgpr != null || priceInfo?.stckLwpr != null || priceInfo?.acmlVol != null) && (
              <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">당일 시세</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
                  {priceInfo?.stckOprc != null && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">시가</span>
                      <span className="font-semibold tabular-nums">{priceInfo.stckOprc.toLocaleString()}</span>
                    </div>
                  )}
                  {priceInfo?.stckHgpr != null && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">고가</span>
                      <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">{priceInfo.stckHgpr.toLocaleString()}</span>
                    </div>
                  )}
                  {priceInfo?.stckLwpr != null && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">저가</span>
                      <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{priceInfo.stckLwpr.toLocaleString()}</span>
                    </div>
                  )}
                  {priceInfo?.acmlVol != null && priceInfo.acmlVol > 0 && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">거래량</span>
                      <span className="font-semibold tabular-nums" title={priceInfo.acmlVol.toLocaleString()}>
                        {formatFundamentalNum(priceInfo.acmlVol)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">주</span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* 52주 고저 */}
            {(info?.weekly52High != null || info?.weekly52Low != null) && (
              <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">52주</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {info?.weekly52High != null && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">52주 최고</span>
                      <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">{info.weekly52High.toLocaleString()}</span>
                    </div>
                  )}
                  {info?.weekly52Low != null && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">52주 최저</span>
                      <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{info.weekly52Low.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 가치평가 — KIS 기준·주요 지표 강조·실적 구분 */}
      <section id="section-valuation" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CircleDollarSign className="w-4 h-4 shrink-0 text-muted-foreground" />
            가치평가
          </h2>
          <span className="text-xs text-muted-foreground">최근 실적 반영 (KIS 기준)</span>
        </div>
        {(() => {
          const kis = fundamentalData.kis;
          const per = kis?.per ?? info?.per ?? null;
          const pbr = kis?.pbr ?? info?.pbr ?? null;
          const eps = kis?.eps ?? info?.eps ?? null;
          const bps = kis?.bps ?? info?.bps ?? null;
          const fmtNum = (n: number | null | undefined) =>
            n != null && n > 0 ? (n >= 1 ? n.toFixed(1) : n.toFixed(2)) : "—";
          const hasPer = per != null && per > 0;
          const hasPbr = pbr != null && pbr > 0;
          const hasAny = hasPer || hasPbr || (eps != null && eps > 0) || (bps != null && bps > 0) || (kis?.forwardEps != null && kis.forwardEps > 0);
          if (!hasAny) {
            return (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
                가치평가 데이터를 불러올 수 없습니다.
              </p>
            );
          }
          return (
            <div className="space-y-5">
              {/* PER · PBR — 한눈에 보는 핵심 */}
              <div className="rounded-lg border-2 border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  주요 지표
                </p>
                <div className="flex flex-wrap gap-8">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">PER</span>
                    <span className="text-2xl font-bold tabular-nums tracking-tight">
                      {fmtNum(per)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">배</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">PBR</span>
                    <span className="text-2xl font-bold tabular-nums tracking-tight">
                      {fmtNum(pbr)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">배</span>
                    </span>
                  </div>
                </div>
              </div>
              {/* EPS · BPS · Forward EPS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border border-border/50 bg-muted/10 p-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">EPS</span>
                  <span className="font-semibold tabular-nums text-lg">
                    {eps != null && eps > 0 ? Math.round(eps).toLocaleString() : "—"}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">원</span>
                  </span>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/10 p-4 flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">BPS</span>
                  <span className="font-semibold tabular-nums text-lg">
                    {bps != null && bps > 0 ? Math.round(bps).toLocaleString() : "—"}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">원</span>
                  </span>
                </div>
                {kis?.forwardEps != null && kis.forwardEps > 0 && (
                  <div className="rounded-lg border border-border/50 bg-muted/10 p-4 flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Forward EPS</span>
                    <span className="font-semibold tabular-nums text-lg">
                      {Math.round(kis.forwardEps).toLocaleString()}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">원</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </section>

      {/* 재무 요약 (KIS) — 재무상태·손익 한눈에, 차트 비교 */}
      <section id="section-financial-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Table2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            재무 요약 (KIS)
          </h2>
        </div>
        {(() => {
          const kis = fundamentalData.kis;
          const bs = kis?.balanceSheet;
          const inc = kis?.incomeStatement;
          const hasBs = bs && (bs.totalAssets != null || bs.totalLiabilities != null || bs.totalEquity != null);
          const hasInc = inc && (inc.revenue != null || inc.operatingIncome != null || inc.netIncome != null);
          const hasAny = hasBs || hasInc;
          if (!hasAny) {
            return (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
                KIS 재무 데이터를 가져올 수 없습니다. (일부 종목은 미제공)
              </p>
            );
          }
          const bsItems = [
            { key: "totalAssets" as const, label: "자산총계" },
            { key: "totalLiabilities" as const, label: "부채총계" },
            { key: "totalEquity" as const, label: "자본총계" },
            { key: "currentAssets" as const, label: "유동자산" },
            { key: "currentLiabilities" as const, label: "유동부채" },
          ].filter((item) => bs && bs[item.key] != null);
          const incItems = [
            { key: "revenue" as const, label: "매출액" },
            { key: "operatingIncome" as const, label: "영업이익" },
            { key: "netIncome" as const, label: "당기순이익" },
          ].filter((item) => inc && inc[item.key] != null);
          const bsChartData: { name: string; value: number; label: string }[] = [];
          if (bs) {
            if (bs.totalAssets != null) bsChartData.push({ name: "자산총계", value: bs.totalAssets, label: formatFundamentalNum(bs.totalAssets) });
            if (bs.totalLiabilities != null) bsChartData.push({ name: "부채총계", value: bs.totalLiabilities, label: formatFundamentalNum(bs.totalLiabilities) });
            if (bs.totalEquity != null) bsChartData.push({ name: "자본총계", value: bs.totalEquity, label: formatFundamentalNum(bs.totalEquity) });
            if (bs.currentAssets != null) bsChartData.push({ name: "유동자산", value: bs.currentAssets, label: formatFundamentalNum(bs.currentAssets) });
            if (bs.currentLiabilities != null) bsChartData.push({ name: "유동부채", value: bs.currentLiabilities, label: formatFundamentalNum(bs.currentLiabilities) });
          }
          const incChartData: { name: string; value: number; label: string }[] = [];
          if (inc) {
            if (inc.revenue != null) incChartData.push({ name: "매출액", value: inc.revenue, label: formatFundamentalNum(inc.revenue) });
            if (inc.operatingIncome != null) incChartData.push({ name: "영업이익", value: inc.operatingIncome, label: formatFundamentalNum(inc.operatingIncome) });
            if (inc.netIncome != null) incChartData.push({ name: "당기순이익", value: inc.netIncome, label: formatFundamentalNum(inc.netIncome) });
          }
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 재무상태 — 대차대조표 */}
                {hasBs && bs && bsItems.length > 0 && (
                  <div className="rounded-lg border-2 border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      재무상태 (대차대조표)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4">
                      {bsItems.map((item) => (
                        <div key={item.key} className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                          <span className="text-lg font-bold tabular-nums tracking-tight">
                            {formatFundamentalNum(bs[item.key]!)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* 손익 — 손익계산서 */}
                {hasInc && inc && incItems.length > 0 && (
                  <div className="rounded-lg border-2 border-border/50 bg-gradient-to-br from-muted/30 to-muted/10 p-5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      손익 (손익계산서)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-4">
                      {incItems.map((item) => (
                        <div key={item.key} className="flex flex-col gap-1">
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                          <span className="text-lg font-bold tabular-nums tracking-tight">
                            {formatFundamentalNum(inc[item.key]!)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {(bsChartData.length > 0 || incChartData.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {bsChartData.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">대차대조표 비교</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={bsChartData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" tickFormatter={(v) => formatFundamentalNum(v)} dataKey="value" />
                          <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number | undefined) => formatFundamentalNum(v ?? 0)} labelFormatter={(name) => name} />
                          <Bar dataKey="value" name="금액" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {incChartData.length > 0 && (
                    <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">손익계산서 비교</h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={incChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={(v) => formatFundamentalNum(v)} />
                          <Tooltip formatter={(v: number | undefined) => formatFundamentalNum(v ?? 0)} labelFormatter={(name) => name} />
                          <Bar dataKey="value" name="금액" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* 비율 (KIS) — 그룹별 카드·결산년월·포맷·증감율 색상 최적화 + 차트 */}
      {(() => {
        const kis = fundamentalData.kis;
        const finRatio = (kis?.financialRatio ?? null) as Record<string, unknown> | null;
        const allRatioRecs = [
          finRatio,
          kis?.profitRatio ?? null,
          kis?.stabilityRatio ?? null,
          kis?.growthRatio ?? null,
          kis?.otherMajorRatios ?? null,
        ] as (Record<string, unknown> | null)[];
        const radarData = buildRadarDataFromRatio(finRatio);
        const ratioOnlyBarData = buildRatioOnlyBarData(allRatioRecs);
        const valueOnlyBarData = buildValueOnlyBarData(allRatioRecs);
        const ratioCards = RATIO_KIS_GROUPS.map((group) => {
          const data = kis?.[group.dataKey] as Record<string, unknown> | null;
          const card = renderRatioKisCard(group.title, data, group.items);
          if (!card) return null;
          return <Fragment key={group.title}>{card}</Fragment>;
        });
        const hasAny = ratioCards.some((c) => c != null);
        const hasCharts = radarData.length >= 3 || ratioOnlyBarData.length >= 2 || valueOnlyBarData.length >= 2;
        return (
          <section id="section-ratio-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
              <LayoutList className="w-4 h-4 shrink-0 text-muted-foreground" />
              비율 (KIS)
            </h2>
            {!hasAny && (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
                KIS 비율 데이터를 가져올 수 없습니다. (일부 종목은 미제공)
              </p>
            )}
            {hasAny && (
              <div className="space-y-4">
                {hasCharts && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {radarData.length >= 3 && (
                      <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">비율 비교 (레이더)</h3>
                        <ResponsiveContainer width="100%" height={260}>
                          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                            <PolarGrid stroke="hsl(var(--border))" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                            <PolarRadiusAxis angle={90} tick={{ fontSize: 10 }} tickFormatter={(v) => String(v)} />
                            <Radar name="비율" dataKey="value" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.4} />
                            <Tooltip formatter={(v: number | undefined) => v != null ? `${v}%` : ""} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {ratioOnlyBarData.length >= 2 && (
                      <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">비율만 비교 (%)</h3>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={ratioOnlyBarData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-24} textAnchor="end" height={44} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                            <Tooltip formatter={(v: number | undefined) => v != null ? `${v}%` : ""} />
                            <Bar dataKey="value" name="비율" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {valueOnlyBarData.length >= 2 && (
                      <div className="rounded-lg border border-border/50 bg-muted/10 p-4">
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">값만 비교 (EPS·BPS 등)</h3>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={valueOnlyBarData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-24} textAnchor="end" height={44} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 1e8 ? `${(v / 1e8).toFixed(0)}억` : v >= 1e4 ? `${(v / 1e4).toFixed(0)}만` : String(v))} />
                            <Tooltip formatter={(v: number | undefined) => formatRatioVal(v)} />
                            <Bar dataKey="value" name="값" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ratioCards}
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {/* 추정실적 (KIS) — 그룹별·포맷·증감율 색상 최적화 */}
      {fundamentalData.kis && (
        <section id="section-estimate-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <Table2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            추정실적 (KIS)
          </h2>
          {(!fundamentalData.kis.estimatePerform || Object.keys(fundamentalData.kis.estimatePerform).length === 0) ? (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
              KIS 추정실적 데이터를 가져올 수 없습니다. (일부 종목은 미제공)
            </p>
          ) : (() => {
            const ep = fundamentalData.kis!.estimatePerform as Record<string, unknown>;
            const hasVal = (v: unknown) => v != null && v !== "" && (typeof v === "number" ? !Number.isNaN(v) : true);
            const getNum = (v: unknown): number | null => {
              if (v == null) return null;
              const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
              return Number.isNaN(n) ? null : n;
            };
            return (
              <div className="space-y-4">
                {ESTIMATE_PERFORM_GROUPS.map((group) => {
                  const shown = group.items.filter((item) => hasVal(ep[item.key]));
                  if (shown.length === 0) return null;
                  return (
                    <div key={group.title} className="rounded-lg border border-border/50 bg-muted/10 p-4">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">{group.title}</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-3">
                        {shown.map((item) => {
                          const raw = ep[item.key];
                          const num = getNum(raw);
                          const isRate = item.isRate === true;
                          const isPositive = num != null && num > 0;
                          const isNegative = num != null && num < 0;
                          const rateClass = isRate && isNegative
                            ? "text-red-600 dark:text-red-400"
                            : isRate && isPositive
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "";
                          const str = formatEstimateVal(raw, {
                            isAmount: item.isAmount,
                            isRate: item.isRate,
                          });
                          return (
                            <div key={item.key} className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground">{item.label}</span>
                              <span className={`font-semibold tabular-nums ${rateClass}`}>{str}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>
      )}

      {/* 매매동향 (KIS) — 투자자매매동향·일별 체결량 (가치투자 참고) */}
      {(() => {
        const kis = fundamentalData.kis;
        const daily = kis?.investorTradeDaily ?? [];
        const vol = kis?.dailyTradeVolume ?? [];
        const dailyPrice = kis?.dailyPrice ?? [];
        const hasDaily = Array.isArray(daily) && daily.length > 0;
        const hasVol = Array.isArray(vol) && vol.length > 0;
        const hasOhlc = Array.isArray(dailyPrice) && dailyPrice.length > 0;
        const hasAny = hasDaily || hasVol || hasOhlc;
        return (
          <section id="section-trade-kis" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            매매동향 (KIS)
          </h2>
            {!hasAny && (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
                KIS 매매동향 데이터를 가져올 수 없습니다. (일부 종목·기간은 미제공)
              </p>
            )}
            {hasAny && (
            <div className="space-y-8">
              {hasOhlc && (() => {
                const ohlcData = buildDailyOhlcChartData(dailyPrice as Record<string, unknown>[]);
                if (ohlcData.length === 0) return null;
                const [yMin, yMax] = ohlcYDomain(ohlcData);
                return (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">주식현재가 일자별 (최근 30일) — 시가·종가·고가·저가</h3>
                    <p className="text-xs text-muted-foreground mb-2">시가·종가·고가·저가 각각 연결 선차트</p>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={ohlcData} margin={{ top: 10, right: 12, left: 12, bottom: 6 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                          <XAxis
                            dataKey="dateLabel"
                            tick={{ fontSize: 10 }}
                            interval={Math.max(0, Math.floor(ohlcData.length / 8))}
                            axisLine={{ strokeWidth: 1 }}
                          />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v))}
                            domain={[yMin, yMax]}
                            width={44}
                            axisLine={false}
                            tickLine={true}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.[0]?.payload) return null;
                              const p = payload[0].payload as (typeof ohlcData)[0];
                              return (
                                <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
                                  <p className="font-medium text-foreground mb-1">{p.date}</p>
                                  <p>시가 {p.open.toLocaleString("ko-KR")}</p>
                                  <p>고가 {p.high.toLocaleString("ko-KR")}</p>
                                  <p>저가 {p.low.toLocaleString("ko-KR")}</p>
                                  <p>종가 {p.close.toLocaleString("ko-KR")}</p>
                                </div>
                              );
                            }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="open" name="시가" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} connectNulls />
                          <Line type="monotone" dataKey="high" name="고가" stroke="hsl(var(--color-profit))" strokeWidth={1.5} dot={false} connectNulls />
                          <Line type="monotone" dataKey="low" name="저가" stroke="hsl(var(--color-loss))" strokeWidth={1.5} dot={false} connectNulls />
                          <Line type="monotone" dataKey="close" name="종가" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}
              {!hasDaily && hasVol && (
                <p className="text-xs text-muted-foreground">투자자 매매동향 (일별) 데이터는 이 종목/기간에 제공되지 않습니다.</p>
              )}
              {hasDaily && daily.length > 0 && (() => {
                const chartData = buildInvestorCumulativeChartData(daily as Record<string, unknown>[]);
                if (chartData.length === 0) {
                  return (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">투자자별 매매동향 (일별) — 누적 순매수량 (최근 30일)</h3>
                      <p className="text-xs text-muted-foreground">최근 30일 데이터가 없습니다.</p>
                    </div>
                  );
                }
                return (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">투자자별 매매동향 (일별) — 누적 순매수량 (최근 30일)</h3>
                    <p className="text-xs text-muted-foreground mb-2">최근 30일 누적. 양수: 순매수, 음수: 순매도.</p>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 10 }}
                            interval={Math.max(0, Math.floor(chartData.length / 8))}
                          />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(0)}만` : v <= -10000 ? `${(v / 10000).toFixed(0)}만` : String(v))}
                          />
                          <Tooltip
                            formatter={(value: number | undefined) => [value != null ? value.toLocaleString("ko-KR") : "", ""]}
                            labelFormatter={(_, payload) => (payload?.[0]?.payload as { date?: string } | undefined)?.date ?? ""}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="personal_cum" name="개인 순매수 누적" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="inst_cum" name="기관 순매수 누적" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="foreign_cum" name="외국인 순매수 누적" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}
              {hasVol && vol.length > 0 && (() => {
                const chartData = buildDailyVolumeChartData(vol as Record<string, unknown>[]);
                return (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">일별 매수·매도 체결량 (최근 30일)</h3>
                    <p className="text-xs text-muted-foreground mb-2">최근 30일 일별 매수·매도 체결량 추이입니다.</p>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => (v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v))} />
                          <Tooltip
                            formatter={(value: number | undefined) => [value != null ? value.toLocaleString("ko-KR") : "", ""]}
                            labelFormatter={(_, payload) => (payload?.[0]?.payload as { dateLabel?: string; date?: string } | undefined)?.dateLabel ?? payload?.[0]?.payload?.date ?? ""}
                          />
                          <Legend />
                          <Bar dataKey="매수" name="매수 체결량" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="매도" name="매도 체결량" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}
            </div>
            )}
          </section>
        );
      })()}

      {/* 투자의견 (KIS) — 요약·배지·날짜 포맷·테이블 UX 최적화 */}
      <section id="section-opinion" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
            투자의견
          </h2>
          <span className="text-xs text-muted-foreground">참고용 정보 · 투자 권유 아님</span>
        </div>
        {fundamentalData.isPending && !fundamentalData.kis ? (
          <p className="text-sm text-muted-foreground">로딩 중…</p>
        ) : fundamentalData.error ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
            투자의견을 불러올 수 없습니다.
          </p>
        ) : (() => {
          const opinion = fundamentalData.kis?.opinion;
          const ticker = opinion?.tickerOpinion;
          const brokers = opinion?.brokerOpinions ?? [];
          const hasAny = ticker || brokers.length > 0;
          const withPrice = brokers.filter((b) => b.targetPrice != null && b.targetPrice > 0);
          const avgPrice =
            withPrice.length > 0
              ? Math.round(withPrice.reduce((a, b) => a + (b.targetPrice ?? 0), 0) / withPrice.length)
              : 0;
          if (!hasAny) {
            return (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border bg-muted/10 p-4">
                이 종목은 KIS 투자의견 데이터가 제공되지 않을 수 있습니다. (일부 종목은 증권사 DB 미제공)
              </p>
            );
          }
          return (
            <div className="space-y-5">
              {/* 대표 의견 — 한눈에 보는 요약 */}
              {ticker && (
                <div className="rounded-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    대표 의견
                  </p>
                  <div className="flex flex-wrap items-end gap-6">
                    {(ticker.opinionName || ticker.outlook) && (
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${getOpinionBadgeClass(ticker.opinionName ?? ticker.outlook)}`}
                      >
                        {ticker.opinionName ?? ticker.outlook}
                      </span>
                    )}
                    {ticker.targetPrice != null && ticker.targetPrice > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">목표가</p>
                        <p className="text-2xl font-bold tabular-nums tracking-tight">
                          {ticker.targetPrice.toLocaleString()}
                          <span className="ml-1 text-base font-normal text-muted-foreground">원</span>
                        </p>
                      </div>
                    )}
                    {ticker.date && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">제시일</p>
                        <p className="text-sm font-medium tabular-nums text-foreground">
                          {formatOpinionDate(ticker.date)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 컨센서스 한 줄 요약 */}
              {brokers.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {brokers.length}개 증권사
                  </span>
                  {avgPrice > 0 && (
                    <span>
                      평균 목표가 <span className="font-semibold tabular-nums text-foreground">{avgPrice.toLocaleString()}원</span>
                    </span>
                  )}
                </div>
              )}

              {/* 증권사별 테이블 */}
              {brokers.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-muted/10 overflow-hidden">
                  <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border/60">
                        <tr>
                          <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[28%] min-w-[80px]">
                            증권사
                          </th>
                          <th className="py-3 px-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[22%] min-w-[72px]">
                            의견
                          </th>
                          <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[28%] min-w-[90px]">
                            목표가
                          </th>
                          <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[22%] min-w-[88px]">
                            제시일
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {brokers.map((row, i) => (
                          <tr
                            key={i}
                            className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-2.5 px-4 font-medium text-foreground">
                              {row.brokerName ?? "—"}
                            </td>
                            <td className="py-2.5 px-4">
                              {row.opinion ? (
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${getOpinionBadgeClass(row.opinion)}`}
                                >
                                  {row.opinion}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold tabular-nums">
                              {row.targetPrice != null && row.targetPrice > 0
                                ? `${row.targetPrice.toLocaleString()}원`
                                : "—"}
                            </td>
                            <td className="py-2.5 px-4 text-right text-muted-foreground tabular-nums text-xs">
                              {row.date ? formatOpinionDate(row.date) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* 차트: DART 매출·영업이익·당기순이익 (최근 5개년) */}
      {(fundamentalData.dart?.multiYear?.length ?? 0) > 0 && (() => {
        const multiYear = fundamentalData.dart!.multiYear!;
        const chartData = multiYear.map((y) => ({
          year: y.year,
          매출액: y.incomeStatement?.revenue ?? 0,
          영업이익: y.incomeStatement?.operatingIncome ?? 0,
          당기순이익: y.incomeStatement?.netIncome ?? 0,
        }));
        if (chartData.every((r) => !r.매출액 && !r.영업이익 && !r.당기순이익)) return null;
        return (
          <section id="section-dart-income" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm" key="fundamental-chart">
            <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            매출·영업이익·당기순이익 (DART 최근 5개년)
          </h2>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis tickFormatter={formatFundamentalNum} className="text-xs" />
                  <Tooltip formatter={(v: number | undefined) => formatFundamentalNum(v ?? 0)} />
                  <Legend />
                  <Bar dataKey="매출액" fill="hsl(var(--chart-1))" name="매출액" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="영업이익" fill="hsl(var(--chart-2))" name="영업이익" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="당기순이익" fill="hsl(var(--chart-3))" name="당기순이익" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        );
      })()}

      {/* 현금흐름 (DART 5개년) */}
      {(fundamentalData.dart?.multiYear?.length ?? 0) > 0 && (() => {
        const cfRows = fundamentalData.dart!.multiYear!.map((y) => ({
          year: y.year,
          영업: y.cashFlow?.operating ?? 0,
          투자: y.cashFlow?.investing ?? 0,
          재무: y.cashFlow?.financing ?? 0,
        }));
        if (cfRows.every((r) => !r.영업 && !r.투자 && !r.재무)) return null;
        return (
          <section id="section-cashflow" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm" key="cashflow">
            <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
            <Table2 className="w-4 h-4 shrink-0 text-muted-foreground" />
            현금흐름 (영업·투자·재무, DART 5개년)
          </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-3 text-left text-xs font-medium text-muted-foreground">연도</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">영업활동</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">투자활동</th>
                    <th className="p-3 text-right text-xs font-medium text-muted-foreground">재무활동</th>
                  </tr>
                </thead>
                <tbody>
                  {cfRows.map((row) => (
                    <tr key={row.year} className="border-b border-border/60">
                      <td className="p-3">{row.year}</td>
                      <td className={`p-3 text-right ${(row.영업 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatFundamentalNum(row.영업 ?? 0)}
                      </td>
                      <td className={`p-3 text-right ${(row.투자 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatFundamentalNum(row.투자 ?? 0)}
                      </td>
                      <td className={`p-3 text-right ${(row.재무 ?? 0) >= 0 ? "text-profit" : "text-loss"}`}>
                        {formatFundamentalNum(row.재무 ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })()}

      {/* 공시: 링크만 제공. 상세 내용은 DART에서 확인 */}
      <section id="section-disclosure" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
          공시
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          공시 상세 내용은 아래 링크에서 확인할 수 있습니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {fundamentalData.dart?.preliminaryLink ? (
            <a
              href={fundamentalData.dart.preliminaryLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm font-medium hover:bg-muted/80"
            >
              최근 잠정실적 공시 (DART) ↗
            </a>
          ) : null}
          <a
            href="https://dart.fss.or.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-4 py-2.5 text-sm font-medium hover:bg-muted/80"
          >
            DART 공시검색 ↗
          </a>
        </div>
      </section>

      {/* 내 포트폴리오 (해당 종목) */}
      <section id="section-portfolio" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
        <Wallet className="w-4 h-4 shrink-0 text-muted-foreground" />
        내 포트폴리오
      </h2>
        {analysisRow || position ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {analysisRow && (
              <>
                <div>
                  <p className="text-muted-foreground">매수 횟수</p>
                  <p>{analysisRow.buyCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">매도 횟수</p>
                  <p>{analysisRow.sellCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">총 매수금액</p>
                  <p>{analysisRow.totalBuyAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">총 매도금액</p>
                  <p>{analysisRow.totalSellAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">실현손익</p>
                  <p className={analysisRow.realizedPnL >= 0 ? "text-profit" : "text-loss"}>
                    {Math.round(analysisRow.realizedPnL).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">실현수익률</p>
                  <p className={analysisRow.realizedRate >= 0 ? "text-profit" : "text-loss"}>
                    {analysisRow.realizedRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">승률</p>
                  <p>{analysisRow.winRate.toFixed(1)}%</p>
                </div>
              </>
            )}
            {position && (
              <>
                <div>
                  <p className="text-muted-foreground">보유 수량</p>
                  <p>{position.quantity.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">평균 단가</p>
                  <p>
                    {position.quantity > 0
                      ? (position.buyAmount / position.quantity).toFixed(0)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">평가금액</p>
                  <p>{position.marketValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">평가손익</p>
                  <p className={position.profitLoss >= 0 ? "text-profit" : "text-loss"}>
                    {position.profitLoss.toLocaleString()}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">이 종목의 매매 이력이 없습니다.</p>
        )}
      </section>

      {/* 보조지표 — RSI, MACD (KIS 일봉 기반) */}
      <section id="section-indicators" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
        <Activity className="w-4 h-4 shrink-0 text-muted-foreground" />
        보조지표
      </h2>
        <p className="text-xs text-muted-foreground mb-4">
          KIS 일봉 데이터 기반 RSI(14), MACD(12,26,9) — 참고용이며 투자 권유가 아닙니다.
        </p>
        {indicatorsQuery.isPending && !indicatorsQuery.data ? (
          <p className="text-sm text-muted-foreground">로딩 중…</p>
        ) : indicatorsQuery.error ? (
          <p className="text-sm text-muted-foreground">보조지표를 불러올 수 없습니다.</p>
        ) : indicatorsQuery.data ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            {indicatorsQuery.data.date && (
              <div>
                <p className="text-muted-foreground">기준일</p>
                <p>{indicatorsQuery.data.date}</p>
              </div>
            )}
            {indicatorsQuery.data.rsi != null ? (
              <div>
                <p className="text-muted-foreground">RSI(14)</p>
                <p>
                  {indicatorsQuery.data.rsi.toFixed(1)}
                  {indicatorsQuery.data.rsi >= 70 && (
                    <span className="ml-1 text-xs text-muted-foreground">(과매수)</span>
                  )}
                  {indicatorsQuery.data.rsi <= 30 && (
                    <span className="ml-1 text-xs text-muted-foreground">(과매도)</span>
                  )}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground">RSI(14)</p>
                <p>—</p>
              </div>
            )}
            {indicatorsQuery.data.macd ? (
              <>
                <div>
                  <p className="text-muted-foreground">MACD</p>
                  <p>{indicatorsQuery.data.macd.macd.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">시그널</p>
                  <p>{indicatorsQuery.data.macd.signal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">히스토그램</p>
                  <p>{indicatorsQuery.data.macd.histogram.toFixed(2)}</p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-muted-foreground">MACD</p>
                <p>—</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">KIS 연동 후 일봉 데이터로 계산됩니다.</p>
        )}
      </section>

      {/* AI 분석 및 매매 가이드 (OpenAI) — UI/UX 최적화 */}
      <section
        id="section-ai-guide"
        className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm"
        aria-busy={aiLoading}
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-primary/80" aria-hidden />
            AI 분석 및 매매 가이드
          </h2>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80 bg-muted/50 px-2 py-1 rounded">
            참고용
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          시세·가치평가·보조지표·최근 매매 일지를 바탕으로 투자전략 요약과 매매 가이드(참고)를 생성합니다. 매수/매도 권유가 아닙니다.
        </p>

        {/* 액션: 분석 요청 / 다시 분석 */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => requestAiGuide()}
            disabled={!code || aiLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-opacity"
          >
            {aiLoading ? (
              <>
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
                <span>분석 중…</span>
              </>
            ) : (
              <span>AI 분석 요청</span>
            )}
          </button>
          {aiContent && !aiLoading && (
            <button
              type="button"
              onClick={requestAiGuideRefresh}
              disabled={!code}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden />
              <span>다시 분석</span>
            </button>
          )}
        </div>

        {/* 에러: 재시도 가능 */}
        {aiError && (
          <div
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            <p className="font-medium mb-1">분석을 불러올 수 없습니다</p>
            <p className="text-muted-foreground text-xs mb-3">{aiError}</p>
            <button
              type="button"
              onClick={requestAiGuideRefresh}
              disabled={!code || aiLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3 shrink-0" /> 다시 시도
            </button>
          </div>
        )}

        {/* 로딩: 레이아웃 유지용 플레이스홀더 */}
        {aiLoading && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-6 min-h-[180px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin opacity-60" aria-hidden />
            <p className="text-sm">AI가 분석 중입니다. 잠시만 기다려 주세요.</p>
            <div className="flex gap-2 w-full max-w-[280px]">
              <div className="h-2 flex-1 rounded-full bg-muted animate-pulse" />
              <div className="h-2 flex-1 rounded-full bg-muted animate-pulse" />
              <div className="h-2 w-12 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
        )}

        {/* 빈 상태: 첫 요청 유도 */}
        {!aiContent && !aiLoading && !aiError && (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-5 text-center">
            <p className="text-sm text-muted-foreground mb-3">아래 버튼을 누르면 이 종목에 대한 분석을 생성합니다.</p>
            <ul className="text-xs text-muted-foreground/90 text-left max-w-sm mx-auto mb-4 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" /> 시세·가치지표·투자의견
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" /> 재무 추이·보조지표
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" /> 내 포트폴리오·최근 매매 일지
              </li>
            </ul>
            <button
              type="button"
              onClick={() => requestAiGuide()}
              disabled={!code}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              AI 분석 요청
            </button>
          </div>
        )}

        {/* 결과: 마크다운 가독성 + 스크롤 */}
        {aiContent && !aiLoading && (
          <div
            className="rounded-lg border border-border/60 bg-muted/10 overflow-hidden"
            role="region"
            aria-label="AI 분석 결과"
          >
            <div className="max-h-[420px] overflow-y-auto p-4 sm:p-5">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-h2:text-sm prose-h2:mt-4 prose-h2:mb-2 prose-h2:pb-1 prose-h2:border-b prose-h2:border-border/60 prose-p:text-muted-foreground prose-p:leading-relaxed prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-foreground">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <h2>{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xs font-medium mt-3 mb-1 text-foreground">{children}</h3>,
                    p: ({ children }) => <p className="text-sm">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5">{children}</ol>,
                  }}
                >
                  {aiContent}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 하단 — 최근 매매 일지 (UI/UX 최적화) */}
      <section id="section-journal" className="rounded-2xl border border-border/50 bg-card p-6 scroll-mt-6 shadow-sm">
        <div className="mb-2">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
            최근 매매 일지
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            이 종목에 대한 Google 시트 매매 내역입니다. 최신순으로 표시됩니다.
          </p>
        </div>

        {transactions.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-muted-foreground">
              <span>총 {transactions.length}건</span>
              <span>
                매수 {transactions.filter((r) => r.Type === "매수").length}건 / 매도 {transactions.filter((r) => r.Type === "매도").length}건
              </span>
            </div>
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <div className="max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-[2px] border-b border-border/60">
                    <tr>
                      <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground min-w-[7rem] whitespace-nowrap">일자</th>
                      <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground w-[72px]">구분</th>
                      <th className="py-2.5 px-3 text-right text-xs font-medium text-muted-foreground">수량</th>
                      <th className="py-2.5 px-3 text-right text-xs font-medium text-muted-foreground">단가</th>
                      <th className="py-2.5 px-3 text-right text-xs font-medium text-muted-foreground">금액</th>
                      <th className="py-2.5 px-3 text-left text-xs font-medium text-muted-foreground min-w-[100px]">비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...transactions]
                      .sort((a, b) => String(b.Date ?? "").localeCompare(String(a.Date ?? "")))
                      .map((row, i) => {
                        const amount = (row.Quantity || 0) * (row.Price || 0);
                        const isBuy = row.Type === "매수";
                        return (
                          <tr
                            key={i}
                            className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-2.5 px-3 text-foreground tabular-nums whitespace-nowrap">{row.Date}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                  isBuy
                                    ? "bg-profit/10 text-profit dark:bg-profit/20 dark:text-profit"
                                    : "bg-loss/10 text-loss dark:bg-loss/20 dark:text-loss"
                                }`}
                              >
                                {row.Type}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums">{row.Quantity.toLocaleString("ko-KR")}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums">{row.Price.toLocaleString("ko-KR")}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                              {amount.toLocaleString("ko-KR")}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground text-xs max-w-[180px] truncate" title={row.Journal || undefined}>
                              {row.Journal?.trim() || (row.Tags?.trim() ? `#${row.Tags}` : "—")}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
            {(transactions.some((r) => (r.Fee ?? 0) !== 0 || (r.Tax ?? 0) !== 0)) && (
              <p className="text-[10px] text-muted-foreground mt-2">
                * 수수료·세금이 있는 건은 시트에서 확인할 수 있습니다.
              </p>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border/80 bg-muted/5 p-6 text-center">
            <Calendar className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" aria-hidden />
            <p className="text-sm font-medium text-muted-foreground mb-1">이 종목의 매매 내역이 없습니다</p>
            <p className="text-xs text-muted-foreground/80">Google 시트에 매수/매도 기록을 추가하면 여기에 표시됩니다.</p>
          </div>
        )}
      </section>
    </div>
  );
}

/** 상세정보 메모이제이션: tickerOrCode 동일 시 리렌더 최소화. 재무·시세 갱신 시에만 전체 재요청 */
export const TickerDetailContent = memo(TickerDetailContentInner);
