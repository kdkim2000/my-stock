# 종목 상세 페이지 속도 개선 계획

**작성일**: 2026-06-02  
**대상**: `/dashboard/ticker/[id]` 초기 로드 및 갱신 속도  
**브랜치**: 01_claude

---

## Context

종목 상세 페이지 로드 시 체감 속도가 느리다. Google Sheets 캐시를 사용 중임에도 캐시 히트 시에도 느리고, 캐시 미스(첫 조회·갱신) 시에는 더욱 느리다. 원인을 분석하면 두 가지 독립적인 병목이 복합적으로 작용하고 있다.

---

## 병목 원인 분석

### 병목 1: Google Sheets 캐시 읽기가 요청마다 전체 시트를 조회 (최고 우선순위)

**파일**: `lib/ticker-cache.ts:145-197` (`readTickerCache()`)

```typescript
// 매 호출마다 _TICKER_CACHE_ 시트 전체(A:D)를 Sheets API로 가져옴
const range = encodeURIComponent(`'${SHEET_TAB}'!A:D`);
const res = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}` } });
// 결과를 메모리에 캐싱하지 않음 → 같은 페이지 로드에서 6회 중복 호출
```

페이지 로드 시 캐시를 확인하는 API 라우트:  
`fundamental`, `ratios`, `estimate`, `trading`, `indicators`, `opinion` → **6회 Sheets API 호출**

Sheets API 1회 = ~100–300ms → 6회 = **600–1800ms** (캐시 히트 시에도 매번 발생)

**인메모리 공유 레이어 없음**: `globalThis` 기반 단기 캐시가 없어 같은 요청 버스트 안에서도 6회를 모두 실행.

---

### 병목 2: DART 5개년 데이터 직렬 루프 (캐시 미스 시)

**파일**: `lib/dart-fundamental.ts:136-161` (`getDartTrendOnly()`)

```typescript
for (let y = year; y >= year - 4; y--) {       // 5개 연도 순차 실행
  for (const reprtCode of REPRT_CODE_FALLBACK) { // 연도별 최대 4회 순차 시도
    list = await getFnlttSinglAcnt(...);          // DART API 직렬 호출
    if (list.length > 0) break;
  }
}
// 결과: 연도당 평균 ~300ms × 5년 = ~1.5s 직렬
```

5개 연도를 병렬로 실행 가능함에도 순차 실행 중. 각 연도 내 분기 폴백(최대 4회)은 순차가 맞지만, **연도 간은 독립적**이므로 병렬화 가능.

---

### 병목 3: 클라이언트 탭 전환 시 불필요한 리패치 (중간 우선순위)

**파일**: `hooks/useTickerDetailQueries.ts` 등 모든 쿼리 훅

- `staleTime: 30분` 설정에도 `refetchOnWindowFocus` 기본값(`true`)으로 탭 전환 시마다 staleness 체크 후 리패치
- 6개 이상 쿼리가 동시에 네트워크 요청 발생

---

### 병목 4: `writeTickerCache()` 마다 Sheets 2회 호출 (낮은 우선순위)

**파일**: `lib/ticker-cache.ts:203-271`

```
캐시 저장 시: (1) A:B 열 전체 조회(행 검색) + (2) PUT/POST
= 요청당 Sheets 2회
```

fire-and-forget이라 응답은 지연시키지 않지만, Sheets API 할당량을 소진함. 인메모리에 행 인덱스를 캐싱하면 조회 1회 제거 가능.

---

## 수정 계획

### 수정 1: `ticker-cache.ts` — 인메모리 단기 캐시 레이어 추가 (CRITICAL)

`readTickerCache()`를 호출할 때마다 Sheets API를 호출하는 대신, `globalThis`에 시트 전체 데이터를 60초간 캐시한다.

**추가할 구조** (`lib/ticker-cache.ts` 상단):

```typescript
const ROWS_CACHE_KEY = "__TICKER_CACHE_ROWS__";
const ROWS_CACHE_TTL_MS = 60 * 1000; // 60초

type RowsCacheGlobal = {
  rows: unknown[][];
  fetchedAt: number;
  promise: Promise<unknown[][]> | null;
};

function getRowsGlobal(): RowsCacheGlobal { /* globalThis 초기화 */ }
```

**`readTickerCache()` 수정 흐름**:
1. `rowsGlobal.promise` 진행 중이면 대기 (동시 호출 중복 제거)
2. `rows`가 60초 이내이면 즉시 로컬 스캔
3. 만료 시 Sheets API 1회 호출 → `rows`, `fetchedAt` 갱신

**`writeTickerCache()` 수정**:  
쓰기 성공 후 `rowsGlobal.rows`에서 해당 행을 직접 갱신하고 행 인덱스도 캐시 → 다음 쓰기에서 검색 Sheets 호출 불필요.  
쓰기 완료 후 메모리 캐시 무효화(`fetchedAt = 0`)는 불필요 — 이미 업데이트된 rows를 직접 반영하기 때문.

**예상 효과**:
- 페이지 로드 시 Sheets 호출: 6회 → **1회** (최초만, 이후 메모리)
- 캐시 히트 응답: ~600–1800ms 감소 → **~100–200ms**

---

### 수정 2: `dart-fundamental.ts` — DART 연도 루프 병렬화 (HIGH)

**파일**: `lib/dart-fundamental.ts`, `getDartTrendOnly()` 함수

```typescript
// 변경 전: 5개 연도 순차
for (let y = year; y >= year - 4; y--) {
  for (const reprtCode of REPRT_CODE_FALLBACK) {
    list = await getFnlttSinglAcnt(corpCode, String(y), reprtCode);
    if (list.length > 0) break;
  }
}

// 변경 후: 5개 연도 병렬, 연도 내 분기 폴백은 순차 유지
const years = Array.from({ length: 5 }, (_, i) => year - i);
const yearResults = await Promise.all(
  years.map(async (y) => {
    for (const reprtCode of REPRT_CODE_FALLBACK) {
      const list = await getFnlttSinglAcnt(corpCode, String(y), reprtCode);
      if (list.length > 0) return { y, list };
    }
    return null;
  })
);
const multiYear = yearResults
  .filter(Boolean)
  .map(({ y, list }) => ({ year: String(y), ...buildYearData(list) }));
```

`getFundamentalFinancials()` (같은 파일)도 동일 패턴 적용.

**예상 효과**:
- DART 5년 직렬 ~1.5s → 가장 느린 단일 연도 ~300ms = **~1.2s 단축**

---

### 수정 3: 클라이언트 쿼리 — `refetchOnWindowFocus: false` (MEDIUM)

**파일**: `hooks/useTickerDetailQueries.ts`, `hooks/useFundamentalData.ts`, `hooks/useFundamentalExtended.ts`

staleTime이 30분인 쿼리에 `refetchOnWindowFocus: false` 추가.

```typescript
// useTickerDetailQueries.ts — stockInfoQuery, indicatorsQuery, opinionQuery
{
  staleTime: STALE_TIME_MS,
  refetchOnWindowFocus: false,  // 추가
}
// useFundamentalData, useFundamentalExtended 내 모든 useQuery에도 동일 적용
```

**예상 효과**: 탭 전환 시 불필요한 6개 API 재요청 방지

---

### 수정 4: `/api/fundamental/ratios` — `Promise.all` → `Promise.allSettled` (MEDIUM)

**파일**: `app/api/fundamental/ratios/route.ts:53-60`

KIS 5개 비율 API 중 하나 실패 시 전체 실패 → 부분 성공 허용.

```typescript
// 변경 전
const [financialRatio, profitRatio, ...] = await Promise.all([...]);

// 변경 후
const results = await Promise.allSettled([...]);
const [financialRatio, profitRatio, ...] = results.map(r =>
  r.status === "fulfilled" ? r.value : null
);
```

---

## 수정 대상 파일 요약

| 파일 | 변경 내용 | 우선순위 |
|------|---------|---------|
| `lib/ticker-cache.ts` | 인메모리 rows 캐시 레이어 추가 (readTickerCache + writeTickerCache) | CRITICAL |
| `lib/dart-fundamental.ts` | DART 연도 루프 병렬화 (getDartTrendOnly, getFundamentalFinancials) | HIGH |
| `hooks/useTickerDetailQueries.ts` | `refetchOnWindowFocus: false` 추가 | MEDIUM |
| `hooks/useFundamentalData.ts` | `refetchOnWindowFocus: false` 추가 | MEDIUM |
| `hooks/useFundamentalExtended.ts` | `refetchOnWindowFocus: false` 추가 | MEDIUM |
| `app/api/fundamental/ratios/route.ts` | `Promise.all` → `Promise.allSettled` | MEDIUM |

---

## 예상 개선 효과

| 시나리오 | 현재 | 개선 후 |
|---------|------|--------|
| 캐시 히트 (일반적 재접속) | ~1.2–1.8s (Sheets × 6) | ~0.1–0.2s (메모리 HIT) |
| 캐시 미스 (첫 조회) | ~3–4s (Sheets × 6 + DART 직렬) | ~0.5–1s (Sheets × 1 + DART 병렬) |
| 갱신(revalidate=1) | ~3–4s | ~1.5–2s (KIS 병렬 유지 + DART 병렬) |
| 탭 전환 재방문 | 6개 API 리패치 | 리패치 없음 (30분 staleTime) |

---

## 검증 전략

```bash
# 타입 체크
npx tsc --noEmit

# 빌드
npm run build

# 테스트
npm run test
```

**수동 확인 포인트**:
1. 종목 상세 페이지 첫 로드 → Network 탭: `X-Ticker-Cache: MISS` 확인 후 재로드 시 `HIT` 즉시 반환
2. 재로드 시 응답 속도 체감 확인 (캐시 히트 시 < 500ms 목표)
3. 탭 전환 후 다시 열었을 때 Network 탭에 API 재요청 없음 확인
4. 갱신 버튼 클릭 → `revalidate=1` 파라미터로 캐시 스킵 후 새 데이터 표시 확인
5. 개발 서버 로그: `[TickerCache] rows cache HIT` vs `MISS` 메시지 확인
