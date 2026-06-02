/** 종목코드를 6자리 숫자 문자열로 정규화. 유효하지 않으면 undefined 반환. */
export function normalizeStockCode(
  input: string | number | undefined | null
): string | undefined {
  if (input == null) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;
  if (/^\d{6}$/.test(s)) return s;
  if (/^\d+$/.test(s) && s.length <= 6) return s.padStart(6, "0");
  return undefined;
}

/** 6자리 숫자이고 000000이 아닌 경우 true */
export function isValidStockCode(code: string | undefined | null): boolean {
  if (!code) return false;
  return /^\d{6}$/.test(code) && code !== "000000";
}
