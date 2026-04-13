# Ticker Detail Page 성능 최적화 — 구현 완료 요약

## 변경 파일 목록

### 신규 파일
| 파일 | 설명 |
|------|------|
| [ticker-cache.ts](file:///e:/apps/my-stock/lib/ticker-cache.ts) | `_TICKER_CACHE_` Google Sheets 캐시 계층 (읽기/쓰기/TTL 판정) |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| [google-sheets.ts](file:///e:/apps/my-stock/lib/google-sheets.ts) | `getSheetsAuth`, `Auth` 타입 export 추가 |
| [fundamental/route.ts](file:///e:/apps/my-stock/app/api/fundamental/route.ts) | 캐시 읽기/쓰기 계층 추가 (section: `fundamental`) |
| [ratios/route.ts](file:///e:/apps/my-stock/app/api/fundamental/ratios/route.ts) | 캐시 읽기/쓰기 계층 추가 (section: `ratios`) |
| [estimate/route.ts](file:///e:/apps/my-stock/app/api/fundamental/estimate/route.ts) | 캐시 읽기/쓰기 계층 추가 (section: `estimate`) |
| [trading/route.ts](file:///e:/apps/my-stock/app/api/fundamental/trading/route.ts) | 캐시 읽기/쓰기 계층 추가 (section: `trading`) |
| [indicators/route.ts](file:///e:/apps/my-stock/app/api/kis/indicators/route.ts) | 캐시 읽기/쓰기 계층 추가 (section: `indicators`) |
| [opinion/route.ts](file:///e:/apps/my-stock/app/api/kis/opinion/route.ts) | 캐시 읽기/쓰기 계층 추가 (section: `opinion`) |
| [TickerDetailContent.tsx](file:///e:/apps/my-stock/components/dashboard/TickerDetailContent.tsx) | indicators 쿼리에 `revalidateTrigger` 반영 (새로고침 시 캐시 우회) |

## 핵심 설계

### `_TICKER_CACHE_` 시트 구조
| 열 | 필드 | 예시 |
|----|------|------|
| A | `code` | `005930` |
| B | `section` | `fundamental`, `ratios`, `estimate`, `trading`, `indicators`, `opinion` |
| C | `data` | JSON 문자열 |
| D | `updatedAt` | `2026-04-14T02:15:00.000Z` |

### TTL 전략 (장 시간 인식)
- **장중** (평일 09:00-15:30 KST): **30분** TTL
- **장 마감 후** (15:30 이후, 주말, 공휴일): **다음 장 시작(익일 09:00)까지** 캐시 유지

### 데이터 흐름
```
[클라이언트] → [API Route] → readTickerCache(code, section)
                                ├── HIT (유효) → 즉시 반환 (~1s) + X-Ticker-Cache: HIT
                                └── MISS/만료 → KIS/DART API 호출
                                                  → writeTickerCache() 비동기 저장
                                                  → 응답 반환 + X-Ticker-Cache: MISS
```

### 새로고침 시 캐시 우회
- 클라이언트에서 `revalidate=1` 파라미터 전달
- API Route에서 `revalidate === "1"` 이면 Sheets 캐시 조회 건너뜀
- KIS/DART API를 직접 호출하고 새 데이터로 캐시 갱신

## 검증 결과
- ✅ TypeScript 컴파일 성공 (`tsc --noEmit` exit code 0)
- ✅ 기존 코드와의 하위 호환성 유지
- ✅ 모든 API Route에 일관된 패턴 적용

## 사용자 검증 가이드

1. **로컬 테스트**: 로그인 후 종목 상세 페이지 접속 → Network 탭에서 `X-Ticker-Cache` 헤더 확인
2. **Google Sheets 확인**: `_TICKER_CACHE_` 시트에 데이터 행이 생성되는지 확인
3. **캐시 동작 확인**: 동일 종목 재접속 시 `X-Ticker-Cache: HIT` 확인 + 응답 속도 비교
4. **새로고침 확인**: 새로고침 버튼 클릭 → `X-Ticker-Cache: MISS` + KIS API 재호출 확인
5. **Vercel 배포**: `vercel deploy` 후 실제 성능 비교 (기대: 캐시 HIT 시 1-2초 내 응답)
