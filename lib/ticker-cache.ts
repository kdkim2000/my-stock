/**
 * _TICKER_CACHE_ Google Sheets 캐시 계층
 *
 * KIS/DART API 응답을 Google Sheets에 영속적으로 캐싱하여
 * Vercel 서버리스 환경의 콜드스타트 문제를 해결합니다.
 *
 * 시트 구조: | code(A) | section(B) | data(C) | updatedAt(D) |
 *
 * 장중(09:00-15:30 KST): 30분 TTL
 * 장 마감 후:             다음 장 시작(익일 09:00)까지 캐시 유지
 *
 * 성능: globalThis 기반 인메모리 rows 캐시(60초 TTL)로 페이지 로드당
 *       Sheets API 호출 횟수를 N회 → 1회로 줄입니다.
 */

import { getSheetsAuth, type Auth } from "./google-sheets";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_TAB = "_TICKER_CACHE_";

/** 캐시 섹션 이름 */
export type TickerCacheSection =
  | "fundamental"
  | "ratios"
  | "estimate"
  | "trading"
  | "indicators"
  | "opinion";

export interface TickerCacheEntry<T = unknown> {
  code: string;
  section: TickerCacheSection;
  data: T;
  updatedAt: string; // ISO string
}

// ---------------------------------------------------------------------------
// 인메모리 rows 캐시 (Sheets API 중복 호출 방지)
// ---------------------------------------------------------------------------

const ROWS_CACHE_KEY = "__TICKER_CACHE_ROWS__" as const;
const ROWS_CACHE_TTL_MS = 60 * 1000; // 60초

type RowsCache = {
  rows: unknown[][];
  fetchedAt: number;
  promise: Promise<unknown[][]> | null;
};

function getRowsCache(): RowsCache {
  const g = globalThis as unknown as Record<string, RowsCache>;
  if (!g[ROWS_CACHE_KEY]) {
    g[ROWS_CACHE_KEY] = { rows: [], fetchedAt: 0, promise: null };
  }
  return g[ROWS_CACHE_KEY];
}

/**
 * _TICKER_CACHE_ 시트 전체 행을 반환한다.
 * - 60초 이내 캐시가 있으면 메모리에서 즉시 반환 (Sheets API 호출 없음)
 * - 진행 중인 조회가 있으면 동일 Promise를 공유 (동시 호출 dedup)
 * - 만료 시 Sheets API 1회 호출 후 캐시 갱신
 */
async function fetchAllRows(auth: Auth): Promise<unknown[][]> {
  const rc = getRowsCache();

  // 진행 중인 Sheets 조회에 합류 (동시 N개 호출 → 1회 조회 공유)
  if (rc.promise) return rc.promise;

  // 60초 이내 유효 캐시
  if (rc.fetchedAt > 0 && Date.now() - rc.fetchedAt < ROWS_CACHE_TTL_MS) {
    if (process.env.NODE_ENV === "development") {
      console.log("[TickerCache] rows cache HIT (age=%dms)", Date.now() - rc.fetchedAt);
    }
    return rc.rows;
  }

  // Sheets API 호출 (Promise를 공유하여 동시 호출 dedup)
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) return [];

  rc.promise = (async (): Promise<unknown[][]> => {
    const range = encodeURIComponent(`'${SHEET_TAB}'!A:D`);
    const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } });
    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.log("[TickerCache] fetchAllRows: Sheets API %d", res.status);
      }
      return [];
    }
    const body = (await res.json()) as { values?: unknown[][] };
    return body.values ?? [];
  })()
    .then((rows) => {
      rc.rows = rows;
      rc.fetchedAt = Date.now();
      rc.promise = null;
      if (process.env.NODE_ENV === "development") {
        console.log("[TickerCache] rows cache MISS → fetched %d rows", rows.length);
      }
      return rows;
    })
    .catch(() => {
      rc.promise = null;
      return rc.rows; // 실패 시 기존 캐시 유지
    });

  return rc.promise;
}

/** 인메모리 rows 캐시에서 특정 행을 upsert (write 후 즉시 반영) */
function upsertRowInCache(
  code: string,
  section: string,
  dataStr: string,
  updatedAt: string
): void {
  const rc = getRowsCache();
  const newRow = [code, section, dataStr, updatedAt];
  const idx = rc.rows.findIndex(
    (r) => String(r[0]) === code && String(r[1]) === section
  );
  if (idx >= 0) {
    rc.rows[idx] = newRow;
  } else {
    rc.rows.push(newRow);
  }
}

// ---------------------------------------------------------------------------
// TTL 판정: 장중 30분, 장 마감 후 → 다음 장 시작까지
// ---------------------------------------------------------------------------

const MARKET_OPEN_HOUR = 9;   // 09:00 KST
const MARKET_CLOSE_HOUR = 15;
const MARKET_CLOSE_MINUTE = 30; // 15:30 KST
const INTRADAY_TTL_MS = 30 * 60 * 1000; // 30분

interface KstComponents {
  hours: number;
  minutes: number;
  day: number;   // 0=Sun, 6=Sat
  year: number;
  month: number; // 0-indexed
  date: number;
}

/** Intl 기반으로 현재 KST 구성 요소를 반환. 서버 timezone에 무관. */
function getKSTComponents(): KstComponents {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const WEEKDAY: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    hours: parseInt(get("hour")) % 24,
    minutes: parseInt(get("minute")),
    day: WEEKDAY[get("weekday")] ?? 0,
    year: parseInt(get("year")),
    month: parseInt(get("month")) - 1,
    date: parseInt(get("day")),
  };
}

/** 현재 KST가 장중(평일 09:00~15:30)인지 판단 */
function isMarketOpenNow(): boolean {
  const { hours, minutes, day } = getKSTComponents();
  if (day === 0 || day === 6) return false;
  const totalMin = hours * 60 + minutes;
  return totalMin >= MARKET_OPEN_HOUR * 60 && totalMin < MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;
}

/**
 * 다음 장 시작 UTC 타임스탬프(ms) 반환.
 * KST 09:00 = UTC 00:00이므로 Date.UTC(y, m, d, 0, 0, 0) = KST 09:00 UTC ms.
 *
 * - 평일 장 시작 전(00:00~08:59 KST): 오늘 KST 09:00
 * - 장 마감 후 또는 주말: 다음 거래일 KST 09:00
 */
function getNextMarketOpenUtcMs(): number {
  const { hours, minutes, day, year, month, date } = getKSTComponents();
  const totalMin = hours * 60 + minutes;

  // KST 09:00 = UTC 00:00 → Date.UTC(y, m, d, 0, 0, 0, 0)
  if (day !== 0 && day !== 6 && totalMin < MARKET_OPEN_HOUR * 60) {
    // 오늘 장 시작 전
    return Date.UTC(year, month, date, 0, 0, 0, 0);
  }

  // 다음 거래일 탐색 (Date.UTC는 월 overflow 자동 처리)
  let next = new Date(Date.UTC(year, month, date + 1, 0, 0, 0, 0));
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
  }
  return next.getTime();
}

/**
 * 캐시가 아직 유효한지 판단.
 * - 장중: updatedAt으로부터 30분 이내이면 유효
 * - 장 마감 후(평일 15:30 이후 또는 주말): 다음 장 시작 전까지 유효
 */
export function isCacheValid(updatedAtIso: string): boolean {
  const updatedAt = new Date(updatedAtIso).getTime();
  if (Number.isNaN(updatedAt)) return false;

  const now = Date.now();

  if (isMarketOpenNow()) {
    return now - updatedAt < INTRADAY_TTL_MS;
  }

  return now < getNextMarketOpenUtcMs();
}

// ---------------------------------------------------------------------------
// Sheets 읽기/쓰기
// ---------------------------------------------------------------------------

function getSpreadsheetId(): string | undefined {
  return process.env.GOOGLE_SPREADSHEET_ID?.trim();
}

/**
 * 특정 code+section의 캐시 조회. 유효하면 파싱된 데이터를 반환.
 *
 * 성능: fetchAllRows()를 통해 인메모리 rows 캐시를 활용하여
 *       동일 페이지 로드에서 발생하는 중복 Sheets API 호출을 방지합니다.
 */
export async function readTickerCache<T>(
  code: string,
  section: TickerCacheSection
): Promise<TickerCacheEntry<T> | null> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return null;

  try {
    const auth = await getSheetsAuth();
    const rows = await fetchAllRows(auth);

    for (const row of rows) {
      if (String(row[0]) === code && String(row[1]) === section) {
        const dataStr = String(row[2] ?? "");
        const updatedAt = String(row[3] ?? "");
        if (!dataStr || !updatedAt) return null;

        // TTL 검증
        if (!isCacheValid(updatedAt)) {
          if (process.env.NODE_ENV === "development") {
            console.log("[TickerCache] expired: code=%s section=%s updatedAt=%s", code, section, updatedAt);
          }
          return null;
        }

        try {
          const data = JSON.parse(dataStr) as T;
          return { code, section, data, updatedAt };
        } catch {
          return null;
        }
      }
    }
    return null;
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[TickerCache] read error:", e);
    }
    return null;
  }
}

/**
 * 캐시 저장. 기존 행이 있으면 업데이트, 없으면 추가.
 * 응답을 지연시키지 않도록 비동기로 호출하세요.
 *
 * 성능: 인메모리 rows 캐시에서 행 인덱스를 찾아 검색용 Sheets API 호출을 제거합니다.
 *       (기존 2회 → 1회 Sheets API 호출)
 */
export async function writeTickerCache(
  code: string,
  section: TickerCacheSection,
  data: unknown
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return;

  try {
    const auth = await getSheetsAuth();
    const headers = {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    };
    const updatedAt = new Date().toISOString();
    const dataStr = JSON.stringify(data);

    // 인메모리 rows 캐시에서 행 인덱스 탐색 (Sheets 검색 API 호출 불필요)
    const rc = getRowsCache();
    let rowIndex = -1;
    for (let i = 0; i < rc.rows.length; i++) {
      if (String(rc.rows[i][0]) === code && String(rc.rows[i][1]) === section) {
        rowIndex = i + 1; // Sheets는 1-indexed
        break;
      }
    }

    const rowValues = [[code, section, dataStr, updatedAt]];

    if (rowIndex > 0) {
      // 기존 행 업데이트
      const updateRange = encodeURIComponent(`'${SHEET_TAB}'!A${rowIndex}:D${rowIndex}`);
      await fetch(
        `${SHEETS_BASE}/${spreadsheetId}/values/${updateRange}?valueInputOption=RAW`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({ values: rowValues }),
        }
      );
    } else {
      // 신규 추가
      const appendRange = encodeURIComponent(`'${SHEET_TAB}'!A:D`);
      await fetch(
        `${SHEETS_BASE}/${spreadsheetId}/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ values: rowValues }),
        }
      );
    }

    // 인메모리 rows 캐시에 즉시 반영 (다음 readTickerCache 호출에서 최신 데이터 사용)
    upsertRowInCache(code, section, dataStr, updatedAt);

    if (process.env.NODE_ENV === "development") {
      console.log("[TickerCache] write: code=%s section=%s rowIndex=%d", code, section, rowIndex);
    }
  } catch (e) {
    // 저장 실패 무시 — 다음 요청 시 KIS API 재호출
    if (process.env.NODE_ENV === "development") {
      console.error("[TickerCache] write error:", e);
    }
  }
}
