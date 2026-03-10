import { kisGet } from "./client";
import { KIS_TR_PATH } from "./config";
import { pickFirstOutput } from "./utils";

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

  if (Array.isArray(output2) && output2.length >= 6) {
    setData(output2, ["매출액", "매출액증감율", "영업이익", "영업이익증감율", "순이익", "순이익증감율"], "");
    const rev = parseVal(output2[0]?.data1 ?? output2[0]?.data2);
    const op = parseVal(output2[2]?.data1 ?? output2[2]?.data2);
    const ni = parseVal(output2[4]?.data1 ?? output2[4]?.data2);
    if (rev != null) result.revenue = rev;
    if (op != null) result.operating_income = op;
    if (ni != null) result.net_income = ni;
  }

  if (Array.isArray(output3) && output3.length >= 8) {
    setData(output3, ["EBITDA", "EPS", "EPS증감율", "PER", "EV/EBITDA", "ROE", "부채비율", "이자보상배율"], "");
    const epsVal = parseVal(output3[1]?.data1 ?? output3[1]?.data2);
    if (epsVal != null) {
      result.eps = epsVal;
      result.fwd_eps = epsVal;
      result.forward_eps = epsVal;
    }
    const ebitdaVal = parseVal(output3[0]?.data1 ?? output3[0]?.data2);
    if (ebitdaVal != null) result.ebitda = ebitdaVal * 1e8; 
    const perVal = parseVal(output3[3]?.data1 ?? output3[3]?.data2);
    if (perVal != null) result.per = perVal;
    const roeVal = parseVal(output3[5]?.data1 ?? output3[5]?.data2);
    if (roeVal != null) result.roe = roeVal;
  }

  if (Object.keys(result).length === 0) return null;
  return result;
}

export async function getKisEstimatePerform(code: string): Promise<Record<string, unknown> | null> {
  const codeStr = String(code).trim();
  if (!/^\d{6}$/.test(codeStr)) return null;
  const path = KIS_TR_PATH.HHKST668300C0;
  if (!path) return null;
  const body = await kisGet(path, "HHKST668300C0", codeStr, { SHT_CD: codeStr });
  if (!body) {
    if (process.env.NODE_ENV === "development") {
      console.log("[KIS] estimatePerform code=%s body=null (kisGet 실패)", codeStr);
    }
    return null;
  }
  const normalized = normalizeEstimatePerformOutput(body);
  if (normalized != null) return normalized;
  const out1 = pickFirstOutput(body);
  if (out1 != null && Object.keys(out1).length > 0) return out1;
  return null;
}
