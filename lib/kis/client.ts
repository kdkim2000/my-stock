import { waitKisThrottle } from "./throttle";
import { getAccessToken, clearKisTokenCache, isKisTokenExpiredResponse } from "./token";
import { kisCacheGet, kisCacheSet, KIS_CACHE_TTL_PRICE_MS, KIS_CACHE_TTL_FUND_MS } from "./cache";
import { getBaseUrl } from "./config";

export async function kisGet(
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
