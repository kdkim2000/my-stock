# Vercel 갱신 속도 개선 계획

**작성일**: 2026-06-02  
**대상**: https://my-stock-ten-alpha.vercel.app 갱신 버튼 성능  
**브랜치**: 01_claude

---

## Context

Vercel 배포 환경에서 종목 상세 페이지 "갱신" 버튼 클릭 시 응답이 매우 느림(5~8초).  
로컬에서는 ~2초. Vercel 서버리스 아키텍처의 특성이 현재 구조와 맞지 않는 것이 원인.

---

## 원인 분석

### 핵심 문제: 갱신 시 6개 Vercel 함수가 각자 독립 실행

갱신 버튼(`revalidate=1`) 클릭 시 클라이언트가 7개 API를 동시 호출:

| 라우트 | KIS API 호출 수 |
|--------|---------------|
| `/api/fundamental` | 5회 |
| `/api/fundamental/ratios` | 5회 |
| `/api/fundamental/estimate` | 1회 |
| `/api/fundamental/trading` | 2회 |
| `/api/kis/indicators` | 1회 |
| `/api/kis/opinion` | 2회 |
| `/api/kis/stock-info` | 1회 |
| **합계** | **17회** |

Vercel에서 이 7개 요청은 **독립된 서버리스 함수 인스턴스**에서 실행됨. 결과:

### 병목 1: 인메모리 캐시가 Vercel에서 효과 없음

| 캐시 | 로컬 효과 | Vercel 효과 |
|------|---------|------------|
| `ROWS_CACHE_KEY` (ticker-cache 60초) | 6개 라우트 공유 → Sheets 1회 | 인스턴스 격리 → Sheets 7회 |
| `GLOBAL_KIS_CACHE` (KIS 응답 60초) | 동일 프로세스 공유 | 인스턴스 격리 → 효과 없음 |
| `CORP_CODE_CACHE` (DART 24시간) | 프로세스 재사용 시 유효 | 콜드스타트마다 재다운로드 |
| `KIS 토큰 globalThis` | 공유 | 각 인스턴스가 개별 Sheets 조회 |

### 병목 2: KIS 스로틀 세마포어가 인스턴스별 독립

`lib/kis/throttle.ts`의 세마포어는 `globalThis` 기반 → 인스턴스간 공유 불가.  
7개 인스턴스가 각자 동시성=5로 KIS 호출 → 실제 동시 KIS 요청 **35개**.  
→ KIS 레이트 리밋(`EGW00133`) 유발, 재시도 발생.

### 병목 3: `maxDuration` 미설정으로 504 위험

Vercel 기본 제한: Hobby 10초, Pro 60초. 현재 `next.config.mjs`에 `maxDuration` 미설정.  
`/api/fundamental`은 DART 5개년 병렬 조회 포함 → 최대 8~10초 소요 가능.

### 병목 4: 콜드스타트 누적

각 인스턴스 콜드스타트 ~300ms × 7개 = 2.1초 추가.

---

## 개선 계획

### 수정 1: 통합 갱신 엔드포인트 생성 (핵심)

**신규**: `app/api/ticker/[code]/refresh/route.ts`

하나의 서버리스 함수 안에서 모든 KIS/DART API를 병렬 호출하고 Google Sheets 캐시를 갱신.

```
장점:
- 콜드스타트 1회 (현재 7회)
- KIS 토큰 공유 (현재 7개 인스턴스 각자 조회)
- KIS 스로틀 공유 (현재 7× 독립 세마포어)
- DART CORPCODE 공유 (현재 7× 재다운로드 위험)
- Sheets ROWS_CACHE 공유 (현재 7× 개별 Sheets API 호출)
```

흐름:
```
클라이언트 갱신 버튼 클릭
  → POST /api/ticker/[code]/refresh (1개 함수)
      ├─ Promise.allSettled([모든 KIS/DART 호출]) — 공유 스로틀·토큰
      ├─ 결과를 writeTickerCache로 각 섹션 저장
      └─ { ok: true } 반환
  → 클라이언트: 모든 쿼리 invalidate + refetch
      └─ 개별 라우트들이 이제 Sheets 캐시(HIT) 반환 → 빠름
```

내부 호출 목록 (한 함수 내 병렬):
- `getPriceInfo` + `getKisFinancialRatio` + `getKisBalanceSheet` + `getKisIncomeStatement` + `getKisDailyPrice` + `getDartTrendOnly` + `getDartPreliminaryAndDocument`
- `getKisProfitRatio` + `getKisStabilityRatio` + `getKisGrowthRatio` + `getKisOtherMajorRatios`
- `getKisEstimatePerform`
- `getKisInvestorTradeDaily` + `getKisDailyTradeVolume`
- `getDailyChart` → `getTechnicalIndicators`
- `getInvestmentOpinion`

각 결과를 해당 섹션(`fundamental`, `ratios`, `estimate`, `trading`, `indicators`, `opinion`)으로 `writeTickerCache` 저장.

### 수정 2: `maxDuration` 설정

Vercel Pro 기준. 각 라우트 파일 상단에 추가:

```typescript
export const maxDuration = 30; // fundamental, ratios, trading, indicators
export const maxDuration = 60; // /api/ticker/[code]/refresh (통합 엔드포인트)
```

대상 파일:
- `app/api/fundamental/route.ts`
- `app/api/fundamental/ratios/route.ts`
- `app/api/fundamental/trading/route.ts`
- `app/api/kis/indicators/route.ts`
- `app/api/ticker/[code]/refresh/route.ts` (신규, 60초)

### 수정 3: 클라이언트 handleRefresh 업데이트

**파일**: `components/dashboard/TickerDetailContent.tsx`

```typescript
// 현재: 개별 쿼리 직접 refetch (7개 병렬 → 7개 Vercel 함수)
const handleRefresh = useCallback(async () => {
  // 1단계: 통합 갱신 엔드포인트 호출 (1개 함수, Sheets 캐시 갱신)
  await apiFetch(`/api/ticker/${code}/refresh`, { method: "POST" });
  // 2단계: 모든 쿼리 invalidate (캐시에서 빠르게 로드)
  queryClient.invalidateQueries(...);
  queryClient.refetchQueries(...);
}, [code, queryClient]);
```

로딩 인디케이터: 갱신 중에는 헤더의 갱신 버튼에 스피너 표시.

---

## 수정 대상 파일 요약

| 파일 | 변경 내용 |
|------|---------|
| `app/api/ticker/[code]/refresh/route.ts` | **신규**: 통합 갱신 엔드포인트 |
| `components/dashboard/TickerDetailContent.tsx` | `handleRefresh` → 통합 엔드포인트 호출 |
| `app/api/fundamental/route.ts` | `maxDuration = 30` 추가 |
| `app/api/fundamental/ratios/route.ts` | `maxDuration = 30` 추가 |
| `app/api/fundamental/trading/route.ts` | `maxDuration = 30` 추가 |
| `app/api/kis/indicators/route.ts` | `maxDuration = 30` 추가 |

---

## 예상 개선 효과

| 시나리오 | 현재 | 개선 후 |
|---------|------|--------|
| 갱신 버튼 (Vercel) | 5~8초 | 3~5초 (KIS 스로틀이 여전히 지배) |
| 504 타임아웃 위험 | 있음 (10초 기본) | 없음 (maxDuration 명시) |
| Sheets API 호출 횟수/갱신 | 7회 | 1회 |
| KIS 동시 요청 (Vercel) | 35회 (7인스턴스×5) | 5회 (공유 스로틀) |
| KIS 레이트 리밋 발생 | 자주 | 거의 없음 |

---

## 검증 전략

```bash
# 타입 체크
npx tsc --noEmit

# 빌드
npm run build
```

**수동 확인 (Vercel 배포 후)**:
1. Vercel 함수 로그에서 `/api/ticker/[code]/refresh` 응답 시간 확인
2. 갱신 버튼 클릭 후 섹션들이 즉시(캐시 HIT) 갱신되는지 확인
3. Vercel 로그에 `EGW00133` (KIS 레이트 리밋) 발생 빈도 감소 확인
4. 504 Gateway Timeout 미발생 확인
