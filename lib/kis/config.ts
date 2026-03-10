const DEFAULT_BASE_URL = "https://openapi.koreainvestment.com:9443";
const VPS_BASE_URL = "https://openapivts.koreainvestment.com:29443";

export function getBaseUrl(): string {
  const url = process.env.KIS_APP_URL;
  if (url) return url;
  return process.env.KIS_APP_SVR === "vps" ? VPS_BASE_URL : DEFAULT_BASE_URL;
}

export const KIS_TR_PATH: Record<string, string> = {
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
