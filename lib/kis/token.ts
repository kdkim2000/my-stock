import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import os from "os";
import path from "path";
import { getBaseUrl } from "./config";
import { readTokenFromSheets, writeTokenToSheets } from "./token-store";


const EXPIRE_BUFFER_MS = 60 * 1000;
const TOKEN_RETRY_AFTER_MS = 62 * 1000;
const GLOBAL_KEY = "__KIS_TOKEN_CACHE__" as const;

export type TokenEntry = { token: string; expiresAt: number };
type FileReadResult = { token: string; expiresAt: number } | { cooldownUntil: number } | null;
type GlobalCache = {
  cachedToken: TokenEntry | null;
  refreshPromise: Promise<string | null> | null;
  fileReadPromise: Promise<FileReadResult> | null;
  tokenPCooldownUntil: number;
};

function getGlobal(): GlobalCache {
  const g = globalThis as unknown as Record<string, GlobalCache>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      cachedToken: null,
      refreshPromise: null,
      fileReadPromise: null,
      tokenPCooldownUntil: 0,
    };
  }
  return g[GLOBAL_KEY];
}

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

async function readTokenFromFile(): Promise<{ token: string; expiresAt: number } | { cooldownUntil: number } | null> {
  // Google Sheets를 공유 저장소로 먼저 조회 (Vercel·로컬 공통)
  try {
    const sheetEntry = await readTokenFromSheets();
    if (sheetEntry) return sheetEntry;
  } catch {
    // Sheets 조회 실패 시 로컬 파일로 fallback
  }

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
    //
  }
  return null;
}

async function writeTokenToFile(entry: TokenEntry | { cooldownUntil: number }): Promise<void> {
  // Google Sheets에도 동시 저장 (Vercel·로컬 공통)
  if ("token" in entry) {
    writeTokenToSheets(entry).catch((err) => {
      console.warn("[KIS] Google Sheets 토큰 저장 실패:", err);
    });
  }

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
      //
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
    //
  }
}

let cachedToken: TokenEntry | null = null;
let refreshPromise: Promise<string | null> | null = null;
let tokenPCooldownUntil = 0;

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

export function isCachedTokenExpired(): boolean {
  return !cachedToken || cachedToken.expiresAt <= Date.now();
}

export function clearKisTokenCache(): void {
  cachedToken = null;
  refreshPromise = null;
  tokenPCooldownUntil = 0;
  const gl = getGlobal();
  gl.cachedToken = null;
  gl.refreshPromise = null;
  gl.fileReadPromise = null;
  gl.tokenPCooldownUntil = 0;
  const p = getTokenCachePath();
  if (p && existsSync(p)) {
    unlink(p).catch(() => { });
  }
}

export function isKisTokenExpiredResponse(bodyText: string): boolean {
  try {
    const j = JSON.parse(bodyText) as { msg_cd?: string; msg1?: string };
    return j.msg_cd === "EGW00123" || /만료된\s*token|기간이\s*만료된\s*token/i.test(j.msg1 ?? "");
  } catch {
    return /만료된\s*token|기간이\s*만료된\s*token/i.test(bodyText);
  }
}

function parseExpiresAt(expiredStr: string): number {
  const s = expiredStr.replace(" ", "T").trim();
  // KIS API는 KST(한국시간)를 반환하므로 Z 대신 +09:00을 붙여 명시함
  const iso = s.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}+09:00`;
  const d = new Date(iso);
  return d.getTime() - EXPIRE_BUFFER_MS;
}

export async function getAccessToken(): Promise<string | null> {
  const appkey = process.env.KIS_APP_KEY?.trim();
  const appsecret = process.env.KIS_APP_SECRET?.trim();
  if (!appkey || !appsecret) return null;

  const gl = getGlobal();
  cachedToken = gl.cachedToken;
  tokenPCooldownUntil = gl.tokenPCooldownUntil;
  refreshPromise = gl.refreshPromise;

  // 1단계: 인메모리 캐시 (가장 빠름)
  if (!syncFromGlobalAndCheckExpired()) return cachedToken!.token;

  // 2단계: refreshPromise 가 진행 중이면 대기 (★ readTokenFromFile 보다 먼저 체크)
  //   기존 코드는 readTokenFromFile() 후에 체크하여 12개 동시 호출이
  //   모두 Sheets 읽기를 실행하는 경합이 발생했음.
  if (refreshPromise) {
    await refreshPromise;
    gl.refreshPromise = null;
    refreshPromise = null;
    if (!syncFromGlobalAndCheckExpired()) return cachedToken!.token;
    return getAccessToken();
  }

  // 3단계: 파일/Sheets 읽기
  //   globalThis에 fileReadPromise를 캐싱하여 동시 호출이 하나의 Sheets 읽기를 공유.
  //   Promise가 resolve된 후에도 유지하여 재호출 시 Sheets를 다시 읽지 않음.
  //   (토큰이 만료되거나 clearKisTokenCache() 호출 시에만 초기화됨)
  if (!gl.fileReadPromise) {
    gl.fileReadPromise = readTokenFromFile();
  }
  const fileEntry = await gl.fileReadPromise;
  if (fileEntry && "token" in fileEntry && fileEntry.expiresAt > Date.now()) {
    cachedToken = { token: fileEntry.token, expiresAt: fileEntry.expiresAt };
    gl.cachedToken = cachedToken;
    return cachedToken.token;
  }
  // fileReadPromise 결과가 유효하지 않으면 초기화하여 다음 호출에서 다시 읽을 수 있도록 함
  gl.fileReadPromise = null;
  if (fileEntry && "cooldownUntil" in fileEntry && fileEntry.cooldownUntil > Date.now()) {
    const waitMs = fileEntry.cooldownUntil - Date.now();
    await new Promise((r) => setTimeout(r, Math.min(waitMs, TOKEN_RETRY_AFTER_MS)));
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
