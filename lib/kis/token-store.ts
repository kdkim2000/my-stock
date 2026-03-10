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

export interface PersistentTokenEntry {
    token: string;
    expiresAt: number; // ms timestamp
}

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_TAB = "_KIS_TOKEN_";

/** Google Sheets API 용 서비스 계정 액세스 토큰 (Google OAuth2, 1시간 유효) */
async function getSheetsAccessToken(): Promise<string | null> {
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
            return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        }
        const sigInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
        const sign = createSign("RSA-SHA256");
        sign.update(sigInput);
        const jwt = `${sigInput}.${sign.sign(creds.private_key).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

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

/** Sheets에서 토큰 읽기 */
export async function readTokenFromSheets(): Promise<PersistentTokenEntry | null> {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
    if (!spreadsheetId) return null;
    try {
        const gToken = await getSheetsAccessToken();
        if (!gToken) return null;
        const range = encodeURIComponent(`'${SHEET_TAB}'!A1:B1`);
        const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${gToken}` },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { values?: string[][] };
        const row = data.values?.[0];
        if (!row || !row[0] || !row[1]) return null;
        const expiresAt = Number(row[1]);
        if (isNaN(expiresAt) || expiresAt <= Date.now()) return null;
        return { token: row[0], expiresAt };
    } catch {
        return null;
    }
}

/** Sheets에 토큰 저장 */
export async function writeTokenToSheets(entry: PersistentTokenEntry): Promise<void> {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
    if (!spreadsheetId) return;
    try {
        const gToken = await getSheetsAccessToken();
        if (!gToken) return;
        const range = encodeURIComponent(`'${SHEET_TAB}'!A1:B1`);
        const url = `${SHEETS_BASE}/${spreadsheetId}/values/${range}?valueInputOption=RAW`;
        await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${gToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: [[entry.token, String(entry.expiresAt)]] }),
        });
    } catch {
        // 저장 실패 시 무시 (다음 요청에서 재발급)
    }
}
