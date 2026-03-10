/** KIS 응답 캐시 (EGW00201 완화 + 호출 최소화). key → { data, expires } */
const GLOBAL_KIS_CACHE_KEY = "__KIS_RESPONSE_CACHE__" as const;
type CacheEntry = { data: unknown; expires: number };

function getKisCache(): Map<string, CacheEntry> {
  const g = globalThis as unknown as Record<string, Map<string, CacheEntry>>;
  if (!g[GLOBAL_KIS_CACHE_KEY]) g[GLOBAL_KIS_CACHE_KEY] = new Map();
  return g[GLOBAL_KIS_CACHE_KEY];
}

export function kisCacheGet<T>(key: string): T | null {
  const entry = getKisCache().get(key);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.data as T;
}

export function kisCacheSet(key: string, data: unknown, ttlMs: number): void {
  getKisCache().set(key, { data, expires: Date.now() + ttlMs });
}

export const KIS_CACHE_TTL_PRICE_MS = 60 * 1000;
export const KIS_CACHE_TTL_FUND_MS = 300 * 1000;
