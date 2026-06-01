import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isCacheValid } from "../../lib/ticker-cache";

/**
 * KST 시각으로 시스템 시간을 설정하는 헬퍼.
 * 기준일: 2024-06-03(월) ~ 2024-06-09(일)
 * kstDay: 1=월,2=화,3=수,4=목,5=금,6=토,0=일
 */
function mockKstTime(kstHour: number, kstMinute: number, kstDay: number) {
  // 2024-06-03 = Monday (kstDay=1)
  // UTC 날짜 오프셋: kstDay=1 → 0, 2 → 1, ..., 6 → 5, 0(Sun) → 6
  const dayOffset = kstDay === 0 ? 6 : kstDay - 1;
  // KST 09:00 = UTC 00:00 → KST hh:mm = UTC (hh-9):mm
  // Target UTC = 2024-06-03T00:00:00Z + dayOffset days + (kstHour-9)h + kstMin
  const baseUtcMs = Date.UTC(2024, 5, 3, 0, 0, 0, 0); // 2024-06-03 00:00 UTC = Mon 09:00 KST
  const targetUtcMs =
    baseUtcMs +
    dayOffset * 24 * 60 * 60 * 1000 +
    (kstHour - 9) * 60 * 60 * 1000 +
    kstMinute * 60 * 1000;
  vi.setSystemTime(new Date(targetUtcMs));
}

describe("isCacheValid", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("장중 (평일 09:00~15:30 KST)", () => {
    it("30분 이내 캐시는 유효", () => {
      mockKstTime(10, 0, 1); // 월요일 10:00 KST
      const updatedAt = new Date(Date.now() - 29 * 60 * 1000).toISOString();
      expect(isCacheValid(updatedAt)).toBe(true);
    });

    it("30분 초과 캐시는 만료", () => {
      mockKstTime(10, 0, 1); // 월요일 10:00 KST
      const updatedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
      expect(isCacheValid(updatedAt)).toBe(false);
    });

    it("정확히 30분은 만료", () => {
      mockKstTime(11, 0, 1);
      const updatedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      expect(isCacheValid(updatedAt)).toBe(false);
    });
  });

  describe("장 마감 후 (평일 15:30 이후 KST)", () => {
    it("오래된 캐시도 다음 장 시작 전까지 유효", () => {
      mockKstTime(20, 0, 1); // 월요일 20:00 KST (장 마감 후)
      const updatedAt = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(); // 5시간 전
      expect(isCacheValid(updatedAt)).toBe(true);
    });
  });

  describe("장 시작 전 (평일 00:00~08:59 KST)", () => {
    it("오늘 09:00 KST 이전이면 유효", () => {
      mockKstTime(8, 0, 2); // 화요일 08:00 KST (장 시작 전)
      const updatedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3시간 전
      expect(isCacheValid(updatedAt)).toBe(true);
    });
  });

  describe("주말", () => {
    it("토요일: 다음 월요일 장 시작 전까지 유효", () => {
      mockKstTime(12, 0, 6); // 토요일 12:00 KST
      const updatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(isCacheValid(updatedAt)).toBe(true);
    });

    it("일요일: 월요일 장 시작 전까지 유효", () => {
      mockKstTime(15, 0, 0); // 일요일 15:00 KST
      const updatedAt = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      expect(isCacheValid(updatedAt)).toBe(true);
    });
  });

  describe("잘못된 입력", () => {
    it("빈 문자열은 false", () => {
      mockKstTime(10, 0, 1);
      expect(isCacheValid("")).toBe(false);
    });

    it("유효하지 않은 날짜 문자열은 false", () => {
      mockKstTime(10, 0, 1);
      expect(isCacheValid("not-a-date")).toBe(false);
    });
  });
});
