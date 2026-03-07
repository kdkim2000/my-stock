import { google } from "googleapis";
import { normalizeRows } from "./normalize-row";
import type {
  SheetTransactionRow,
  RawSheetRow,
  TickerMasterRow,
  TickerAggregationRow,
} from "@/types/sheet";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** 읽기/쓰기 대상 시트 이름. env GOOGLE_SHEET_NAME 없으면 "Sheet1" (한국어 계정은 "시트1"일 수 있음) */
function getSheetName(): string {
  return process.env.GOOGLE_SHEET_NAME ?? "Sheet1";
}

/** 종목코드 마스터 시트 탭 이름. 미설정 시 null (사용 안 함) */
function getTickerMasterSheetName(): string | undefined {
  const name = process.env.GOOGLE_SHEET_TICKER_MASTER;
  return name?.trim() || undefined;
}

/** 종목별 집계 시트 탭 이름. 미설정 시 null */
function getAggregationSheetName(): string | undefined {
  const name = process.env.GOOGLE_SHEET_AGGREGATION;
  return name?.trim() || undefined;
}

/** 스프레드시트 ID (환경 변수에서 로드) */
function getSpreadsheetId(): string | undefined {
  return process.env.GOOGLE_SPREADSHEET_ID;
}

/** 서비스 계정으로 Google Auth 클라이언트 생성. Vercel은 GOOGLE_SERVICE_ACCOUNT_JSON, 로컬은 GOOGLE_APPLICATION_CREDENTIALS 사용 */
async function getAuthClient() {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonStr) {
    try {
      const credentials = JSON.parse(jsonStr) as Record<string, unknown>;
      return new google.auth.GoogleAuth({
        credentials,
        scopes: [SCOPE],
      });
    } catch (e) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON");
    }
  }
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (keyPath) {
    return new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: [SCOPE],
    });
  }
  throw new Error(
    "Set GOOGLE_SERVICE_ACCOUNT_JSON (Vercel) or GOOGLE_APPLICATION_CREDENTIALS (local key file path)"
  );
}

/**
 * 시트에서 매매 내역 읽기
 * 첫 행은 헤더로 간주하고, 2행부터 데이터로 파싱합니다.
 */
export async function getTransactions(): Promise<SheetTransactionRow[]> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return [];

  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const sheetName = getSheetName();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
    valueRenderOption: "UNFORMATTED_VALUE", // 단가 등 숫자를 포맷(쉼표) 없이 숫자 타입으로 수신
  });

  const rows = (res.data.values ?? []) as RawSheetRow[];
  if (rows.length <= 1) return []; // 헤더만 있거나 비어 있음

  const dataRows = rows.slice(1); // 헤더 제외
  return normalizeRows(dataRows);
}

/**
 * 시트 마지막 행에 한 행 추가
 */
export async function appendTransaction(row: SheetTransactionRow): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return false;

  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const sheetName = getSheetName();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:I`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          row.Date,
          row.Ticker,
          row.Type,
          row.Quantity,
          row.Price,
          row.Fee,
          row.Tax,
          row.Journal,
          row.Tags,
        ],
      ],
    },
  });

  return true;
}

/**
 * 종목코드 마스터 시트 읽기 (탭: GOOGLE_SHEET_TICKER_MASTER).
 * 범위 A:B, 1행 헤더·2행부터 Ticker, Code. 시트 미설정 또는 실패 시 [].
 */
export async function getTickerMaster(): Promise<TickerMasterRow[]> {
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getTickerMasterSheetName();
  if (!spreadsheetId || !sheetName) return [];

  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:B`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = (res.data.values ?? []) as RawSheetRow[];
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

/**
 * 종목별 집계 시트 읽기 (탭: GOOGLE_SHEET_AGGREGATION).
 * 컬럼: Ticker(A), Code(B), 매수횟수(C), 매도횟수(D), 총매수금액(E), 총매도금액(F), 실현손익(G), 보유수량(H). 시트 미설정 또는 실패 시 [].
 */
export async function getTickerAggregation(): Promise<TickerAggregationRow[]> {
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getAggregationSheetName();
  if (!spreadsheetId || !sheetName) return [];

  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!A:H`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    const rows = (res.data.values ?? []) as RawSheetRow[];
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

/**
 * 종목별 집계 시트 덮어쓰기 (헤더 + 데이터). 범위 A:H.
 * 시트 미설정 시 false. 기존 내용을 지우고 헤더 1행 + 데이터 행을 기록합니다.
 */
export async function writeTickerAggregation(
  rows: TickerAggregationRow[]
): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  const sheetName = getAggregationSheetName();
  if (!spreadsheetId || !sheetName) return false;

  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    const header = [
      "Ticker",
      "Code",
      "매수횟수",
      "매도횟수",
      "총매수금액",
      "총매도금액",
      "실현손익",
      "보유수량",
    ];
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
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1:H${values.length}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    return true;
  } catch {
    return false;
  }
}
