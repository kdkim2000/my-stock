export function pickFirstOutput(body: Record<string, unknown>): Record<string, unknown> | null {
  for (const key of ["output", "output1", "output2"] as const) {
    const raw = body[key];
    if (raw == null) continue;
    if (Array.isArray(raw) && raw.length > 0) {
      const first = raw[0];
      if (first != null && typeof first === "object" && !Array.isArray(first))
        return first as Record<string, unknown>;
      continue;
    }
    if (typeof raw === "object" && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      const values = Object.values(obj);
      const firstObj = values.find((v) => v != null && typeof v === "object" && !Array.isArray(v));
      if (firstObj != null) return firstObj as Record<string, unknown>;
      if (Object.keys(obj).length > 0) return obj;
    }
  }
  return null;
}

const OPINION_ROW_KEYS = ["mbcr_name", "broker_nm", "invt_opnn", "hts_goal_prc", "stck_bsop_date", "stck_opnn_txt", "opinion", "stck_tgpr", "target_price", "stck_anal_dt", "date", "증권사명", "의견", "목표가", "제시일"];

export function extractListFromKisBody(body: Record<string, unknown>): unknown[] {
  for (const key of ["output", "output2"] as const) {
    const val = body[key];
    if (Array.isArray(val)) return val;
    if (val != null && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const entries = Object.values(obj);
      const nestedArray = entries.find(Array.isArray);
      if (nestedArray) return nestedArray as unknown[];
      if (entries.length > 0 && entries.every((e) => e != null && typeof e === "object"))
        return entries;
      const keys = Object.keys(obj);
      if (keys.some((k) => OPINION_ROW_KEYS.includes(k))) return [obj];
      if (keys.length > 0) return [obj];
    }
  }
  if (Array.isArray(body)) return body;
  return [];
}

export function toKisDate00(dateInput: string | Date): string {
  if (dateInput instanceof Date) {
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, "0");
    const d = String(dateInput.getDate()).padStart(2, "0");
    return `00${y}${m}${d}`;
  }
  const digits = String(dateInput).replace(/\D/g, "");
  const yyyymmdd = digits.length >= 8 ? digits.slice(-8) : digits.padStart(8, "0");
  return `00${yyyymmdd}`;
}

export function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}

export function getLast3MonthsKisDates(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  return { start: toKisDate00(start), end: toKisDate00(end) };
}

export function getLast90DaysKisDates(): { startYmd: string; endYmd: string; startKis: string; endKis: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  const startYmd = dateToYmd(startDate);
  const endYmd = dateToYmd(endDate);
  if (startYmd >= endYmd) {
    const fallbackStart = new Date();
    fallbackStart.setDate(fallbackStart.getDate() - 91);
    return {
      startYmd: dateToYmd(fallbackStart),
      endYmd,
      startKis: toKisDate00(fallbackStart),
      endKis: toKisDate00(endDate),
    };
  }
  return {
    startYmd,
    endYmd,
    startKis: toKisDate00(startDate),
    endKis: toKisDate00(endDate),
  };
}

export function getLatestQuarterEnd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const q = Math.floor(m / 3) + 1;
  const lastMonth = q * 3 - 1;
  const lastDay = new Date(y, lastMonth + 1, 0).getDate();
  return `${y}${String(lastMonth + 1).padStart(2, "0")}${String(lastDay).padStart(2, "0")}`;
}
