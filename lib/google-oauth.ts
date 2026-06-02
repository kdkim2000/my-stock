/**
 * Google Service Account OAuth2 토큰 발급 공통 모듈.
 * google-auth-library 없이 crypto 모듈로 직접 JWT 서명.
 * globalThis 캐시로 동일 서버리스 인스턴스 내 중복 발급 방지.
 */

import { createSign } from "crypto";
import { readFile } from "fs/promises";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_AUDIENCE = "https://oauth2.googleapis.com/token";
const GTOKEN_CACHE_KEY = "__GOOGLE_SHEETS_TOKEN_CACHE__" as const;
const GTOKEN_BUFFER_MS = 5 * 60 * 1000;

type GTokenCache = {
  token: string;
  expiresAt: number;
  promise: Promise<string | null> | null;
};

function getCache(): GTokenCache {
  const g = globalThis as unknown as Record<string, GTokenCache>;
  if (!g[GTOKEN_CACHE_KEY]) {
    g[GTOKEN_CACHE_KEY] = { token: "", expiresAt: 0, promise: null };
  }
  return g[GTOKEN_CACHE_KEY];
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 서비스 계정 자격증명으로 Google OAuth2 액세스 토큰 발급 (인스턴스 내 캐싱) */
export async function getAccessTokenFromServiceAccount(
  clientEmail: string,
  privateKeyPem: string
): Promise<string | null> {
  const cache = getCache();

  if (cache.token && cache.expiresAt > Date.now()) {
    return cache.token;
  }

  if (cache.promise) {
    return cache.promise;
  }

  cache.promise = (async (): Promise<string | null> => {
    try {
      const now = Math.floor(Date.now() / 1000);
      const header = { alg: "RS256", typ: "JWT" };
      const payload = {
        iss: clientEmail,
        scope: SCOPE,
        aud: TOKEN_AUDIENCE,
        iat: now,
        exp: now + 3600,
      };
      const headerB64 = base64urlEncode(Buffer.from(JSON.stringify(header)));
      const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(payload)));
      const sigInput = `${headerB64}.${payloadB64}`;
      const sign = createSign("RSA-SHA256");
      sign.update(sigInput);
      const jwt = `${sigInput}.${base64urlEncode(sign.sign(privateKeyPem))}`;

      const res = await fetch(TOKEN_AUDIENCE, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }).toString(),
      });

      if (!res.ok) {
        console.error("[GoogleOAuth] Token error:", res.status, await res.text());
        return null;
      }

      const data = (await res.json()) as { access_token?: string };
      const token = data.access_token ?? null;
      if (token) {
        cache.token = token;
        cache.expiresAt = Date.now() + 3600 * 1000 - GTOKEN_BUFFER_MS;
      }
      return token;
    } catch (e) {
      console.error("[GoogleOAuth] Exception during token fetch:", e);
      return null;
    } finally {
      cache.promise = null;
    }
  })();

  return cache.promise;
}

/** 환경 변수(GOOGLE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_APPLICATION_CREDENTIALS)에서 토큰 획득 */
export async function getServiceAccountToken(): Promise<string | null> {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonStr) {
    try {
      const creds = JSON.parse(jsonStr) as { client_email?: string; private_key?: string };
      if (creds.client_email && creds.private_key) {
        return getAccessTokenFromServiceAccount(creds.client_email, creds.private_key);
      }
    } catch {
      return null;
    }
  }

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (keyPath) {
    try {
      const raw = await readFile(keyPath, "utf-8");
      const creds = JSON.parse(raw) as { client_email?: string; private_key?: string };
      if (creds.client_email && creds.private_key) {
        return getAccessTokenFromServiceAccount(creds.client_email, creds.private_key);
      }
    } catch {
      return null;
    }
  }

  return null;
}
