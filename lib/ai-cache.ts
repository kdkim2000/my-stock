/**
 * AI 분석 결과를 Google Sheets '_AI_CACHE_' 시트에 영속적으로 캐싱.
 *
 * 시트 구조: | code(A) | ticker(B) | content(C) | updatedAt(D) |
 *
 * - readAiCache(code): 종목코드로 캐시된 분석결과 조회
 * - writeAiCache(code, ticker, content): 분석결과 저장 (기존 행 업데이트 or 신규 추가)
 */

import { getServiceAccountToken } from "./google-oauth";

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_TAB = "_AI_CACHE_";
const AI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export interface AiCacheEntry {
    code: string;
    ticker: string;
    content: string;
    updatedAt: string; // ISO string
}

/**
 * 종목코드로 캐시된 AI 분석결과 조회.
 * _AI_CACHE_ 시트의 A열에서 code를 검색하여 해당 행의 content를 반환.
 */
export async function readAiCache(code: string): Promise<AiCacheEntry | null> {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
    if (!spreadsheetId) return null;
    try {
        const gToken = await getServiceAccountToken();
        if (!gToken) return null;

        const range = encodeURIComponent(`'${SHEET_TAB}'!A:D`);
        const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${gToken}` },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { values?: string[][] };
        const rows = data.values ?? [];

        // A열(code)에서 일치하는 행 검색 (TTL 7일 초과 시 만료 처리)
        for (const row of rows) {
            if (row[0] === code) {
                const updatedAt = row[3] ?? "";
                if (updatedAt) {
                    const age = Date.now() - new Date(updatedAt).getTime();
                    if (age > AI_CACHE_TTL_MS) return null;
                }
                return {
                    code: row[0],
                    ticker: row[1] ?? "",
                    content: row[2] ?? "",
                    updatedAt,
                };
            }
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * AI 분석결과를 _AI_CACHE_ 시트에 저장.
 * 기존 행이 있으면 업데이트, 없으면 신규 추가.
 */
export async function writeAiCache(
    code: string,
    ticker: string,
    content: string
): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
    if (!spreadsheetId) return;
    try {
        const gToken = await getServiceAccountToken();
        if (!gToken) return;

        const headers = {
            Authorization: `Bearer ${gToken}`,
            "Content-Type": "application/json",
        };
        const updatedAt = new Date().toISOString();

        // 1) 기존 행 찾기
        const rangeAll = encodeURIComponent(`'${SHEET_TAB}'!A:A`);
        const allRes = await fetch(`${SHEETS_BASE}/${spreadsheetId}/values/${rangeAll}`, { headers });
        let rowIndex = -1;
        if (allRes.ok) {
            const allData = (await allRes.json()) as { values?: string[][] };
            const allRows = allData.values ?? [];
            for (let i = 0; i < allRows.length; i++) {
                if (allRows[i][0] === code) {
                    rowIndex = i + 1; // Sheets는 1-indexed
                    break;
                }
            }
        }

        const rowValues = [[code, ticker, content, updatedAt]];

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
    } catch {
        // 저장 실패 무시 — 다음 요청 시 OpenAI 재호출
    }
}
