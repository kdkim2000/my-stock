/**
 * 환경 변수 중앙 관리.
 * 모든 process.env 접근은 이 모듈을 통해 이루어진다.
 */

function optionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key]?.trim() || defaultValue;
}

export const config = {
  // Google Sheets
  spreadsheetId: optionalEnv("GOOGLE_SPREADSHEET_ID"),
  sheetName: optionalEnv("GOOGLE_SHEET_NAME") ?? "매매내역",
  tickerMasterSheet: optionalEnv("GOOGLE_SHEET_TICKER_MASTER"),
  aggregationSheet: optionalEnv("GOOGLE_SHEET_AGGREGATION"),

  // Google Auth
  googleServiceAccountJson: optionalEnv("GOOGLE_SERVICE_ACCOUNT_JSON"),
  googleApplicationCredentials: optionalEnv("GOOGLE_APPLICATION_CREDENTIALS"),
  googleCloudProject: optionalEnv("GOOGLE_CLOUD_PROJECT"),

  // KIS
  kisAppKey: optionalEnv("KIS_APP_KEY"),
  kisAppSecret: optionalEnv("KIS_APP_SECRET"),
  kisAppSvr: optionalEnv("KIS_APP_SVR") ?? "https://openapi.koreainvestment.com:9443",
  kisThrottleMs: Number(optionalEnv("KIS_THROTTLE_MS") ?? "200"),

  // DART
  dartApiKey: optionalEnv("DART_API_KEY"),

  // OpenAI
  openaiApiKey: optionalEnv("OPENAI_API_KEY"),

  // Auth
  authSecret: optionalEnv("AUTH_SECRET"),
  allowedEmail: optionalEnv("ALLOWED_EMAIL"),

  // Runtime
  isDev: process.env.NODE_ENV === "development",
  isVercel: process.env.VERCEL === "1",
} as const;
