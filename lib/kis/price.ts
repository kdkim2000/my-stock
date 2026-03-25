import { parseNum } from "../utils";
import { getAccessToken, clearKisTokenCache, isKisTokenExpiredResponse } from "./token";
import { waitKisThrottle, releaseKisThrottle } from "./throttle";
import { kisCacheGet, kisCacheSet, KIS_CACHE_TTL_PRICE_MS, KIS_CACHE_TTL_FUND_MS } from "./cache";
import { getBaseUrl } from "./config";
import { toKisDate00 } from "./utils";
import type { KisPriceInfo, KisDailyChartPoint } from "@/types/api";

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

export async function getPriceInfo(tickerCode: string): Promise<KisPriceInfo | null> {
  const code = String(tickerCode ?? "").trim();
  if (!/^\d{6}$/.test(code)) return null;

  const cacheKey = `priceInfo:${code}`;
  const cached = kisCacheGet<KisPriceInfo>(cacheKey);
  if (cached != null) return cached;

  await waitKisThrottle();
  try {
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
  } finally {
    releaseKisThrottle();
  }
}

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
  try {
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
  } finally {
    releaseKisThrottle();
  }
}
