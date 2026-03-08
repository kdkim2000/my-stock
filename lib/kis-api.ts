/**
 * Korea Investment & Securities (KIS) Open API
 * - 접근 토큰 발급 (24시간 유효, 1일 1회 재발급 원칙으로 메모이제이션)
 * - 국내주식 현재가 시세 (inquire-price)
 * - 국내주식 일봉 차트 (inquire-daily-itemchartprice) — 52주 고/저 계산용
 *
 * 토큰 규칙 (KIS): 유효기간 24시간. 한 번 발급한 토큰은 일일간 유효하므로
 * 재발급을 시도하지 않고 access_token_token_expired 기준으로 캐시해 활용하며,
 * 유효기간 경과 시에만 tokenP를 다시 호출합니다.
 * 재발급은 유효하지 않을 때만: 500 응답 + EGW00123(만료된 token) 수신 시에만 clearKisTokenCache 호출.
 * 종목/지표 변경과 무관하게 단일 토큰 캐시만 사용합니다.
 * KIS 1분당 1회(EGW00133) 제한 대응: globalThis + 파일 캐시로 워커/인스턴스 간 토큰 공유.
 * @see https://github.com/koreainvestment/open-trading-api
 */

import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import os from "os";
import path from "path";

import type {
  KisPriceInfo,
  KisDailyChartPoint,
  KisTickerOpinion,
  KisBrokerOpinion,
  KisInvestmentOpinion,
} from "@/types/api";

const DEFAULT_BASE_URL = "https://openapi.koreainvestment.com:9443";
const VPS_BASE_URL = "https://openapivts.koreainvestment.com:29443";

/** 만료 1분 전에 재발급 (access_token_token_expired 기준) */
const EXPIRE_BUFFER_MS = 60 * 1000;

/** KIS 1분당 1회 제한(EGW00133) 대응: 403 후 재시도까지 대기 시각(ms) */
const TOKEN_RETRY_AFTER_MS = 62 * 1000;

/** 프로세스 내·워커 간 공유용 (Next.js 멀티 워커 시 메모리 캐시가 워커별로 갈라져 403 발생 방지) */
const GLOBAL_KEY = "__KIS_TOKEN_CACHE__" as const;

type TokenEntry = { token: string; expiresAt: number };
type GlobalCache = {
  cachedToken: TokenEntry | null;
  refreshPromise: Promise<string | null> | null;
  tokenPCooldownUntil: number;
};

function getGlobal(): GlobalCache {
  const g = globalThis as unknown as Record<string, GlobalCache>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      cachedToken: null,
      refreshPromise: null,
      tokenPCooldownUntil: 0,
    };
  }
  return g[GLOBAL_KEY];
}

/**
 * 파일 캐시 경로. 워커/프로세스 간 공유용.
 * Vercel 서버리스는 파일시스템이 읽기 전용이므로, VERCEL=1 일 때만 쓰기 가능한 os.tmpdir()(예: /tmp)을 사용.
 */
function getTokenCachePath(): string {
  try {
    if (process.env.VERCEL === "1") {
      return path.join(os.tmpdir(), "kis-token.json");
    }
    const cwd = process.cwd();
    const dir = path.join(cwd, ".next", "cache");
    return path.join(dir, "kis-token.json");
  } catch {
    return "";
  }
}

/** 파일에 저장된 토큰/쿨다운 읽기. 실패 시 null. */
async function readTokenFromFile(): Promise<{ token: string; expiresAt: number } | { cooldownUntil: number } | null> {
  const filePath = getTokenCachePath();
  if (!filePath) return null;
  try {
    const raw = await readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as { token?: string; expiresAt?: number; cooldownUntil?: number };
    if (data.token != null && typeof data.expiresAt === "number" && data.expiresAt > Date.now()) {
      return { token: data.token, expiresAt: data.expiresAt };
    }
    if (typeof data.cooldownUntil === "number" && data.cooldownUntil > Date.now()) {
      return { cooldownUntil: data.cooldownUntil };
    }
  } catch {
    /* 파일 없음 또는 파싱 오류 */
  }
  return null;
}

/** 토큰 성공 시 파일에 저장. 403 시 쿨다운만 기록. */
async function writeTokenToFile(entry: TokenEntry | { cooldownUntil: number }): Promise<void> {
  const filePath = getTokenCachePath();
  if (!filePath) return;
  try {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    let existing: Record<string, number | string> = {};
    try {
      const raw = await readFile(filePath, "utf-8");
      existing = JSON.parse(raw) as Record<string, number | string>;
    } catch {
      /* ignore */
    }
    if ("token" in entry) {
      existing.token = entry.token;
      existing.expiresAt = entry.expiresAt;
    }
    if ("cooldownUntil" in entry) {
      existing.cooldownUntil = entry.cooldownUntil;
    }
    await writeFile(filePath, JSON.stringify(existing), "utf-8");
  } catch {
    /* 권한/디스크 오류 시 무시 */
  }
}

let cachedToken: TokenEntry | null = null;
let refreshPromise: Promise<string | null> | null = null;
let tokenPCooldownUntil = 0;

/** 메모리 + globalThis 동기화 (유효한 토큰이 있으면 사용) */
function syncFromGlobalAndCheckExpired(): boolean {
  const gl = getGlobal();
  if (gl.cachedToken && gl.cachedToken.expiresAt > Date.now()) {
    cachedToken = gl.cachedToken;
    return false;
  }
  if (cachedToken && cachedToken.expiresAt > Date.now()) return false;
  cachedToken = null;
  return true;
}

/** 캐시된 토큰이 유효기간 경과했는지 (재발급 필요 여부) */
function isCachedTokenExpired(): boolean {
  return !cachedToken || cachedToken.expiresAt <= Date.now();
}

/**
 * 토큰 캐시 무효화. 수동 재발급 유도용. 메모리·globalThis·파일 캐시 모두 초기화.
 */
export function clearKisTokenCache(): void {
  cachedToken = null;
  refreshPromise = null;
  tokenPCooldownUntil = 0;
  const gl = getGlobal();
  gl.cachedToken = null;
  gl.refreshPromise = null;
  gl.tokenPCooldownUntil = 0;
  const p = getTokenCachePath();
  if (p && existsSync(p)) {
    unlink(p).catch(() => {});
  }
}

/** 유효기간이 지난 경우에만 캐시 무효화. 500 "만료된 token" 수신 시 사용. */
function clearKisTokenCacheIfExpired(): void {
  if (isCachedTokenExpired()) {
    cachedToken = null;
    refreshPromise = null;
  }
}

/** KIS API 500 응답 본문이 '만료된 token'(EGW00123)인지 여부 */
function isKisTokenExpiredResponse(bodyText: string): boolean {
  try {
    const j = JSON.parse(bodyText) as { msg_cd?: string; msg1?: string };
    return j.msg_cd === "EGW00123" || /만료된\s*token|기간이\s*만료된\s*token/i.test(j.msg1 ?? "");
  } catch {
    return /만료된\s*token|기간이\s*만료된\s*token/i.test(bodyText);
  }
}

function getBaseUrl(): string {
  const url = process.env.KIS_APP_URL;
  if (url) return url;
  return process.env.KIS_APP_SVR === "vps" ? VPS_BASE_URL : DEFAULT_BASE_URL;
}

/** EGW00201 초당 거래건수 초과 방지: KIS 요청 간 최소 간격(ms). 환경변수 KIS_THROTTLE_MS 미설정 시 400ms(초당 약 2.5건). */
const KIS_THROTTLE_MS = Math.max(0, Number(process.env.KIS_THROTTLE_MS) || 400);

const GLOBAL_THROTTLE_KEY = "__KIS_THROTTLE_LAST__" as const;
function getThrottleLast(): { lastAt: number } {
  const g = globalThis as unknown as Record<string, { lastAt: number }>;
  if (!g[GLOBAL_THROTTLE_KEY]) g[GLOBAL_THROTTLE_KEY] = { lastAt: 0 };
  return g[GLOBAL_THROTTLE_KEY];
}
/** KIS API 호출 전 대기. 초당 거래건수 제한(EGW00201) 회피용. */
async function waitKisThrottle(): Promise<void> {
  if (KIS_THROTTLE_MS <= 0) return;
  const t = getThrottleLast();
  const now = Date.now();
  const elapsed = now - t.lastAt;
  if (elapsed < KIS_THROTTLE_MS) {
    await new Promise((r) => setTimeout(r, KIS_THROTTLE_MS - elapsed));
  }
  getThrottleLast().lastAt = Date.now();
}

/** KIS 응답 캐시 (EGW00201 완화 + 호출 최소화). key → { data, expires } */
const GLOBAL_KIS_CACHE_KEY = "__KIS_RESPONSE_CACHE__" as const;
type CacheEntry = { data: unknown; expires: number };
function getKisCache(): Map<string, CacheEntry> {
  const g = globalThis as unknown as Record<string, Map<string, CacheEntry>>;
  if (!g[GLOBAL_KIS_CACHE_KEY]) g[GLOBAL_KIS_CACHE_KEY] = new Map();
  return g[GLOBAL_KIS_CACHE_KEY];
}
function kisCacheGet<T>(key: string): T | null {
  const entry = getKisCache().get(key);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.data as T;
}
function kisCacheSet(key: string, data: unknown, ttlMs: number): void {
  getKisCache().set(key, { data, expires: Date.now() + ttlMs });
}
/** 시세/가격: 60초, 재무/비율/투자의견 등: 300초 */
const KIS_CACHE_TTL_PRICE_MS = 60 * 1000;
const KIS_CACHE_TTL_FUND_MS = 300 * 1000;

/** KIS TR_ID · URL path 매핑 (가치투자용). 모의(VPS) 시 TR은 동일 사용(포털 규칙에 따라 V 접두어 필요 시 env로 오버라이드) */
const KIS_TR_PATH: Record<string, string> = {
  CTPF1604R: "/uapi/domestic-stock/v1/quotations/search-info",
  CTPF1002R: "/uapi/domestic-stock/v1/quotations/search-stock-info",
  FHKST66430100: "/uapi/domestic-stock/v1/finance/balance-sheet",
  FHKST66430200: "/uapi/domestic-stock/v1/finance/income-statement",
  FHKST66430300: "/uapi/domestic-stock/v1/finance/financial-ratio",
  FHKST66430400: "/uapi/domestic-stock/v1/finance/profit-ratio",
  FHKST66430500: "/uapi/domestic-stock/v1/finance/other-major-ratios",
  FHKST66430600: "/uapi/domestic-stock/v1/finance/stability-ratio",
  FHKST66430800: "/uapi/domestic-stock/v1/finance/growth-ratio",
  HHKST668300C0: "/uapi/domestic-stock/v1/quotations/estimate-perform",
  FHKST663300C0: "/uapi/domestic-stock/v1/quotations/invest-opinion",
  FHKST663400C0: "/uapi/domestic-stock/v1/quotations/invest-opbysec",
  FHPTJ04160001: "/uapi/domestic-stock/v1/quotations/investor-trade-by-stock-daily",
  FHKST03010800: "/uapi/domestic-stock/v1/quotations/inquire-daily-trade-volume",
  FHKST01010400: "/uapi/domestic-stock/v1/quotations/inquire-daily-price",
};

/**
 * KIS GET 요청 공통 (토큰 만료 시 재시도). path는 풀 path(예: /uapi/domestic-stock/v1/...).
 * 반환: body (rt_cd 등 포함) 또는 null.
 */
async function kisGet(
  path: string,
  trId: string,
  code: string,
  extraParams: Record<string, string> = {}
): Promise<Record<string, unknown> | null> {
  const cacheKey = `kis:${trId}:${code}:${JSON.stringify(extraParams)}`;
  const ttl = path.includes("inquire-price") ? KIS_CACHE_TTL_PRICE_MS : KIS_CACHE_TTL_FUND_MS;
  const cached = kisCacheGet<Record<string, unknown>>(cacheKey);
  if (cached != null) return cached;

  await waitKisThrottle();
  const token = await getAccessToken();
  if (!token) return null;
  const appkey = process.env.KIS_APP_KEY;
  const appsecret = process.env.KIS_APP_SECRET;
  if (!appkey || !appsecret) return null;
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: code,
    ...extraParams,
  });
  const url = `${baseUrl}${path}?${params.toString()}`;
  const doFetch = (t: string) =>
    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${t}`,
        appkey,
        appsecret,
        tr_id: trId,
        custtype: "P",
      },
    });
  let res = await doFetch(token);
  let bodyText = await res.text();
  if (!res.ok && res.status === 500 && isKisTokenExpiredResponse(bodyText)) {
    clearKisTokenCache();
    const newToken = await getAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
      bodyText = await res.text();
    }
  }
  if (!res.ok) {
    if (process.env.NODE_ENV === "development") {
      try {
        const errBody = JSON.parse(bodyText) as { msg_cd?: string; msg1?: string };
        console.log("[KIS] kisGet HTTP %s path=%s trId=%s code=%s msg_cd=%s msg1=%s", res.status, path, trId, code, errBody.msg_cd ?? "", errBody.msg1 ?? bodyText.slice(0, 200));
      } catch {
        console.log("[KIS] kisGet HTTP %s path=%s trId=%s code=%s body=%s", res.status, path, trId, code, bodyText.slice(0, 200));
      }
    }
    return null;
  }
  try {
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    if (body.rt_cd && body.rt_cd !== "0") {
      if (process.env.NODE_ENV === "development") {
        console.log("[KIS] kisGet rt_cd=%s path=%s trId=%s code=%s msg_cd=%s msg1=%s", body.rt_cd, path, trId, code, (body as { msg_cd?: string }).msg_cd ?? "", (body as { msg1?: string }).msg1 ?? "");
      }
      return null;
    }
    kisCacheSet(cacheKey, body, ttl);
    return body;
  } catch {
    return null;
  }
}

/**
 * access_token_token_expired("YYYY-MM-DD HH:mm:SS") → UTC 밀리초.
 * 만료 EXPIRE_BUFFER_MS(1분) 전에 재발급하도록 보수적으로 계산.
 * KIS 문서상 UTC 반환 가정.
 */
function parseExpiresAt(expiredStr: string): number {
  const s = expiredStr.replace(" ", "T").trim();
  const iso = s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}Z`;
  const d = new Date(iso);
  return d.getTime() - EXPIRE_BUFFER_MS;
}

/**
 * 접근 토큰 발급 (메모이제이션 + globalThis + 파일 캐시).
 * 동일 프로세스 내·다른 워커(파일)에서 발급한 토큰을 재사용하여 1분당 1회(EGW00133) 403을 방지합니다.
 */
export async function getAccessToken(): Promise<string | null> {
  const appkey = process.env.KIS_APP_KEY?.trim();
  const appsecret = process.env.KIS_APP_SECRET?.trim();
  if (!appkey || !appsecret) return null;

  const gl = getGlobal();
  cachedToken = gl.cachedToken;
  tokenPCooldownUntil = gl.tokenPCooldownUntil;
  refreshPromise = gl.refreshPromise;

  if (!syncFromGlobalAndCheckExpired()) return cachedToken!.token;

  const fileEntry = await readTokenFromFile();
  if (fileEntry && "token" in fileEntry) {
    cachedToken = { token: fileEntry.token, expiresAt: fileEntry.expiresAt };
    gl.cachedToken = cachedToken;
    return cachedToken.token;
  }
  if (fileEntry && "cooldownUntil" in fileEntry && fileEntry.cooldownUntil > Date.now()) {
    const waitMs = fileEntry.cooldownUntil - Date.now();
    await new Promise((r) => setTimeout(r, Math.min(waitMs, TOKEN_RETRY_AFTER_MS)));
    return getAccessToken();
  }

  if (refreshPromise) {
    await refreshPromise;
    gl.refreshPromise = null;
    refreshPromise = null;
    if (!syncFromGlobalAndCheckExpired()) return cachedToken!.token;
    return getAccessToken();
  }

  const baseUrl = getBaseUrl();
  refreshPromise = (async (): Promise<string | null> => {
    try {
      const now = Date.now();
      const cooldown = Math.max(tokenPCooldownUntil, gl.tokenPCooldownUntil);
      if (cooldown > now) {
        const waitMs = cooldown - now;
        await new Promise((r) => setTimeout(r, waitMs));
        const again = await readTokenFromFile();
        if (again && "token" in again && again.expiresAt > Date.now()) {
          cachedToken = { token: again.token, expiresAt: again.expiresAt };
          gl.cachedToken = cachedToken;
          return cachedToken.token;
        }
      }
      const res = await fetch(`${baseUrl}/oauth2/tokenP`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey,
          appsecret,
        }),
      });
      const errBody = await res.text();
      if (!res.ok) {
        const isRateLimit = res.status === 403 && /EGW00133|1분당\s*1회/i.test(errBody);
        if (isRateLimit) {
          const until = Date.now() + TOKEN_RETRY_AFTER_MS;
          tokenPCooldownUntil = until;
          gl.tokenPCooldownUntil = until;
          await writeTokenToFile({ cooldownUntil: until });
          console.warn(
            "[KIS] tokenP 403 EGW00133(1분당 1회). 파일/공유 캐시에서 토큰 조회 후 재시도합니다. %d초 대기.",
            TOKEN_RETRY_AFTER_MS / 1000
          );
          refreshPromise = null;
          gl.refreshPromise = null;
          await new Promise((r) => setTimeout(r, TOKEN_RETRY_AFTER_MS));
          return getAccessToken();
        }
        console.error("[KIS] tokenP failed:", res.status, errBody);
        return null;
      }
      const data = JSON.parse(errBody) as {
        access_token?: string;
        access_token_token_expired?: string;
      };
      const token = data.access_token ?? null;
      const expiredStr = data.access_token_token_expired;
      if (token && expiredStr) {
        const entry: TokenEntry = { token, expiresAt: parseExpiresAt(expiredStr) };
        cachedToken = entry;
        gl.cachedToken = entry;
        await writeTokenToFile(entry);
      }
      return token;
    } finally {
      refreshPromise = null;
      gl.refreshPromise = null;
    }
  })();
  gl.refreshPromise = refreshPromise;
  return refreshPromise;
}

/**
 * 국내주식 현재가 시세 조회 (종목코드 6자리)
 * @returns 현재가(stck_prpr), 실패 시 null
 */
export async function getCurrentPrice(tickerCode: string): Promise<number | null> {
  const code = String(tickerCode ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    console.warn("[KIS] 단계5: 종목코드 형식 오류(6자리 숫자 아님) code=%s", code || "(empty)");
    return null;
  }

  const token = await getAccessToken();
  if (!token) {
    console.warn("[KIS] 단계5: 토큰 없음 (KIS_APP_KEY/KIS_APP_SECRET 또는 토큰 발급 실패)");
    return null;
  }

  const appkey = process.env.KIS_APP_KEY;
  const appsecret = process.env.KIS_APP_SECRET;
  if (!appkey || !appsecret) {
    console.warn("[KIS] 단계5: KIS_APP_KEY 또는 KIS_APP_SECRET 미설정");
    return null;
  }

  const baseUrl = getBaseUrl();
  const isVps = baseUrl.includes("openapivts");
  const trId = isVps ? "VFHKST01010100" : "FHKST01010100";
  const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${encodeURIComponent(code)}`;

  let res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      appkey,
      appsecret,
      tr_id: trId,
      custtype: "P",
    },
  });

  let bodyText = await res.text();

  if (!res.ok && res.status === 500 && isKisTokenExpiredResponse(bodyText)) {
    clearKisTokenCache();
    const newToken = await getAccessToken();
    if (newToken) {
      res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${newToken}`,
          appkey,
          appsecret,
          tr_id: trId,
          custtype: "P",
        },
      });
      bodyText = await res.text();
    }
  }

  if (!res.ok) {
    console.error("[KIS] 단계5: inquire-price HTTP 실패 code=%s status=%s body=%s", code, res.status, bodyText);
    return null;
  }

  let json: { output?: { stck_prpr?: string }; rt_cd?: string; msg_cd?: string };
  try {
    json = JSON.parse(bodyText) as typeof json;
  } catch {
    console.error("[KIS] 단계5: 응답 JSON 파싱 실패 code=%s", code);
    return null;
  }
  const rtCd = json.rt_cd ?? json.msg_cd;
  if (rtCd && rtCd !== "0") {
    console.warn("[KIS] 단계5: API 응답 오류 code=%s rt_cd=%s", code, rtCd);
    return null;
  }
  const prpr = json.output?.stck_prpr;
  if (prpr == null || prpr === "") {
    console.warn("[KIS] 단계5: 현재가 없음( output.stck_prpr ) code=%s", code);
    return null;
  }
  const num = Number(String(prpr).replace(/,/g, ""));
  if (Number.isNaN(num)) {
    console.warn("[KIS] 단계5: 현재가 파싱 실패 code=%s prpr=%s", code, prpr);
    return null;
  }
  return num;
}

/** 숫자 파싱 (쉼표 제거, 빈값 → 0) */
function parseNum(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * 국내주식 현재가 시세 전체 조회 (inquire-price). 전일대비, 시고저 등 포함.
 * @returns KisPriceInfo 또는 실패 시 null
 */
export async function getPriceInfo(tickerCode: string): Promise<KisPriceInfo | null> {
  const code = String(tickerCode ?? "").trim();
  if (!/^\d{6}$/.test(code)) return null;

  const cacheKey = `priceInfo:${code}`;
  const cached = kisCacheGet<KisPriceInfo>(cacheKey);
  if (cached != null) return cached;

  await waitKisThrottle();
  const token = await getAccessToken();
  if (!token) return null;
  const appkey = process.env.KIS_APP_KEY;
  const appsecret = process.env.KIS_APP_SECRET;
  if (!appkey || !appsecret) return null;

  const baseUrl = getBaseUrl();
  const isVps = baseUrl.includes("openapivts");
  const trId = isVps ? "VFHKST01010100" : "FHKST01010100";
  const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${encodeURIComponent(code)}`;

  const doFetch = (t: string) =>
    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${t}`,
        appkey,
        appsecret,
        tr_id: trId,
        custtype: "P",
      },
    });

  let res = await doFetch(token);
  let bodyText = await res.text();
  if (!res.ok && res.status === 500 && isKisTokenExpiredResponse(bodyText)) {
    clearKisTokenCache();
    const newToken = await getAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
      bodyText = await res.text();
    }
  }
  if (!res.ok) return null;
  let json: { output?: Record<string, unknown>; rt_cd?: string; msg_cd?: string };
  try {
    json = JSON.parse(bodyText) as typeof json;
  } catch {
    return null;
  }
  if ((json.rt_cd ?? json.msg_cd) !== "0") return null;
  const out = json.output;
  if (!out || typeof out !== "object") return null;

  const stckPrpr = parseNum(out.stck_prpr);
  if (stckPrpr === 0) return null;

  const result: KisPriceInfo = {
    stckPrpr,
    prdyVrss: parseNum(out.prdy_vrss),
    prdyCtrt: parseNum(out.prdy_ctrt),
    stckOprc: parseNum(out.stck_oprc) || undefined,
    stckHgpr: parseNum(out.stck_hgpr) || undefined,
    stckLwpr: parseNum(out.stck_lwpr) || undefined,
    acmlVol: parseNum(out.acml_vol) || undefined,
    stckShrnIscd: typeof out.stck_shrn_iscd === "string" ? out.stck_shrn_iscd : undefined,
  };
  kisCacheSet(cacheKey, result, KIS_CACHE_TTL_PRICE_MS);
  return result;
}

/**
 * 국내주식 일봉 차트 조회 (inquire-daily-itemchartprice). 최대 100건.
 * @param startDate YYYYMMDD
 * @param endDate YYYYMMDD
 */
export async function getDailyChart(
  tickerCode: string,
  startDate: string,
  endDate: string
): Promise<KisDailyChartPoint[] | null> {
  const code = String(tickerCode ?? "").trim();
  if (!/^\d{6}$/.test(code)) return null;

  const cacheKey = `dailyChart:${code}:${startDate}:${endDate}`;
  const cached = kisCacheGet<KisDailyChartPoint[]>(cacheKey);
  if (cached != null) return cached;

  await waitKisThrottle();
  const token = await getAccessToken();
  if (!token) return null;
  const appkey = process.env.KIS_APP_KEY;
  const appsecret = process.env.KIS_APP_SECRET;
  if (!appkey || !appsecret) return null;

  const baseUrl = getBaseUrl();
  const isVps = baseUrl.includes("openapivts");
  const trId = isVps ? "VFHKST03010100" : "FHKST03010100";
  const params = new URLSearchParams({
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: code,
    FID_INPUT_DATE_1: toKisDate00(startDate),
    FID_INPUT_DATE_2: toKisDate00(endDate),
    FID_PERIOD_DIV_CODE: "D",
    FID_ORG_ADJ_PRC: "0",
  });
  const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?${params.toString()}`;

  const doFetch = (t: string) =>
    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${t}`,
        appkey,
        appsecret,
        tr_id: trId,
        custtype: "P",
      },
    });
  let res = await doFetch(token);
  let bodyText = await res.text();
  if (!res.ok && res.status === 500 && isKisTokenExpiredResponse(bodyText)) {
    clearKisTokenCache();
    const newToken = await getAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
      bodyText = await res.text();
    }
  }
  if (!res.ok) return null;
  let body: { rt_cd?: string; output2?: unknown } | null = null;
  try {
    body = JSON.parse(bodyText) as { rt_cd?: string; output2?: unknown };
  } catch {
    return null;
  }
  if (!body || (body.rt_cd && body.rt_cd !== "0")) return null;
  const list = body.output2;
  if (!Array.isArray(list) || list.length === 0) return [];

  const result = list.map((row: Record<string, unknown>) => ({
    date: String(row.stck_bsop_date ?? row.stck_cntg_hour ?? "").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    open: parseNum(row.stck_oprc),
    high: parseNum(row.stck_hgpr),
    low: parseNum(row.stck_lwpr),
    close: parseNum(row.stck_clpr),
    volume: parseNum(row.acml_vol),
  }));
  kisCacheSet(cacheKey, result, KIS_CACHE_TTL_FUND_MS);
  return result;
}

/** KIS 종목정보(재무 요약) 응답 — PER, PBR 등. 대차대조표·손익계산서 항목은 KIS에서 제공하지 않을 수 있음. */
export interface KisStockFundamentals {
  balanceSheet: { totalAssets?: number; totalLiabilities?: number; totalEquity?: number };
  incomeStatement: { revenue?: number; operatingIncome?: number; netIncome?: number };
  ratios: { per: number; pbr: number; eps?: number; bps?: number };
}

/**
 * KIS [국내주식] PER, PBR, EPS, BPS 조회.
 * 재무비율 API(FHKST66430300) 우선 사용, 실패 시 search-info(기존) 폴백.
 * 대차대조표·손익계산서는 전용 API로 별도 조회(route에서 병렬 호출).
 */
export async function getKisStockFundamentals(
  tickerCode: string,
  currentPrice?: number
): Promise<KisStockFundamentals | null> {
  const code = String(tickerCode ?? "").trim();
  if (!/^\d{6}$/.test(code)) return null;

  const ratioOut = await getKisFinancialRatio(code);
  let per = 0;
  let pbr = 0;
  let eps = 0;
  let bps = 0;
  let balanceSheet: KisStockFundamentals["balanceSheet"] = {};
  let incomeStatement: KisStockFundamentals["incomeStatement"] = {};

  if (ratioOut) {
    per = parseNum(ratioOut.per ?? ratioOut.prdy_per ?? ratioOut.PER ?? ratioOut.stck_per);
    pbr = parseNum(ratioOut.pbr ?? ratioOut.prdy_pbr ?? ratioOut.PBR ?? ratioOut.stck_pbr);
    eps = parseNum(ratioOut.eps ?? ratioOut.EPS ?? ratioOut.prdy_eps ?? ratioOut.stck_eps);
    bps = parseNum(ratioOut.bps ?? ratioOut.BPS ?? ratioOut.prdy_bps ?? ratioOut.stck_bps);
  }

  const hasRatioFromApi = per > 0 || pbr > 0 || eps !== 0 || bps !== 0;
  if (!hasRatioFromApi) {
    const fromSearch = await getKisStockFundamentalsFromSearchInfo(code, currentPrice);
    if (fromSearch) return fromSearch;
    return null;
  }

  let finalPer = per;
  let finalPbr = pbr;
  if (currentPrice != null && currentPrice > 0) {
    if (finalPer <= 0 && eps > 0) finalPer = currentPrice / eps;
    if (finalPbr <= 0 && bps > 0) finalPbr = currentPrice / bps;
  }
  return {
    balanceSheet,
    incomeStatement,
    ratios: { per: finalPer, pbr: finalPbr, eps: eps || undefined, bps: bps || undefined },
  };
}

/** search-info(CTPF1604R) 기반 PER/PBR/대차/손익 조회 — getKisStockFundamentals 폴백용 */
async function getKisStockFundamentalsFromSearchInfo(
  code: string,
  currentPrice?: number
): Promise<KisStockFundamentals | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const appkey = process.env.KIS_APP_KEY;
  const appsecret = process.env.KIS_APP_SECRET;
  if (!appkey || !appsecret) return null;
  const baseUrl = getBaseUrl();
  const path = KIS_TR_PATH.CTPF1604R ?? "/uapi/domestic-stock/v1/quotations/search-info";
  const isVps = baseUrl.includes("openapivts");
  const envTrId = process.env.KIS_SEARCH_INFO_TR_ID?.trim();
  const defaultTrId = isVps ? "VFHKST02010100" : "FHKST02010100";
  const trId = envTrId != null && envTrId !== "" ? envTrId : defaultTrId;
  const body = await kisGet(path, trId, code);
  if (!body) return null;
  const out = pickFirstOutput(body);
  if (!out || typeof out !== "object") return null;

  const per = parseNum(out.per ?? out.prdy_per ?? out.PER ?? out.stck_per);
  const pbr = parseNum(out.pbr ?? out.prdy_pbr ?? out.PBR ?? out.stck_pbr);
  const eps = parseNum(out.eps ?? out.EPS ?? out.prdy_eps ?? out.stck_eps);
  const bps = parseNum(out.bps ?? out.BPS ?? out.prdy_bps ?? out.stck_bps);
  const totalAssets = parseNum(out.tot_aset ?? out.total_assets ?? out.자산총계);
  const totalEquity = parseNum(out.tot_eqty ?? out.total_equity ?? out.자본총계);
  const totalLiabilities = parseNum(out.tot_liab ?? out.total_liabilities ?? out.부채총계);
  const revenue = parseNum(out.rev ?? out.revenue ?? out.매출액);
  const operatingIncome = parseNum(out.op_inc ?? out.operating_income ?? out.영업이익);
  const netIncome = parseNum(out.net_inc ?? out.net_income ?? out.당기순이익);

  const balance: KisStockFundamentals["balanceSheet"] = {};
  if (totalAssets > 0) balance.totalAssets = totalAssets;
  if (totalLiabilities > 0) balance.totalLiabilities = totalLiabilities;
  if (totalEquity > 0) balance.totalEquity = totalEquity;

  const income: KisStockFundamentals["incomeStatement"] = {};
  if (revenue > 0) income.revenue = revenue;
  if (operatingIncome !== 0) income.operatingIncome = operatingIncome;
  if (netIncome !== 0) income.netIncome = netIncome;

  let finalPer = per;
  let finalPbr = pbr;
  if (currentPrice != null && currentPrice > 0) {
    if (finalPer <= 0 && eps > 0) finalPer = currentPrice / eps;
    if (finalPbr <= 0 && bps > 0) finalPbr = currentPrice / bps;
  }
  const hasAny =
    finalPer > 0 || finalPbr > 0 || eps !== 0 || bps !== 0 ||
    Object.keys(balance).length > 0 || Object.keys(income).length > 0;
  if (!hasAny) return null;
  return {
    balanceSheet: balance,
    incomeStatement: income,
    ratios: { per: finalPer, pbr: finalPbr, eps: eps || undefined, bps: bps || undefined },
  };
}

/** finance API 공통: output/output1/output2에서 단일 객체 또는 배열 첫 항목 추출 */
function pickFirstOutput(body: Record<string, unknown>): Record<string, unknown> | null {
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

/** 날짜 문자열을 KIS 전용 00년월일 형식으로 변환 (예: 0020240513) */
function toKisDate00(dateInput: string | Date): string {
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

/** Date → YYYYMMDD (연도 변경 포함 정확한 날짜 계산용) */
function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/** 날짜에 n일 가산 (새 Date 인스턴스 반환, 연·월 경계 정확히 처리) */
function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}

/** 최근 3개월 구간을 KIS 00년월일 형식으로 반환 (FID_INPUT_DATE_1, FID_INPUT_DATE_2용) */
function getLast3MonthsKisDates(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);
  return { start: toKisDate00(start), end: toKisDate00(end) };
}

/**
 * 투자자매매동향용: 오늘 기준 정확히 90일 구간 (Start = 오늘-90일, End = 오늘).
 * Date 객체 독립성 보장: 종료일과 시작일에 서로 다른 new Date() 인스턴스 사용. 절대 동일 참조/변조 금지.
 */
function getLast90DaysKisDates(): { startYmd: string; endYmd: string; startKis: string; endKis: string } {
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

/** 최근 분기 말일 YYYYMMDD (재무 API 기준일로 사용) */
function getLatestQuarterEnd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const q = Math.floor(m / 3) + 1;
  const lastMonth = q * 3 - 1;
  const lastDay = new Date(y, lastMonth + 1, 0).getDate();
  return `${y}${String(lastMonth + 1).padStart(2, "0")}${String(lastDay).padStart(2, "0")}`;
}

/** 대차대조표 (FHKST66430100). 0값도 포함해 반환하면 UI에서 재무 요약 섹션이 표시됨 */
export async function getKisBalanceSheet(code: string): Promise<Record<string, number> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) {
    if (process.env.NODE_ENV === "development") console.log("[KIS] balanceSheet skip: invalid code");
    return null;
  }
  const path = KIS_TR_PATH.FHKST66430100;
  if (!path) return null;
  const codeStr = String(code).trim();
  const quarterEnd = getLatestQuarterEnd();
  let body = await kisGet(path, "FHKST66430100", codeStr, { FID_INPUT_DATE_1: quarterEnd, FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0" });
  if (!body) body = await kisGet(path, "FHKST66430100", codeStr, { FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0" });
  if (process.env.NODE_ENV === "development") {
    console.log("[KIS] balanceSheet code=%s quarterEnd=%s body=%s", codeStr, quarterEnd, body ? "ok" : "null");
  }
  if (!body) return null;
  const out = pickFirstOutput(body);
  if (process.env.NODE_ENV === "development") {
    console.log("[KIS] balanceSheet code=%s pickFirstOutput=%s keys=%s", codeStr, out ? "ok" : "null", out ? Object.keys(out).join(",") : "");
  }
  if (!out) return null;
  const totalAssets = parseNum(out.total_aset ?? out.tot_aset ?? out.total_assets ?? out.자산총계 ?? out.TOT_ASET);
  const totalLiabilities = parseNum(out.total_lblt ?? out.tot_liab ?? out.total_liabilities ?? out.부채총계 ?? out.TOT_LIAB);
  const totalEquity = parseNum(out.total_cptl ?? out.tot_eqty ?? out.total_equity ?? out.자본총계 ?? out.TOT_EQTY);
  const cur = parseNum(out.cras ?? out.cur_aset ?? out.current_assets ?? out.유동자산 ?? out.CUR_ASET);
  const nonCur = parseNum(out.fxas ?? out.non_cur_aset ?? out.noncurrent_assets ?? out.비유동자산 ?? out.NON_CUR_ASET);
  const curLiab = parseNum(out.flow_lblt ?? out.cur_liab ?? out.current_liabilities ?? out.유동부채 ?? out.CUR_LIAB);
  const nonCurLiab = parseNum(out.fix_lblt ?? out.non_cur_liab ?? out.noncurrent_liabilities ?? out.비유동부채 ?? out.NON_CUR_LIAB);
  const result: Record<string, number> = {
    totalAssets,
    totalLiabilities,
    totalEquity,
  };
  if (cur !== 0) result.currentAssets = cur;
  if (nonCur !== 0) result.nonCurrentAssets = nonCur;
  if (curLiab !== 0) result.currentLiabilities = curLiab;
  if (nonCurLiab !== 0) result.nonCurrentLiabilities = nonCurLiab;
  return result;
}

/** 손익계산서 (FHKST66430200). 0값도 포함해 반환하면 UI에서 재무 요약 섹션이 표시됨 */
export async function getKisIncomeStatement(code: string): Promise<Record<string, number> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) {
    if (process.env.NODE_ENV === "development") console.log("[KIS] incomeStatement skip: invalid code");
    return null;
  }
  const path = KIS_TR_PATH.FHKST66430200;
  if (!path) return null;
  const codeStr = String(code).trim();
  const quarterEnd = getLatestQuarterEnd();
  let body = await kisGet(path, "FHKST66430200", codeStr, { FID_INPUT_DATE_1: quarterEnd, FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0" });
  if (!body) body = await kisGet(path, "FHKST66430200", codeStr, { FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0" });
  if (process.env.NODE_ENV === "development") {
    console.log("[KIS] incomeStatement code=%s quarterEnd=%s body=%s", codeStr, quarterEnd, body ? "ok" : "null");
  }
  if (!body) return null;
  const out = pickFirstOutput(body);
  if (process.env.NODE_ENV === "development") {
    console.log("[KIS] incomeStatement code=%s pickFirstOutput=%s keys=%s", codeStr, out ? "ok" : "null", out ? Object.keys(out).join(",") : "");
  }
  if (!out) return null;
  const revenue = parseNum(out.sale_account ?? out.rev ?? out.revenue ?? out.매출액 ?? out.REV);
  const operatingIncome = parseNum(out.op_prfi ?? out.bsop_prti ?? out.op_inc ?? out.operating_income ?? out.영업이익 ?? out.OP_INC);
  const netIncome = parseNum(out.thtr_ntin ?? out.net_inc ?? out.net_income ?? out.당기순이익 ?? out.NET_INC);
  return { revenue, operatingIncome, netIncome };
}

/** 재무/비율 API 공통: 기준일 + 재무제표 구분(0=개별, 1=연결). OPSQ2001 FID_DIV_CLS_CODE 방지 */
const financeExtraParams = () => ({
  FID_INPUT_DATE_1: getLatestQuarterEnd(),
  FID_DIV_CLS_CODE: process.env.KIS_FID_DIV_CLS_CODE ?? "0",
});

/** 재무비율 API(FHKST66430300) 스펙 output 필드 — 숫자로 파싱해 채움 */
const FINANCIAL_RATIO_NUM_KEYS = [
  "grs", "bsop_prfi_inrt", "ntin_inrt", "roe_val", "eps", "sps", "bps", "rsrv_rate", "lblt_rate",
  "per", "pbr", "prdy_per", "prdy_pbr", "stck_per", "stck_pbr", "prdy_eps", "stck_eps", "prdy_bps", "stck_bps",
  "PER", "PBR", "EPS", "BPS",
] as const;

function normalizeFinancialRatioOutput(raw: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    if (FINANCIAL_RATIO_NUM_KEYS.includes(k as (typeof FINANCIAL_RATIO_NUM_KEYS)[number])) {
      const n = parseNum(v);
      if (!Number.isNaN(n)) out[k] = n;
    } else if (typeof v === "number" && !Number.isNaN(v)) {
      out[k] = v;
    } else if (typeof v === "string" && /^-?\d+\.?\d*$/.test(v.trim())) {
      const n = parseNum(v);
      if (!Number.isNaN(n)) out[k] = n;
    } else if (typeof v === "string") {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * 재무비율 (FHKST66430300) — 국내주식 재무비율 API.
 * API 스펙: GET /uapi/domestic-stock/v1/finance/financial-ratio
 * Query 필수: FID_DIV_CLS_CODE(0=년,1=분기), fid_cond_mrkt_div_code(J), fid_input_iscd(종목코드).
 * 응답 output: stac_yymm, grs, bsop_prfi_inrt, ntin_inrt, roe_val, eps, sps, bps, rsrv_rate, lblt_rate 등.
 */
export async function getKisFinancialRatio(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430300;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  const body = await kisGet(path, "FHKST66430300", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  const out = pickFirstOutput(body);
  return normalizeFinancialRatioOutput(out);
}

/** 수익성비율 (FHKST66430400) */
export async function getKisProfitRatio(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430400;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  let body = await kisGet(path, "FHKST66430400", codeStr, financeExtraParams());
  if (!body) body = await kisGet(path, "FHKST66430400", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  return pickFirstOutput(body);
}

/** 안정성비율 (FHKST66430600) */
export async function getKisStabilityRatio(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430600;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  let body = await kisGet(path, "FHKST66430600", codeStr, financeExtraParams());
  if (!body) body = await kisGet(path, "FHKST66430600", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  return pickFirstOutput(body);
}

/** 성장성비율 (FHKST66430800) */
export async function getKisGrowthRatio(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430800;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  let body = await kisGet(path, "FHKST66430800", codeStr, financeExtraParams());
  if (!body) body = await kisGet(path, "FHKST66430800", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  return pickFirstOutput(body);
}

/** 기타주요비율 (FHKST66430500) */
export async function getKisOtherMajorRatios(code: string): Promise<Record<string, unknown> | null> {
  if (!/^\d{6}$/.test(String(code).trim())) return null;
  const path = KIS_TR_PATH.FHKST66430500;
  if (!path) return null;
  const codeStr = String(code).trim();
  const divCls = process.env.KIS_FID_DIV_CLS_CODE ?? "0";
  let body = await kisGet(path, "FHKST66430500", codeStr, financeExtraParams());
  if (!body) body = await kisGet(path, "FHKST66430500", codeStr, { FID_DIV_CLS_CODE: divCls });
  if (!body) return null;
  return pickFirstOutput(body);
}

/** KIS 종목추정실적 API 응답 정규화. 스펙: output2(추정손익 6개 배열), output3(투자지표 8개 배열), 각 data1~data5 */
function normalizeEstimatePerformOutput(body: Record<string, unknown>): Record<string, unknown> | null {
  const output2 = body.output2 as Array<Record<string, unknown>> | undefined;
  const output3 = body.output3 as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(output2) && !Array.isArray(output3)) return null;

  const result: Record<string, unknown> = {};
  const parseVal = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(/,/g, ""));
    return Number.isNaN(n) ? null : n;
  };
  const setData = (arr: Record<string, unknown>[], keys: string[], prefix: string) => {
    arr.forEach((row, i) => {
      const key = keys[i];
      if (!key) return;
      const v = row.data1 ?? row.data2 ?? row.data3;
      const num = parseVal(v);
      if (num != null) result[prefix + key] = num;
      else if (v != null && String(v).trim() !== "") result[prefix + key] = v;
    });
  };

  // output2: 매출액, 매출액증감율, 영업이익, 영업이익증감율, 순이익, 순이익증감율 (스펙 순서)
  if (Array.isArray(output2) && output2.length >= 6) {
    setData(output2, ["매출액", "매출액증감율", "영업이익", "영업이익증감율", "순이익", "순이익증감율"], "");
    const rev = parseVal(output2[0]?.data1 ?? output2[0]?.data2);
    const op = parseVal(output2[2]?.data1 ?? output2[2]?.data2);
    const ni = parseVal(output2[4]?.data1 ?? output2[4]?.data2);
    if (rev != null) result.revenue = rev;
    if (op != null) result.operating_income = op;
    if (ni != null) result.net_income = ni;
  }

  // output3: EBITDA(십억), EPS(원), EPS증감율, PER, EV/EBITDA, ROE, 부채비율, 이자보상배율 (스펙 순서 8개)
  if (Array.isArray(output3) && output3.length >= 8) {
    setData(output3, ["EBITDA", "EPS", "EPS증감율", "PER", "EV/EBITDA", "ROE", "부채비율", "이자보상배율"], "");
    const epsVal = parseVal(output3[1]?.data1 ?? output3[1]?.data2);
    if (epsVal != null) {
      result.eps = epsVal;
      result.fwd_eps = epsVal;
      result.forward_eps = epsVal;
    }
    const ebitdaVal = parseVal(output3[0]?.data1 ?? output3[0]?.data2);
    if (ebitdaVal != null) result.ebitda = ebitdaVal * 1e8; // 십억원 → 원
    const perVal = parseVal(output3[3]?.data1 ?? output3[3]?.data2);
    if (perVal != null) result.per = perVal;
    const roeVal = parseVal(output3[5]?.data1 ?? output3[5]?.data2);
    if (roeVal != null) result.roe = roeVal;
  }

  if (Object.keys(result).length === 0) return null;
  return result;
}

/** 종목추정실적 (HHKST668300C0). 스펙: Query SHT_CD=종목코드(6자리), 응답 output1~output4 */
export async function getKisEstimatePerform(code: string): Promise<Record<string, unknown> | null> {
  const codeStr = String(code).trim();
  if (!/^\d{6}$/.test(codeStr)) return null;
  const path = KIS_TR_PATH.HHKST668300C0;
  if (!path) return null;
  // 스펙: Query Parameter SHT_CD = 종목코드(필수), ex) 265520
  const body = await kisGet(path, "HHKST668300C0", codeStr, { SHT_CD: codeStr });
  if (!body) {
    if (process.env.NODE_ENV === "development") {
      console.log("[KIS] estimatePerform code=%s body=null (kisGet 실패)", codeStr);
    }
    return null;
  }
  const normalized = normalizeEstimatePerformOutput(body);
  if (normalized != null) return normalized;
  // 폴백: output1 단일 객체(종목정보)라도 반환
  const out1 = pickFirstOutput(body);
  if (out1 != null && Object.keys(out1).length > 0) return out1;
  if (process.env.NODE_ENV === "development") {
    console.log("[KIS] estimatePerform code=%s normalized=null bodyKeys=%s", codeStr, Object.keys(body).join(","));
  }
  return null;
}

/** 오늘 날짜 YYYYMMDD (투자의견 등 기준일용) */
function getTodayYyyymmdd(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, "");
}

/** 종목투자의견 (FHKST663300C0). 스펙: FID_COND_SCR_DIV_CODE=16633(Primary key), FID_INPUT_DATE_1/2=00년월일(최근 3개월) */
export async function getKisInvestOpinion(code: string): Promise<Record<string, unknown> | null> {
  const codeStr = String(code).trim();
  if (!/^\d{6}$/.test(codeStr)) return null;
  const path = KIS_TR_PATH.FHKST663300C0;
  if (!path) return null;
  const { start, end } = getLast3MonthsKisDates();
  const body = await kisGet(path, "FHKST663300C0", codeStr, {
    FID_COND_SCR_DIV_CODE: process.env.KIS_OPINION_SCR_DIV_CODE ?? "16633",
    FID_INPUT_DATE_1: start,
    FID_INPUT_DATE_2: end,
  });
  if (!body) {
    if (process.env.NODE_ENV === "development") {
      console.log("[KIS] investOpinion code=%s body=null (kisGet 실패) start=%s end=%s", codeStr, start, end);
    }
    return null;
  }
  const out = pickFirstOutput(body);
  if (process.env.NODE_ENV === "development" && out == null) {
    console.log("[KIS] investOpinion code=%s pickFirstOutput=null bodyKeys=%s", codeStr, Object.keys(body).join(","));
  }
  return out;
}

/** 증권사별 투자의견 (FHKST663400C0). 스펙: FID_COND_SCR_DIV_CODE=16634(Primary key), FID_DIV_CLS_CODE=0(전체), FID_INPUT_ISCD=종목코드 */
export async function getKisInvestOpinionBySec(code: string): Promise<unknown[]> {
  const codeStr = String(code).trim();
  if (!/^\d{6}$/.test(codeStr)) return [];
  const path = KIS_TR_PATH.FHKST663400C0;
  if (!path) return [];
  const { start, end } = getLast3MonthsKisDates();
  const body = await kisGet(path, "FHKST663400C0", codeStr, {
    FID_COND_SCR_DIV_CODE: process.env.KIS_OPINION_BYSEC_SCR_DIV_CODE ?? "16634",
    FID_DIV_CLS_CODE: process.env.KIS_OPINION_DIV_CLS_CODE ?? "0",
    FID_INPUT_DATE_1: start,
    FID_INPUT_DATE_2: end,
  });
  if (!body) {
    if (process.env.NODE_ENV === "development") {
      console.log("[KIS] investOpinionBySec code=%s body=null (kisGet 실패) start=%s end=%s", codeStr, start, end);
    }
    return [];
  }
  const list = extractListFromKisBody(body as Record<string, unknown>);
  if (process.env.NODE_ENV === "development" && list.length === 0) {
    console.log("[KIS] investOpinionBySec code=%s extractList=0 bodyKeys=%s", codeStr, Object.keys(body).join(","));
  }
  return list;
}

/** 투자자매매동향 일별(행)인지 판별: 객체에 일자/순매수 관련 키가 있는지 */
function isInvestorTradeRow(obj: unknown): boolean {
  if (obj == null || typeof obj !== "object" || Array.isArray(obj)) return false;
  const k = Object.keys(obj as Record<string, unknown>).join(" ").toLowerCase();
  return /stck_bsop|bsop_dt|prsn_ntby|frgn_ntby|orgn_ntby|일자|순매수/.test(k);
}

/** 단일 KIS 응답 body에서 투자자매매동향 행 배열 추출 */
function parseInvestorTradeDailyBody(raw: Record<string, unknown>): unknown[] {
  let result: unknown[] = [];
  const keysToTry = ["output", "output2", "output1"] as const;
  for (const key of keysToTry) {
    const val = raw[key];
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      const first = val[0];
      if (typeof first === "object" && first !== null && !Array.isArray(first) && isInvestorTradeRow(first)) {
        result = val;
        break;
      }
      continue;
    }
    if (val != null && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const values = Object.values(obj);
      const allArrays = values.length > 0 && values.every((v) => Array.isArray(v));
      const sameLength =
        allArrays &&
        (values as unknown[][]).every((arr) => (arr as unknown[]).length === (values[0] as unknown[]).length);
      if (sameLength) {
        result = transposeOutputToRows(obj);
        break;
      }
      const rowArray = values.find(
        (v) =>
          Array.isArray(v) &&
          v.length > 0 &&
          typeof v[0] === "object" &&
          v[0] !== null &&
          !Array.isArray(v[0]) &&
          isInvestorTradeRow(v[0])
      );
      if (rowArray) {
        result = rowArray as unknown[];
        break;
      }
    }
  }
  if (result.length === 0) {
    const fallback = extractListFromKisBody(raw);
    if (
      Array.isArray(fallback) &&
      fallback.length > 0 &&
      typeof fallback[0] === "object" &&
      fallback[0] !== null &&
      !Array.isArray(fallback[0]) &&
      isInvestorTradeRow(fallback[0])
    )
      result = fallback;
  }
  return result;
}

/** 일자 값을 8자리 YYYYMMDD로 정규화 (4자리 MMDD면 현재 연도 붙임 → 정렬 시 12/6가 12/28보다 앞에 오도록) */
function normalizeRowDateKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(-8);
  if (digits.length === 6) return `20${digits}`;
  if (digits.length === 4) return `${new Date().getFullYear()}${digits}`;
  return digits.padStart(8, "0");
}

/** 행에서 일자 키 값 추출 (8자리 YYYYMMDD로 통일하여 정렬 순서 보장) */
function getRowDateKey(r: Record<string, unknown>): string {
  const dateKeys = ["stck_bsop_date", "stck_bsop_dt", "일자", "date"];
  for (const k of dateKeys) if (r[k] != null) return normalizeRowDateKey(String(r[k])) || "";
  return "";
}

/** 매매동향·일별체결량 공통: 오늘 기준 최근 30일(일력) */
const TRADING_TREND_DAYS = 30;

/**
 * FHPTJ04160001 스펙: FID_INPUT_DATE_1은 "해당일 조회" 단일일(YYYYMMDD). output2가 일별 배열.
 * 일력 기준 -30일 ~ 오늘 구간만 일자별 API 호출 후 일자순 정렬.
 */
export async function getKisInvestorTradeDaily(
  code: string,
  _startDate?: string,
  _endDate?: string
): Promise<unknown[]> {
  if (!/^\d{6}$/.test(String(code).trim())) return [];
  const path = KIS_TR_PATH.FHPTJ04160001;
  if (!path) return [];
  const codeStr = String(code).trim();

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - TRADING_TREND_DAYS);
  const startYmd = dateToYmd(startDate);
  const endYmd = dateToYmd(endDate);

  const byDate: Record<string, Record<string, unknown>> = {};
  for (let i = 0; i <= TRADING_TREND_DAYS; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const ymd = dateToYmd(d);
    if (ymd > endYmd) break;
    const body = await kisGet(path, "FHPTJ04160001", codeStr, {
      FID_INPUT_DATE_1: ymd,
      FID_ORG_ADJ_PRC: "",
      FID_ETC_CLS_CODE: "1",
    });
    if (!body) continue;
    const output2 = body.output2;
    const rows = Array.isArray(output2) ? output2 : parseInvestorTradeDailyBody(body);
    for (const row of rows) {
      if (row == null || typeof row !== "object" || Array.isArray(row)) continue;
      const key = getRowDateKey(row as Record<string, unknown>);
      if (key && key >= startYmd && key <= endYmd && !byDate[key]) byDate[key] = row as Record<string, unknown>;
    }
  }
  return Object.values(byDate).sort((a, b) => getRowDateKey(a).localeCompare(getRowDateKey(b)));
}

/** 컬럼형 응답(키 → 배열)을 행 배열로 전치. 모든 값이 동일 길이 배열일 때만 적용 */
function transposeOutputToRows(output: Record<string, unknown>): unknown[] {
  const entries = Object.entries(output);
  if (entries.length === 0) return [];
  const firstArr = entries[0]![1];
  if (!Array.isArray(firstArr)) return [];
  const len = firstArr.length;
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < len; i++) {
    const row: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      if (Array.isArray(v) && v.length === len) row[k] = v[i];
      else row[k] = v;
    }
    rows.push(row);
  }
  return rows;
}

/** 종목별 일별 매수매도 체결량 (FHKST03010800). 오늘~-30일(일력) 구간만 반환 */
export async function getKisDailyTradeVolume(
  code: string,
  _startDate?: string,
  _endDate?: string
): Promise<unknown[]> {
  if (!/^\d{6}$/.test(String(code).trim())) return [];
  const path = KIS_TR_PATH.FHKST03010800;
  if (!path) return [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - TRADING_TREND_DAYS);
  const startYmd = dateToYmd(startDate);
  const endYmd = dateToYmd(endDate);
  const body = await kisGet(path, "FHKST03010800", String(code).trim(), {
    FID_INPUT_DATE_1: toKisDate00(startDate),
    FID_INPUT_DATE_2: toKisDate00(endDate),
    FID_COND_MRKT_DIV_CODE_1: process.env.KIS_COND_MRKT_DIV_CODE ?? "J",
    FID_INPUT_ISCD_1: String(code).trim(),
    FID_PERIOD_DIV_CODE: "D",
  });
  if (!body) return [];
  const raw = body as Record<string, unknown>;
  let result: unknown[] = [];
  for (const key of ["output", "output2"] as const) {
    const val = raw[key];
    if (Array.isArray(val)) {
      result = val;
      break;
    }
    if (val != null && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const values = Object.values(obj);
      const allArrays = values.length > 0 && values.every((v) => Array.isArray(v));
      const sameLength =
        allArrays &&
        (values as unknown[][]).every((arr) => (arr as unknown[]).length === (values[0] as unknown[]).length);
      if (sameLength) {
        result = transposeOutputToRows(obj);
        break;
      }
      result = extractListFromKisBody(raw);
      break;
    }
  }
  if (result.length === 0) result = extractListFromKisBody(raw);
  result = result.filter((r) => {
    if (r == null || typeof r !== "object" || Array.isArray(r)) return false;
    const rowYmd = getRowDateKey(r as Record<string, unknown>);
    return rowYmd >= startYmd && rowYmd <= endYmd;
  });
  return (result as Record<string, unknown>[]).sort((a, b) =>
    getRowDateKey(a).localeCompare(getRowDateKey(b))
  );
}

/**
 * 주식현재가 일자별 (FHKST01010400). API는 최근 30거래일 반환. 표시는 오늘-30일 ~ 오늘(일력) 구간만 필터.
 */
export async function getKisDailyPrice(code: string): Promise<unknown[]> {
  if (!/^\d{6}$/.test(String(code).trim())) return [];
  const path = KIS_TR_PATH.FHKST01010400;
  if (!path) return [];
  const body = await kisGet(path, "FHKST01010400", String(code).trim(), {
    FID_COND_MRKT_DIV_CODE: "UN",
    FID_PERIOD_DIV_CODE: "D",
    FID_ORG_ADJ_PRC: "1",
  });
  if (!body) return [];
  const output = body.output;
  if (!Array.isArray(output)) return [];
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - TRADING_TREND_DAYS);
  const startYmd = dateToYmd(startDate);
  const endYmd = dateToYmd(endDate);
  return output.filter((r) => {
    if (r == null || typeof r !== "object" || Array.isArray(r)) return false;
    const key = getRowDateKey(r as Record<string, unknown>);
    return key >= startYmd && key <= endYmd;
  });
}

/** 투자의견 한 행에 있을 수 있는 KIS 필드명 (단일 객체 여부 판별용). 스펙 188/189: invt_opnn, hts_goal_prc, stck_bsop_date, mbcr_name */
const OPINION_ROW_KEYS = ["mbcr_name", "broker_nm", "invt_opnn", "hts_goal_prc", "stck_bsop_date", "stck_opnn_txt", "opinion", "stck_tgpr", "target_price", "stck_anal_dt", "date", "증권사명", "의견", "목표가", "제시일"];

/** KIS 응답에서 배열 추출 (output/output2가 배열, 단일 객체, 또는 키별 객체 목록인 경우 대응) */
function extractListFromKisBody(body: Record<string, unknown>): unknown[] {
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

/**
 * 국내주식 [종목 투자의견](FHKST663300C0) + [증권사별 투자의견](FHKST663400C0) 병렬 호출 후 병합.
 */
export async function getInvestmentOpinion(stockCode: string): Promise<KisInvestmentOpinion> {
  const code = String(stockCode ?? "").trim();
  const empty: KisInvestmentOpinion = { tickerOpinion: null, brokerOpinions: [] };
  if (!/^\d{6}$/.test(code)) return empty;

  const [tickerOut, bySecList] = await Promise.all([
    getKisInvestOpinion(code),
    getKisInvestOpinionBySec(code),
  ]);

  const list = Array.isArray(bySecList) ? bySecList : [];
  const brokerOpinions: KisBrokerOpinion[] = list.map((row: unknown) => {
    const r = row as Record<string, unknown>;
    const brokerName =
      r.mbcr_name ?? r.broker_nm ?? r.brokerName ?? r.증권사명 ?? r.mbcr_nm ?? r.orgn_nm;
    const opinion =
      r.invt_opnn ?? r.stck_opnn_txt ?? r.opinion ?? r.의견 ?? r.stck_opnn ?? r.opnn_txt ?? r.opnn;
    const targetPrice = parseNum(
      (r.hts_goal_prc ?? r.stck_tgpr ?? r.target_price ?? r.targetPrice ?? r.목표가 ?? r.stck_tgpr_prc ?? r.tgpr) as string | number
    );
    const date =
      r.stck_bsop_date ?? r.stck_anal_dt ?? r.date ?? r.제시일 ?? r.anal_dt ?? r.report_dt ?? r.rpt_dt;
    return {
      brokerName: brokerName != null ? String(brokerName) : undefined,
      opinion: opinion != null ? String(opinion) : undefined,
      targetPrice: targetPrice > 0 ? targetPrice : undefined,
      date: date != null ? String(date) : undefined,
    };
  });

  const prices = brokerOpinions.map((b) => b.targetPrice).filter((p): p is number => p != null && p > 0);
  const dates = brokerOpinions.map((b) => b.date).filter((d): d is string => !!d);
  let tickerOpinion: KisTickerOpinion | null = null;
  if (tickerOut) {
    const tgPr = parseNum(
      (tickerOut.hts_goal_prc ?? tickerOut.stck_tgpr ?? tickerOut.target_price ?? tickerOut.목표가) as string | number
    );
    const dt = tickerOut.stck_bsop_date ?? tickerOut.stck_anal_dt ?? tickerOut.date ?? tickerOut.제시일;
    const opnn = tickerOut.invt_opnn ?? tickerOut.stck_opnn_txt ?? tickerOut.opinion ?? tickerOut.의견;
    if (tgPr > 0 || dt || opnn) {
      tickerOpinion = {
        opinionName: opnn != null ? String(opnn) : "종목",
        targetPrice: tgPr > 0 ? tgPr : undefined,
        date: dt != null ? String(dt) : (dates.length > 0 ? dates.sort().reverse()[0] : undefined),
        outlook: opnn != null ? String(opnn) : undefined,
      };
    }
  }
  if (!tickerOpinion && prices.length > 0) {
    tickerOpinion = {
      opinionName: "컨센서스",
      targetPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      date: dates.length > 0 ? dates.sort().reverse()[0] : undefined,
    };
  }

  const first = tickerOut ?? (list[0] as Record<string, unknown> | undefined);
  const perVal = first ? parseNum(first.per ?? first.prdy_per ?? first.PER ?? first.stck_per) : 0;
  const pbrVal = first ? parseNum(first.pbr ?? first.prdy_pbr ?? first.PBR ?? first.stck_pbr) : 0;
  const epsVal = first ? parseNum(first.eps ?? first.EPS ?? first.prdy_eps ?? first.stck_eps) : 0;
  const bpsVal = first ? parseNum(first.bps ?? first.BPS ?? first.prdy_bps ?? first.stck_bps) : 0;
  const hasIndicators = perVal > 0 || pbrVal > 0 || epsVal !== 0 || bpsVal !== 0;
  const priceIndicators = hasIndicators
    ? {
        per: perVal > 0 ? perVal : null,
        pbr: pbrVal > 0 ? pbrVal : null,
        eps: epsVal !== 0 ? epsVal : null,
        bps: bpsVal !== 0 ? bpsVal : null,
      }
    : undefined;

  return { tickerOpinion, brokerOpinions, priceIndicators };
}
