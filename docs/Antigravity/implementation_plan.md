# 상세페이지 접속 시 AI 캐시 자동 표시

상세페이지 진입 시 Google Sheets `_AI_CACHE_`에 캐시된 AI 분석 결과가 있으면 자동으로 표시합니다.
OpenAI 호출 없이 캐시만 조회하므로 비용이 발생하지 않습니다.

## Proposed Changes

### API Route

#### [MODIFY] [route.ts](file:///e:/apps/my-stock/app/api/ai/trading-guide/route.ts)

- `body`에 `cacheOnly?: boolean` 파라미터 추가
- `cacheOnly`가 `true`이고 캐시가 없으면 `{ content: null, cachedAt: null }`을 반환하고 OpenAI를 호출하지 않음

---

### Component

#### [MODIFY] [TickerDetailContent.tsx](file:///e:/apps/my-stock/components/dashboard/TickerDetailContent.tsx)

- 페이지 로드 시 `cacheOnly: true`로 자동 조회하는 별도의 `useQuery` 추가 (`enabled: !!code`)
- 캐시 히트 시 `aiContent`/`aiCachedAt` 상태에 반영
- 기존 "AI 분석 요청" 버튼 동작은 변경 없음 (OpenAI 포함 전체 분석)

## Verification Plan

### Manual Verification

1. `npm run dev`로 로컬 실행
2. Google Sheets `_AI_CACHE_` 시트에 특정 종목의 캐시 데이터가 있는 상태에서 해당 종목 상세페이지 접속
3. 버튼을 누르지 않아도 AI 분석 결과가 자동으로 표시되는지 확인
4. 캐시가 없는 종목 상세페이지 접속 시 기존처럼 빈 상태(버튼 유도 화면)가 표시되는지 확인
