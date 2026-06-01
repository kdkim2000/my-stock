import { describe, it, expect } from "vitest";
import { normalizeStockCode, isValidStockCode } from "../../lib/stock-utils";

describe("normalizeStockCode", () => {
  it("6자리 숫자는 그대로 반환", () => {
    expect(normalizeStockCode("005930")).toBe("005930");
  });

  it("짧은 숫자는 6자리로 패딩", () => {
    expect(normalizeStockCode("5930")).toBe("005930");
    expect(normalizeStockCode(5930)).toBe("005930");
    expect(normalizeStockCode("1")).toBe("000001");
  });

  it("undefined/null은 undefined 반환", () => {
    expect(normalizeStockCode(undefined)).toBeUndefined();
    expect(normalizeStockCode(null)).toBeUndefined();
    expect(normalizeStockCode("")).toBeUndefined();
  });

  it("숫자 아닌 문자열은 undefined 반환", () => {
    expect(normalizeStockCode("삼성전자")).toBeUndefined();
    expect(normalizeStockCode("AAPL")).toBeUndefined();
  });

  it("7자리 이상 숫자는 undefined 반환", () => {
    expect(normalizeStockCode("1234567")).toBeUndefined();
  });
});

describe("isValidStockCode", () => {
  it("유효한 6자리 숫자 코드는 true", () => {
    expect(isValidStockCode("005930")).toBe(true);
    expect(isValidStockCode("000660")).toBe(true);
  });

  it("000000은 false (패딩 오류 구분)", () => {
    expect(isValidStockCode("000000")).toBe(false);
  });

  it("5자리 코드는 false", () => {
    expect(isValidStockCode("05930")).toBe(false);
  });

  it("undefined/null은 false", () => {
    expect(isValidStockCode(undefined)).toBe(false);
    expect(isValidStockCode(null)).toBe(false);
  });

  it("문자가 섞인 코드는 false", () => {
    expect(isValidStockCode("00593A")).toBe(false);
  });
});
