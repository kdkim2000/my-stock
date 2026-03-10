import { parseNum } from "../utils";
import { kisGet } from "./client";
import { KIS_TR_PATH } from "./config";
import { pickFirstOutput, getLast3MonthsKisDates, extractListFromKisBody } from "./utils";
import type { KisBrokerOpinion, KisTickerOpinion, KisInvestmentOpinion } from "@/types/api";

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
  return out;
}

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
  return list;
}

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
