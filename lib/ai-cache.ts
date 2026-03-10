/**
 * AI 분석 결과를 Google Sheets '_AI_CACHE_' 시트에 영속적으로 캐싱.
 *
 * 시트 구조: | code(A) | ticker(B) | content(C) | updatedAt(D) |
 *
 * - readAiCache(code): 종목코드로 캐시된 분석결과 조회
 * - writeAiCache(code, ticker, content): 분석결과 저장 (기존 행 업데이트 or 신규 추가)
 */

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_TAB = "_AI_CACHE_";

export interface AiCacheEntry {
    code: string;
    ticker: string;
    content: string;
    updatedAt: string; // ISO string
}

/** Google Sheets 서비스 계정 액세스 토큰 획득 */
async function getSheetsToken(): Promise<string | null> {
    const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    if (!jsonStr) return null;
    try {
        const creds = JSON.parse(jsonStr) as {
            client_email?: string;
            private_key?: string;
        };
        if (!creds.client_email || !creds.private_key) return null;

        const { createSign } = await import("crypto");
        const now = Math.floor(Date.now() / 1000);
        const header = { alg: "RS256", typ: "JWT" };
        const payload = {
            iss: creds.client_email,
            scope: "https://www.googleapis.com/auth/spreadsheets",
            aud: "https://oauth2.googleapis.com/token",
            iat: now,
            exp: now + 3600,
        };
        function b64url(s: string) {
            return Buffer.from(s)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");
        }
        const sigInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
        const sign = createSign("RSA-SHA256");
        sign.update(sigInput);
        const jwt = `${sigInput}.${sign
            .sign(creds.private_key)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")}`;

        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt,
            }).toString(),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { access_token?: string };
        return data.access_token ?? null;
    } catch {
        return null;
    }
}

/**
 * 종목코드로 캐시된 AI 분석결과 조회.
 * _AI_CACHE_ 시트의 A열에서 code를 검색하여 해당 행의 content를 반환.
 */
export async function readAiCache(code: string): Promise<AiCacheEntry | null> {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
    if (!spreadsheetId) return null;
    try {
        const gToken = await getSheetsToken();
        if (!gToken) return null;

        const range = encodeURIComponent(`'${SHEET_TAB}'!A:D`);
        const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${gToken}` },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { values?: string[][] };
        const rows = data.values ?? [];

        // A열(code)에서 일치하는 행 검색
        for (const row of rows) {
            if (row[0] === code) {
                return {
                    code: row[0],
                    ticker: row[1] ?? "",
                    content: row[2] ?? "",
                    updatedAt: row[3] ?? "",
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
        const gToken = await getSheetsToken();
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
