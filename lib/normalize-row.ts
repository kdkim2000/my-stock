import type { SheetTransactionRow, RawSheetRow } from "@/types/sheet";

import { parseNum } from "./utils";

/** Google Sheets/Excel 날짜 serial(1899-12-30 기준 일수) → YYYY-MM-DD */
function serialToDateString(serial: number): string {
  const d = new Date((serial - 25569) * 86400 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 일자 셀 정규화. 시트가 UNFORMATTED_VALUE 로 날짜를 serial 숫자로 주면 YYYY-MM-DD 로 변환.
 */
function formatDateCell(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "number") {
    if (v >= 1 && v < 1000000) return serialToDateString(Math.floor(v));
    return String(v);
  }
  return String(v).trim();
}

/**
 * 시트 Row 파싱 시 null/undefined → 0 또는 "" 로 치환 (PRD §6 빈 값 처리)
 */
export function normalizeRow(raw: RawSheetRow): SheetTransactionRow {
  const get = (i: number, def: string | number): string | number => {
    const v = raw[i];
    if (v === undefined || v === null || v === "") return def;
    return v;
  };
  return {
    Date: formatDateCell(raw[0]),
    Ticker: String(get(1, "")),
    Type: String(get(2, "매수")) as "매수" | "매도",
    Quantity: parseNum(raw[3]),
    Price: parseNum(raw[4]),
    Fee: parseNum(raw[5]),
    Tax: parseNum(raw[6]),
    Journal: String(get(7, "")),
    Tags: String(get(8, "")),
  };
}

export function normalizeRows(rawRows: RawSheetRow[]): SheetTransactionRow[] {
  return rawRows.map(normalizeRow);
}
