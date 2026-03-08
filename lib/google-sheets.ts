import { createSign } from "crypto";
import { readFile } from "fs/promises";
import { normalizeRows } from "./normalize-row";
import type {
  SheetTransactionRow,
  RawSheetRow,
  TickerMasterRow,
  TickerAggregationRow,
} from "@/types/sheet";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 서비스 계정 JWT 서명 후 Google OAuth2 토큰 엔드포인트에서 액세스 토큰 교환 (google-auth-library 제거로 번들 경량화) */
async function getAccessTokenFromServiceAccount(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_AUDIENCE,
    iat: now,
    exp: now + 3600,
  };
  const headerB64 = base64urlEncode(Buffer.from(JSON.stringify(header), "utf-8"));
  const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(payload), "utf-8"));
  const signatureInput = `${headerB64}.${payloadB64}`;
  const sign = createSign("RSA-SHA256");
  sign.update(signatureInput);
  const sig = sign.sign(privateKeyPem);
  const jwt = `${signatureInput}.${base64urlEncode(sig)}`;

  const res = await fetch(TOKEN_AUDIENCE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    const msg = `Google OAuth2 token ${res.status}: ${err}`;
    console.error("[Sheets] Service account token error:", msg);
    throw new Error(msg);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("Google OAuth2 response missing access_token");
  return data.access_token;
}

function getSheetName(): string {
  return process.env.GOOGLE_SHEET_NAME ?? "Sheet1";
}

function getTickerMasterSheetName(): string | undefined {
  const name = process.env.GOOGLE_SHEET_TICKER_MASTER;
  return name?.trim() || undefined;
}

function getAggregationSheetName(): string | undefined {
  const name = process.env.GOOGLE_SHEET_AGGREGATION;
  return name?.trim() || undefined;
}

function getSpreadsheetId(): string | undefined {
  return process.env.GOOGLE_SPREADSHEET_ID;
}

type Auth = { token: string; projectId: string };

/** 서비스 계정으로 액세스 토큰 + project_id 획득 */
async function getSheetsAuth(): Promise<Auth> {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonStr) {
    try {
      const creds = JSON.parse(jsonStr) as {
        client_email?: string;
        private_key?: string;
        project_id?: string;
      };
      if (!creds.client_email || !creds.private_key) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key");
      }
      const projectId = creds.project_id ?? process.env.GOOGLE_CLOUD_PROJECT ?? "";
      const token = await getAccessTokenFromServiceAccount(
        creds.client_email,
        creds.private_key
      );
      return { token, projectId };
    } catch (e) {
      if (e instanceof SyntaxError) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON");
      throw e;
    }
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (keyPath) {
    const raw = await readFile(keyPath, "utf-8");
    const creds = JSON.parse(raw) as {
      client_email?: string;
      private_key?: string;
      project_id?: string;
    };
    if (!creds.client_email || !creds.private_key) {
      throw new Error("Key file must include client_email and private_key");
    }
    const projectId = creds.project_id ?? process.env.GOOGLE_CLOUD_PROJECT ?? "";
    const token = await getAccessTokenFromServiceAccount(
      creds.client_email,
      creds.private_key
    );
    return { token, projectId };
  }
  throw new Error(
    "Set GOOGLE_SERVICE_ACCOUNT_JSON (Vercel) or GOOGLE_APPLICATION_CREDENTIALS (local key file path)"
  );
}

function sheetsHeaders(auth: Auth): HeadersInit {
  return {
    Authorization: `Bearer ${auth.token}`,
    "Content-Type": "application/json",
  };
}

/** values.get */
async function sheetsValuesGet(
  spreadsheetId: string,
  range: string,
  auth: Auth
): Promise<{ values?: unknown[][] }> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(url, { headers: sheetsHeaders(auth) });
  if (!res.ok) {
    const err = await res.text();
    const msg = `Sheets API ${res.status}: ${err}`;
    console.error("[Sheets] values.get error:", msg);
    throw new Error(msg);
  }
  return res.json();
}

/** values.append */
async function sheetsValuesAppend(
  spreadsheetId: string,
  range: string,
  values: unknown[][],
  auth: Auth
): Promise<void> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: sheetsHeaders(auth),
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API ${res.status}: ${err}`);
  }
}

/** values.update */
async function sheetsValuesUpdate(
  spreadsheetId: string,
  range: string,
  values: unknown[][],
  auth: Auth
): Promise<void> {
  const url = `${SHEETS_BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: "PUT",
    headers: sheetsHeaders(auth),
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API ${res.status}: ${err}`);
  }
}

export async function getTransactions(): Promise<SheetTransactionRow[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];

  const auth = await getSheetsAuth();
  const sheetName = getSheetName();
  const data = await sheetsValuesGet(spreadsheetId, sheetName, auth);
  const rows = (data.values ?? []) as RawSheetRow[];
  if (rows.length <= 1) return [];
  return normalizeRows(rows.slice(1));
}

export async function appendTransaction(row: SheetTransactionRow): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return false;

  const auth = await getSheetsAuth();
  const sheetName = getSheetName();
  await sheetsValuesAppend(
    spreadsheetId,
    `${sheetName}!A:I`,
    [[row.Date, row.Ticker, row.Type, row.Quantity, row.Price, row.Fee, row.Tax, row.Journal, row.Tags]],
    auth
  );
  return true;
}

export async function getTickerMaster(): Promise<TickerMasterRow[]> {
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getTickerMasterSheetName();
  if (!spreadsheetId || !sheetName) return [];

  try {
    const auth = await getSheetsAuth();
    const data = await sheetsValuesGet(spreadsheetId, `'${sheetName}'!A:B`, auth);
    const rows = (data.values ?? []) as RawSheetRow[];
    if (rows.length <= 1) return [];
    const dataRows = rows.slice(1);
    return dataRows
      .map((r) => {
        const ticker = String(r[0] ?? "").trim();
        const code = String(r[1] ?? "").trim();
        if (!ticker) return null;
        return { Ticker: ticker, Code: code };
      })
      .filter((row): row is TickerMasterRow => row !== null);
  } catch {
    return [];
  }
}

export async function getTickerAggregation(): Promise<TickerAggregationRow[]> {
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getAggregationSheetName();
  if (!spreadsheetId || !sheetName) return [];

  try {
    const auth = await getSheetsAuth();
    const data = await sheetsValuesGet(spreadsheetId, `'${sheetName}'!A:H`, auth);
    const rows = (data.values ?? []) as RawSheetRow[];
    if (rows.length <= 1) return [];
    const dataRows = rows.slice(1);
    const result: TickerAggregationRow[] = [];
    for (const r of dataRows) {
      const ticker = String(r[0] ?? "").trim();
      if (!ticker) continue;
      result.push({
        Ticker: ticker,
        Code: r[1] != null && String(r[1]).trim() !== "" ? String(r[1]).trim() : undefined,
        buyCount: Number(r[2]) || 0,
        sellCount: Number(r[3]) || 0,
        totalBuyAmount: Number(r[4]) || 0,
        totalSellAmount: Number(r[5]) || 0,
        realizedPnL: Number(r[6]) || 0,
        quantity: Number(r[7]) || 0,
      });
    }
    return result;
  } catch {
    return [];
  }
}

export async function writeTickerAggregation(rows: TickerAggregationRow[]): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getAggregationSheetName();
  if (!spreadsheetId || !sheetName) return false;

  try {
    const auth = await getSheetsAuth();
    const header = ["Ticker", "Code", "매수횟수", "매도횟수", "총매수금액", "총매도금액", "실현손익", "보유수량"];
    const values = [
      header,
      ...rows.map((r) => [
        r.Ticker,
        r.Code ?? "",
        r.buyCount,
        r.sellCount,
        r.totalBuyAmount,
        r.totalSellAmount,
        r.realizedPnL,
        r.quantity,
      ]),
    ];
    await sheetsValuesUpdate(spreadsheetId, `'${sheetName}'!A1:H${values.length}`, values, auth);
    return true;
  } catch {
    return false;
  }
}
