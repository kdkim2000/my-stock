/**
 * KIS 토큰을 Vercel 서버리스 인스턴스 간에 공유하기 위한 영속 저장소.
 *
 * 문제: Vercel 서버리스 함수는 각 인스턴스마다 별도의 /tmp 디렉터리를 가지므로,
 *       인스턴스 A가 저장한 토큰 파일을 인스턴스 B가 읽지 못함.
 *
 * 해결: Google Sheets의 기존 스프레드시트 내 '_KIS_TOKEN_' 시트(자동 생성)에
 *       토큰과 만료시간을 저장하여 모든 인스턴스가 동일한 토큰을 공유함.
 *
 * 로컬: 기존 파일 캐시 방식 그대로 유지 (process.env.VERCEL !== '1')
 */

import { getServiceAccountToken } from "../google-oauth";

export interface PersistentTokenEntry {
    token: string;
    expiresAt: number; // ms timestamp
}

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_TAB = "_KIS_TOKEN_";

/** Sheets에서 토큰 읽기 */
export async function readTokenFromSheets(): Promise<PersistentTokenEntry | null> {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
    if (!spreadsheetId) {
        console.warn("[KIS Token] No spreadsheet ID configured for read.");
        return null;
    }
    try {
        const gToken = await getServiceAccountToken();
        if (!gToken) {
            console.warn("[KIS Token] Failed to get Google OAuth token for read.");
            return null;
        }
        const range = encodeURIComponent(`'${SHEET_TAB}'!A1:B1`);
        const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${gToken}` },
        });
        if (!res.ok) {
            console.warn(`[KIS Token] Google Sheets auth failed (read): ${res.status} ${res.statusText}`);
            return null;
        }
        const data = (await res.json()) as { values?: string[][] };
        const row = data.values?.[0];
        if (!row || !row[0] || !row[1]) {
            console.log("[KIS Token] Sheet is empty or missing data.");
            return null;
        }
        const expiresAt = Number(row[1]);
        if (isNaN(expiresAt) || expiresAt <= Date.now()) {
            console.log(`[KIS Token] Cached token is expired (expiresAt: ${expiresAt}, now: ${Date.now()}).`);
            return null;
        }
        console.log(`[KIS Token] Successfully read valid token from Sheets. Expires at: ${new Date(expiresAt).toLocaleString()}`);
        return { token: row[0], expiresAt };
    } catch (e) {
        console.error("[KIS Token] Exception during readTokenFromSheets:", e);
        return null;
    }
}

/** Sheets에 토큰 저장 */
export async function writeTokenToSheets(entry: PersistentTokenEntry): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
    if (!spreadsheetId) {
        console.warn("[KIS Token] No spreadsheet ID configured for write.");
        return;
    }
    try {
        const gToken = await getServiceAccountToken();
        if (!gToken) {
            console.warn("[KIS Token] Failed to get Google OAuth token for write.");
            return;
        }
        const range = encodeURIComponent(`'${SHEET_TAB}'!A1:B1`);
        const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}?valueInputOption=RAW`;
        const res = await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${gToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [[entry.token, String(entry.expiresAt)]] }),
        });
        if (!res.ok) {
            console.warn(`[KIS Token] Google Sheets write failed: ${res.status} ${res.statusText} - ${await res.text()}`);
        } else {
            console.log(`[KIS Token] Successfully wrote new token to Sheets. Expires at: ${new Date(entry.expiresAt).toLocaleString()}`);
        }
    } catch (e) {
        console.error("[KIS Token] Exception during writeTokenToSheets:", e);
    }
}
