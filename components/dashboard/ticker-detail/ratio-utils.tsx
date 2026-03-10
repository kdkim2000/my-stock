import React from "react";
import { formatFundamentalNum, formatRatioVal, formatStacYymm } from "./utils";
import { RATIO_ONLY_KEYS, VALUE_ONLY_KEYS, RATIO_LABELS } from "./constants";
import { toRatioNum } from "@/lib/utils";

/** 레이더 차트용: 비율만 사용 (유보비율 제외 — 스케일이 커서 다른 비율이 안 보임) */
const RADAR_RATIO_KEYS: { key: string; label: string }[] = [
  { key: "roe_val", label: "ROE" },
  { key: "grs", label: "매출증가율" },
  { key: "bsop_prfi_inrt", label: "영업이익증가" },
  { key: "ntin_inrt", label: "순이익증가" },
  { key: "lblt_rate", label: "부채비율" },
];

export function buildRadarDataFromRatio(rec: Record<string, unknown> | null): { subject: string; value: number; fullMark: number }[] {
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
export function buildRatioOnlyBarData(recs: (Record<string, unknown> | null)[], maxItems = 12): { name: string; value: number }[] {
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
export function buildValueOnlyBarData(recs: (Record<string, unknown> | null)[], maxItems = 10): { name: string; value: number }[] {
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
export function renderRatioKisCard(
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
