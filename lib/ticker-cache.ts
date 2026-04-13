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
// TTL 판정: 장중 30분, 장 마감 후 → 다음 장 시작까지
// ---------------------------------------------------------------------------

const MARKET_OPEN_HOUR = 9;  // 09:00 KST
const MARKET_CLOSE_HOUR = 15;
const MARKET_CLOSE_MINUTE = 30; // 15:30 KST
const INTRADAY_TTL_MS = 30 * 60 * 1000; // 30분

/**
 * 현재 한국 시간을 반환 (서버 시간대와 무관하게 KST 기준).
 */
function getKSTNow(): Date {
  const utc = new Date();
  // UTC → KST (+9h)
  return new Date(utc.getTime() + 9 * 60 * 60 * 1000);
}

/**
 * 주어진 KST 시각이 장중인지 판단.
 * - 평일(월~금)
 * - 09:00 ≤ t < 15:30
 */
function isMarketOpen(kst: Date): boolean {
  const day = kst.getUTCDay(); // getUTCDay because kst is offset-adjusted
  if (day === 0 || day === 6) return false; // 주말
  const h = kst.getUTCHours();
  const m = kst.getUTCMinutes();
  const totalMin = h * 60 + m;
  return totalMin >= MARKET_OPEN_HOUR * 60 && totalMin < MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE;
}

/**
 * 다음 장 시작 시각(KST) 반환. 평일 09:00 기준.
 */
function getNextMarketOpen(kst: Date): Date {
  const next = new Date(kst.getTime());
  // 다음 날부터 시작
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(MARKET_OPEN_HOUR, 0, 0, 0);
  // 주말인 경우 월요일까지 이동
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
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
  const kstNow = getKSTNow();

  if (isMarketOpen(kstNow)) {
    // 장중: 30분 TTL
    return now - updatedAt < INTRADAY_TTL_MS;
  }

  // 장 마감 후: 다음 장 시작 전까지 유효
  // 단, updatedAt이 오늘 장 마감 이후에 생성된 것만
  const nextOpen = getNextMarketOpen(kstNow);
  // KST 기준 nextOpen을 UTC로 변환 (역보정)
  const nextOpenUtc = nextOpen.getTime() - 9 * 60 * 60 * 1000;
  return now < nextOpenUtc;
}

// ---------------------------------------------------------------------------
// Sheets 읽기/쓰기
// ---------------------------------------------------------------------------

function getSpreadsheetId(): string | undefined {
  return process.env.GOOGLE_SPREADSHEET_ID?.trim();
}

/**
 * 특정 code+section의 캐시 조회. 유효하면 파싱된 데이터를 반환.
 */
export async function readTickerCache<T>(
  code: string,
  section: TickerCacheSection
): Promise<TickerCacheEntry<T> | null> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return null;

  try {
    const auth = await getSheetsAuth();
    const range = encodeURIComponent(`'${SHEET_TAB}'!A:D`);
    const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) {
      if (process.env.NODE_ENV === "development") {
        console.log("[TickerCache] read: Sheets API %d", res.status);
      }
      return null;
    }
    const body = (await res.json()) as { values?: unknown[][] };
    const rows = body.values ?? [];

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

    // 1) 기존 행 검색 (A:B 열만 조회하여 부하 최소화)
    const searchRange = encodeURIComponent(`'${SHEET_TAB}'!A:B`);
    const searchUrl = `${SHEETS_BASE}/${spreadsheetId}/values/${searchRange}?valueRenderOption=UNFORMATTED_VALUE`;
    const searchRes = await fetch(searchUrl, { headers });
    let rowIndex = -1;
    if (searchRes.ok) {
      const searchBody = (await searchRes.json()) as { values?: unknown[][] };
      const searchRows = searchBody.values ?? [];
      for (let i = 0; i < searchRows.length; i++) {
        if (String(searchRows[i][0]) === code && String(searchRows[i][1]) === section) {
          rowIndex = i + 1; // Sheets는 1-indexed
          break;
        }
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
