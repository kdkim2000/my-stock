# Ticker 상세정보 로딩 성능 병목 분석

## 문제 개요

`/api/fundamental` 엔드포인트에서 **가치평가, 재무 요약, 비율, 추정실적, 매매동향** 데이터를 가져올 때 과도한 시간이 소요됩니다.

---

## 근본 원인: 글로벌 Throttle + 다량의 순차 KIS API 호출

### 1. 글로벌 Throttle (핵심 병목)

[throttle.ts](file:///e:/apps/my-stock/lib/kis/throttle.ts)에서 **모든 KIS API 호출 간 400ms 간격**을 강제합니다:

```typescript
export const KIS_THROTTLE_MS = Math.max(0, Number(process.env.KIS_THROTTLE_MS) || 400);
```

[client.ts](file:///e:/apps/my-stock/lib/kis/client.ts)의 [kisGet()](file:///e:/apps/my-stock/lib/kis/client.ts#6-77) 함수가 매 호출마다 [waitKisThrottle()](file:///e:/apps/my-stock/lib/kis/throttle.ts#10-20)을 실행하므로, `Promise.all()`을 사용해도 **실제로는 순차 실행**됩니다.

### 2. 한 번의 요청에 최대 14~20회 KIS API 호출

[route.ts](file:///e:/apps/my-stock/app/api/fundamental/route.ts) 분석 — 최악의 경우:

| 단계 | 호출 함수 | KIS API 호출 수 | 비고 |
|------|-----------|:---------------:|------|
| 1단계 | `getPriceInfo` | 1 | |
| 2단계 | [getKisFinancialRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#197-208) | 1 | |
| 2단계(조건부) | [getKisStockFundamentals](file:///e:/apps/my-stock/lib/kis/financial.ts#13-54) | 1~2 | PER/PBR ≤ 0 시 SearchInfo 추가 호출 |
| 3단계 | [getKisBalanceSheet](file:///e:/apps/my-stock/lib/kis/financial.ts#113-145) | 1~2 | 분기 기준 실패 시 재시도 |
| 3단계 | [getKisIncomeStatement](file:///e:/apps/my-stock/lib/kis/financial.ts#146-165) | 1~2 | 분기 기준 실패 시 재시도 |
| 3단계 | [getKisProfitRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#209-220) | 1~2 | 분기 기준 실패 시 재시도 |
| 3단계 | [getKisStabilityRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#221-232) | 1~2 | 분기 기준 실패 시 재시도 |
| 3단계 | [getKisGrowthRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#233-244) | 1~2 | 분기 기준 실패 시 재시도 |
| 3단계 | [getKisOtherMajorRatios](file:///e:/apps/my-stock/lib/kis/financial.ts#245-256) | 1~2 | 분기 기준 실패 시 재시도 |
| 3단계 | [getKisEstimatePerform](file:///e:/apps/my-stock/lib/kis/estimate.ts#57-75) | 1 | 추정실적 |
| 3단계 | [getKisInvestorTradeDaily](file:///e:/apps/my-stock/lib/kis/trading.ts#100-140) | 1 | 매매동향 |
| 3단계 | [getKisDailyTradeVolume](file:///e:/apps/my-stock/lib/kis/trading.ts#141-195) | 1 | 매매동향 |
| 3단계 | [getKisDailyPrice](file:///e:/apps/my-stock/lib/kis/trading.ts#196-219) | 1 | 일봉 |
| **합계** | | **14~20** | |

### 3. 예상 소요 시간 계산

```
최선의 경우: 14호출 × 400ms = 5.6초 (throttle만)
최악의 경우: 20호출 × 400ms = 8.0초 (throttle만)
+ 실제 네트워크 RTT (~100-300ms/call) = 총 7~14초
```

> [!CAUTION]
> 인메모리 캐시([cache.ts](file:///e:/apps/my-stock/lib/kis/cache.ts))가 있지만, Vercel 같은 서버리스 환경에서는 **함수 인스턴스가 재사용되지 않으면 캐시가 사라져** 매번 14~20회 KIS API를 호출하게 됩니다.

### 4. Retry 패턴의 중복 호출

비율(Ratio) 관련 함수들 — [getKisProfitRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#209-220), [getKisStabilityRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#221-232), [getKisGrowthRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#233-244), [getKisOtherMajorRatios](file:///e:/apps/my-stock/lib/kis/financial.ts#245-256), [getKisBalanceSheet](file:///e:/apps/my-stock/lib/kis/financial.ts#113-145), [getKisIncomeStatement](file:///e:/apps/my-stock/lib/kis/financial.ts#146-165) — 은 첫 번째 호출 실패 시 파라미터를 바꿔 **재시도**합니다:

```typescript
// financial.ts - getKisProfitRatio 예시 (다른 비율 함수도 동일 패턴)
let body = await kisGet(path, trId, code, financeExtraParams());        // 1차 시도
if (!body) body = await kisGet(path, trId, code, { FID_DIV_CLS_CODE }); // 2차 시도 (fallback)
```

이로 인해 최악의 경우 **6개 함수 × 2호출 = 12회** 추가 호출이 발생합니다.

---

## 해당 지표별 원인 매핑

| 지표 | 관련 함수 | 호출 수 | 병목 원인 |
|------|-----------|:-------:|-----------|
| **가치평가** | [getKisFinancialRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#197-208) + [getKisStockFundamentals](file:///e:/apps/my-stock/lib/kis/financial.ts#13-54) | 2~3 | 2단계에서 순차 실행, 조건부 fallback |
| **재무 요약** | [getKisBalanceSheet](file:///e:/apps/my-stock/lib/kis/financial.ts#113-145) + [getKisIncomeStatement](file:///e:/apps/my-stock/lib/kis/financial.ts#146-165) | 2~4 | retry 패턴으로 최대 4회 |
| **비율** | [getKisProfitRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#209-220) + [getKisStabilityRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#221-232) + [getKisGrowthRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#233-244) + [getKisOtherMajorRatios](file:///e:/apps/my-stock/lib/kis/financial.ts#245-256) | 4~8 | **최대 병목** — 4개 함수 각각 retry 가능 |
| **추정실적** | [getKisEstimatePerform](file:///e:/apps/my-stock/lib/kis/estimate.ts#57-75) | 1 | 단일 호출이지만 throttle 대기 |
| **매매동향** | [getKisInvestorTradeDaily](file:///e:/apps/my-stock/lib/kis/trading.ts#100-140) + [getKisDailyTradeVolume](file:///e:/apps/my-stock/lib/kis/trading.ts#141-195) | 2 | throttle 대기 |

---

## 해결 방안

### 방안 1: 스로틀 제거 + 동시 요청 제한 (병렬 처리 개선) ⭐ 추천

**핵심**: 글로벌 throttle 대신 **동시 실행 세마포어** (concurrency limiter)를 적용합니다.

```typescript
// 현재: 모든 호출이 400ms 간격으로 순차 실행
await waitKisThrottle(); // ← 병목

// 개선: 최대 N개 동시 실행 (KIS API는 초당 5~10회 제한)
const semaphore = new Semaphore(3); // 동시 3개까지
await semaphore.acquire();
try { /* fetch */ } finally { semaphore.release(); }
```

**효과**: 14호출 기준 `14 × 400ms = 5.6초` → `⌈14/3⌉ × ~300ms = ~1.5초`

### 방안 2: 응답 분할 (점진적 로딩) ⭐ 추천

`/api/fundamental` 하나에 모든 데이터를 묶지 말고, **섹션별로 분리된 API**를 만들어 **프론트엔드에서 독립적으로 로딩**합니다.

```
/api/fundamental/valuation    → 가치평가 (PER/PBR/EPS/BPS)
/api/fundamental/financial     → 재무 요약 (대차대조표 + 손익계산서)
/api/fundamental/ratios        → 비율 (수익성/안정성/성장성/기타)
/api/fundamental/estimate      → 추정실적
/api/fundamental/trading       → 매매동향 (투자자별 + 체결량)
```

**효과**:
- 각 섹션이 **독립적으로 로딩**되어 사용자가 먼저 완료된 섹션을 바로 볼 수 있음
- 스크롤 위치에 따른 lazy loading 가능
- 오류 발생 시 해당 섹션만 재시도

### 방안 3: 서버 사이드 캐시 강화 (Redis/KV)

현재 인메모리 캐시([cache.ts](file:///e:/apps/my-stock/lib/kis/cache.ts))는 서버리스 환경에서 비효율적입니다.

```typescript
// 현재: 인메모리 Map (서버리스에서 휘발)
const cache = new Map<string, CacheEntry>();

// 개선: Vercel KV 또는 Redis
import { kv } from "@vercel/kv";
const cached = await kv.get(`kis:${trId}:${code}`);
```

**효과**: 재배포/cold start 후에도 캐시 유지, 두 번째 요청부터 **즉시 응답**

### 방안 4: Retry 패턴 최적화

현재 fallback 호출(분기 기준 → 기본 기준)은 **동기적으로 재시도**합니다. 이를 최적화합니다:

```typescript
// 현재: 순차 재시도 (최대 800ms 추가)
let body = await kisGet(path, trId, code, financeExtraParams());
if (!body) body = await kisGet(path, trId, code, { FID_DIV_CLS_CODE });

// 개선: 최근 성공한 파라미터를 캐시하여 첫 시도에서 성공률 향상
const knownParams = getLastSuccessParams(trId, code);
const body = await kisGet(path, trId, code, knownParams ?? financeExtraParams());
```

### 방안 5: 비율 데이터 통합 API 호출

현재 비율 관련 **4개 API**를 개별 호출합니다:
- [getKisProfitRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#209-220) (수익성비율)
- [getKisStabilityRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#221-232) (안정성비율)
- [getKisGrowthRatio](file:///e:/apps/my-stock/lib/kis/financial.ts#233-244) (성장성비율)
- [getKisOtherMajorRatios](file:///e:/apps/my-stock/lib/kis/financial.ts#245-256) (기타비율)

이들은 KIS API의 같은 도메인(`/finance/`)이므로, **응답을 하나의 캐시 키로 묶거나** 첫 요청 시 모든 비율을 한 번에 캐시합니다.

---

## 권장 우선순위

| 순위 | 방안 | 난이도 | 효과 | 비고 |
|:----:|------|:------:|------|------|
| 1 | 방안 1: 세마포어 동시 제한 | 낮음 | ★★★★★ | **즉시 적용** 가능, throttle.ts만 수정 |
| 2 | 방안 2: 응답 분할 + 점진적 로딩 | 중간 | ★★★★☆ | UX 개선 효과 큼 |
| 3 | 방안 4: Retry 최적화 | 낮음 | ★★★☆☆ | 방안 1과 함께 적용 |
| 4 | 방안 3: Redis/KV 캐시 | 중간 | ★★★☆☆ | Vercel 배포 환경 의존 |
| 5 | 방안 5: 비율 데이터 통합 | 낮음 | ★★☆☆☆ | KIS API 제약에 의존 |
