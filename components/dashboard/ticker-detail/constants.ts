export const RATIO_LABELS: Record<string, string> = {
  per: "PER", pbr: "PBR", eps: "EPS", bps: "BPS", roe: "ROE(%)", roa: "ROA(%)",
  prdy_per: "PER", prdy_pbr: "PBR", stck_per: "PER", stck_pbr: "PBR",
  stac_yymm: "결산년월", roe_val: "ROE(%)", sps: "주당매출액", rsrv_rate: "유보비율(%)", lblt_rate: "부채비율(%)",
  grs: "매출액증가율(%)", bsop_prfi_inrt: "영업이익증가율(%)", ntin_inrt: "순이익증가율(%)",
  op_rt: "영업이익률(%)", op_mgn: "영업이익률", net_rt: "순이익률", net_mgn: "순이익률",
  debt_rt: "부채비율(%)", cur_rt: "유동비율(%)", cpa_rt: "유동비율",
  rev_gr: "매출성장률(%)", inc_gr: "이익성장률(%)",
  cptl_ntin_rate: "자본순이익률", self_cptl_ntin_inrt: "자기자본순이익률", sale_ntin_rate: "매출순이익률", sale_totl_rate: "매출총이익률",
  bram_depn: "유동비율(배)", crnt_rate: "유동비율(%)", quck_rate: "당좌비율",
  equt_inrt: "자본증가율", totl_aset_inrt: "총자산증가율",
  payout_rate: "배당성향", eva: "EVA", ebitda: "EBITDA", ev_ebitda: "EV/EBITDA",
};

export const RATIO_KIS_GROUPS: { title: string; dataKey: keyof { financialRatio: unknown; profitRatio: unknown; stabilityRatio: unknown; growthRatio: unknown; otherMajorRatios: unknown }; items: { key: string; label: string; isAmount?: boolean; isRate?: boolean }[] }[] = [
  {
    title: "재무비율",
    dataKey: "financialRatio",
    items: [
      { key: "grs", label: "매출액증가율", isRate: true },
      { key: "bsop_prfi_inrt", label: "영업이익증가율", isRate: true },
      { key: "ntin_inrt", label: "순이익증가율", isRate: true },
      { key: "roe_val", label: "ROE", isRate: true },
      { key: "eps", label: "EPS", isAmount: true },
      { key: "sps", label: "주당매출액", isAmount: true },
      { key: "bps", label: "BPS", isAmount: true },
    ],
  },
  {
    title: "수익성비율",
    dataKey: "profitRatio",
    items: [
      { key: "cptl_ntin_rate", label: "자본순이익률", isRate: true },
      { key: "self_cptl_ntin_inrt", label: "자기자본순이익률", isRate: true },
      { key: "sale_ntin_rate", label: "매출순이익률", isRate: true },
      { key: "sale_totl_rate", label: "매출총이익률", isRate: true },
    ],
  },
  {
    title: "안정성비율",
    dataKey: "stabilityRatio",
    items: [
      { key: "lblt_rate", label: "부채비율", isRate: true },
      { key: "bram_depn", label: "유동비율(배)" },
      { key: "crnt_rate", label: "유동비율", isRate: true },
      { key: "quck_rate", label: "당좌비율" },
    ],
  },
  {
    title: "성장성비율",
    dataKey: "growthRatio",
    items: [
      { key: "grs", label: "매출액증가율", isRate: true },
      { key: "bsop_prfi_inrt", label: "영업이익증가율", isRate: true },
      { key: "equt_inrt", label: "자본증가율", isRate: true },
      { key: "totl_aset_inrt", label: "총자산증가율", isRate: true },
    ],
  },
  {
    title: "기타주요비율",
    dataKey: "otherMajorRatios",
    items: [
      { key: "payout_rate", label: "배당성향" },
      { key: "eva", label: "EVA", isAmount: true },
      { key: "ebitda", label: "EBITDA", isAmount: true },
      { key: "ev_ebitda", label: "EV/EBITDA" },
    ],
  },
];

export const ESTIMATE_PERFORM_GROUPS: { title: string; items: { key: string; label: string; isAmount?: boolean; isRate?: boolean }[] }[] = [
  {
    title: "추정손익계산서",
    items: [
      { key: "매출액", label: "매출액", isAmount: true },
      { key: "매출액증감율", label: "매출액 증감율", isRate: true },
      { key: "영업이익", label: "영업이익", isAmount: true },
      { key: "영업이익증감율", label: "영업이익 증감율", isRate: true },
      { key: "순이익", label: "순이익", isAmount: true },
      { key: "순이익증감율", label: "순이익 증감율", isRate: true },
    ],
  },
  {
    title: "투자지표",
    items: [
      { key: "EBITDA", label: "EBITDA", isAmount: true },
      { key: "EPS", label: "EPS(원)", isAmount: true },
      { key: "EPS증감율", label: "EPS 증감율", isRate: true },
      { key: "PER", label: "PER(배)" },
      { key: "EV/EBITDA", label: "EV/EBITDA(배)" },
      { key: "ROE", label: "ROE(%)", isRate: true },
      { key: "부채비율", label: "부채비율(%)", isRate: true },
      { key: "이자보상배율", label: "이자보상배율" },
    ],
  },
];

export const RATIO_ONLY_KEYS = new Set([
  "roe_val", "roe", "roa", "grs", "bsop_prfi_inrt", "ntin_inrt", "lblt_rate", "debt_rt",
  "op_rt", "net_rt", "cur_rt", "crnt_rate", "quck_rate", "cpa_rt",
  "cptl_ntin_rate", "self_cptl_ntin_inrt", "sale_ntin_rate", "sale_totl_rate",
  "equt_inrt", "totl_aset_inrt", "payout_rate", "rev_gr", "inc_gr",
  "per", "prdy_per", "stck_per", "pbr", "prdy_pbr", "stck_pbr", "ev_ebitda",
]);

export const VALUE_ONLY_KEYS = new Set([
  "eps", "bps", "sps", "ebitda", "eva", "bram_depn",
]);
