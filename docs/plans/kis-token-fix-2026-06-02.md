# KIS 토큰 반복 발급 방지 수정 계획

**작성일**: 2026-06-02  
**대상 브랜치**: 01_claude  
**심각도**: HIGH — KIS 측 알람 발생 중

---

## Context

KIS 토큰은 24시간 유효하며 하루 1회 발급이 원칙이다. 현재 앱을 실행하면 KIS 측으로부터 "토큰을 너무 자주 발급받고 있다"는 알람이 발생하고 있다.

조사 결과 두 가지 독립적인 버그가 복합적으로 작용하고 있다:

1. **`getCurrentPrice()` 스로틀·캐시 누락** — 포트폴리오 보유 종목 N개를 N개의 동시 KIS 요청으로 처리하여 토큰 만료 오류 가능성을 N배로 높임
2. **`clearKisTokenCache()` 경합 조건** — HTTP 500 오류 처리에서 `clearKisTokenCache()`를 호출하면 `gl.refreshPromise`까지 초기화되어, 동시 오류 발생 시 복수의 인스턴스가 각자 토큰을 새로 발급받는 레이스 컨디션 발생

---

## 근본 원인 분석

### 버그 1: `getCurrentPrice()` 스로틀·캐시 누락 (`lib/kis/price.ts:9-95`)

`getPriceInfo()`, `getDailyChart()`, `kisGet()` 등 다른 함수는 모두 `waitKisThrottle()` + `kisCacheGet()`을 사용하지만 `getCurrentPrice()`만 누락되어 있다. `portfolio-summary.ts`가 보유 종목 수만큼 이 함수를 동시 호출하므로 KIS에 N개의 요청이 한꺼번에 쏠린다.

### 버그 2: `clearKisTokenCache()` 경합 조건 (`lib/kis/token.ts:126-139`)

`getAccessToken()`의 중복 방지 핵심은 `gl.refreshPromise`이다.  
그런데 HTTP 500 핸들러에서 `clearKisTokenCache()`를 호출하면 이 `gl.refreshPromise`까지 `null`로 초기화된다.

**동시 오류 시나리오:**
```
T=0ms  호출 A: 500 오류 → clearKisTokenCache() → gl.refreshPromise = null
T=0ms  호출 A: getAccessToken() → refreshPromise 없음 → refreshPromise_A 시작
T=1ms  호출 B: 500 오류 → clearKisTokenCache() → gl.refreshPromise = null (A의 Promise 소거!)
T=1ms  호출 B: getAccessToken() → refreshPromise 없음 → refreshPromise_B 시작
결과:  /oauth2/tokenP 2회 호출 → KIS 알람
```

---

## 수정 계획

### 수정 1: `softExpireKisToken()` 추가 (`lib/kis/token.ts`)

HTTP 500 토큰 만료 오류 전용 함수 — 토큰 값만 초기화, `refreshPromise`·`fileReadPromise`·파일은 유지:

```typescript
export function softExpireKisToken(): void {
  cachedToken = null;
  const gl = getGlobal();
  gl.cachedToken = null;
}
```

### 수정 2: 500 오류 핸들러 교체

`lib/kis/client.ts` (line 46), `lib/kis/price.ts` (line 49, 134, 220)에서  
`clearKisTokenCache()` → `softExpireKisToken()` 로 교체

### 수정 3: `getCurrentPrice()` 스로틀·캐시 추가 (`lib/kis/price.ts`)

`getPriceInfo()`와 동일한 패턴 적용:
- `kisCacheGet<number>("currentPrice:${code}")` 선조회
- `await waitKisThrottle()` 스로틀 대기
- `kisCacheSet(...)` 응답 캐싱
- `finally { releaseKisThrottle() }` 슬롯 반환

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|---------|
| `lib/kis/token.ts` | `softExpireKisToken()` 함수 추가, export |
| `lib/kis/client.ts` | `clearKisTokenCache` import 제거 → `softExpireKisToken` import 및 교체 |
| `lib/kis/price.ts` | `getCurrentPrice()` 스로틀·캐시 추가; `clearKisTokenCache` → `softExpireKisToken` 교체 |

---

## 검증 전략

```bash
npx tsc --noEmit   # 타입 체크
npm run build      # 빌드
```

**수동 확인 포인트:**
1. 대시보드 로드 → `/api/kis/portfolio-summary` 정상 응답
2. Google Sheets `_KIS_TOKEN_` 탭: `expiresAt`이 앱 재시작 후에도 변경되지 않아야 함 (토큰 재사용)
3. Vercel 로그: `Successfully wrote new token to Sheets` 하루 1회만 출력
