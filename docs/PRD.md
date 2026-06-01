# Product Requirements Document (PRD): 국내주식 투자 지원 앱

## 1. 프로젝트 개요

본 프로젝트는 **개인 주식 투자자**를 위한 **국내주식 투자 지원 웹 애플리케이션**입니다.

- 사용자가 **Google Sheets**에 매매 내역을 입력·수정하면, 웹 앱에서 데이터를 동기화하여 **종목별 분석**과 **투자 인사이트**(수익률, 승률, 누적 손익 등)를 시각화된 **대시보드**로 제공합니다.
- **한국투자증권(KIS) Open API**를 연동하여 보유 종목의 실시간 시세·평가 손익 및 종목정보·재무·투자의견·매매동향 등 가치투자 참고 정보를 제공합니다.
- **DART 전자공시 API**로 재무 5개년 트렌드·잠정실적 링크·현금흐름을 보완합니다.
- **OpenAI API**(gpt-4o-mini)를 사용한 종목별 AI 분석·매매 가이드(참고용)를 제공합니다.
- 가치투자 관점의 **참고 정보만** 제공하며, 매수/매도 권유 문구는 사용하지 않습니다.

---

## 2. 대상 사용자

- 체계적인 매매 복기와 수익률 관리를 통해 투자 실력을 향상시키고자 하는 **개인 주식 투자자**
- **엑셀/구글 시트**(복사·붙여넣기)를 활용한 직관적인 데이터 입력을 선호하는 사용자
- KIS 계좌를 보유하고 실시간 평가 손익·종목 상세 정보를 한곳에서 보고자 하는 사용자

---

## 3. 핵심 기능

### 3.1. 인증 (Authentication)

- **NextAuth.js** 기반 **Google OAuth 2.0** 로그인.
- 환경 변수: `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- `ALLOWED_EMAIL` 설정 시 해당 이메일만 로그인 허용 (단일 사용자 앱).
- 로그인 후 **대시보드**(`/dashboard`)로 이동. 비인증 사용자는 `/auth/signin`으로 리다이렉트.
- `middleware.ts`가 `/dashboard/**`, `/api/**` 전체를 세션 기반으로 보호.

### 3.2. Google Sheets 기반 데이터 동기화

- 사용자가 구글 시트에 매매 내역을 입력/수정하면 앱에서 **읽기(Read)**로 반영. React Query `staleTime` 기반 캐시 + 사용자 새로고침 시 최신 데이터 요청.
- 앱 내에서 매매 기록 추가 시 API Route를 통해 시트 **마지막 행에 Append**.
- Google Sheets는 데이터 저장 외에 **서버 캐시 저장소**(`_TICKER_CACHE_`, `_AI_CACHE_` 탭)로도 활용하여 서버리스 인스턴스 간 캐시 공유.
- OAuth 인증: `lib/google-oauth.ts`에서 Service Account JWT 토큰 중앙 관리 (5분 여유 포함, `globalThis` 캐싱).

#### 시트 구성

| 탭 | 환경 변수 | 용도 |
|----|----------|------|
| 매매내역 | `GOOGLE_SHEET_NAME` (기본값) | 사용자 매매 기록 (필수) |
| 종목코드 마스터 | `GOOGLE_SHEET_TICKER_MASTER` | 종목명↔코드 매핑 (선택) |
| 종목별 집계 | `GOOGLE_SHEET_AGGREGATION` | 집계 데이터 (선택) |
| _TICKER_CACHE_ | 내부 | KIS/DART API 응답 캐시 (자동 생성) |
| _AI_CACHE_ | 내부 | OpenAI 분석 결과 캐시 7일 TTL (자동 생성) |

### 3.3. 실시간 주가 및 포트폴리오 평가 (KIS API)

- **종목코드 해석 우선순위**: (1) 종목코드 마스터 시트 → (2) 종목별 집계 시트 Code 컬럼 → (3) `lib/ticker-mapping.ts` 하드코딩 fallback. `lib/stock-utils.ts`의 `normalizeStockCode()`로 6자리 표준화.
- **KIS 토큰 캐싱**: Access Token(24시간 유효)을 서버 메모리(`globalThis`)와 파일 캐시(로컬: `.next/cache/`, Vercel: `/tmp/`)로 이중 캐싱하여 일일 발급 한도 소진 방지.
- **KIS API 스로틀링**: `KIS_THROTTLE_MS` 환경 변수(기본값 200ms)로 요청 간격 제어. `EGW00133` 응답 시 자동 재시도.
- **포트폴리오 계산 흐름**:
  1. Google Sheets 매매 내역 → `PositionTracker`(FIFO 가중평균) → 보유 포지션 산출
  2. KIS 현재가로 평가금액·평가손익 산출 (KIS 불가 시 매수금액으로 대체)

### 3.4. 인사이트 대시보드 (`/dashboard`)

- **진입점**: `/` → `/dashboard` 리다이렉트. 상단 네비게이션: 로고, 종목별 분석 앵커(`#ticker-analysis`), 매매 내역 앵커(`#journal`), 테마 토글, 로그아웃.
- **요약 카드(Summary Cards)**: 실현손익, 평가손익(미실현), 전체 승률, 총 자산. 아이콘(Banknote, TrendingUp, Target, Wallet)·로딩 스켈레톤·에러 상태 포함.
- **종목별 분석 테이블**: 보유 종목만/전체 전환, 종목 검색, 컬럼 정렬(종목·평가금액·실현손익·실현수익률·승률·총매수/매도금액). 종목명 클릭 시 종목 상세 페이지 이동. 보유 뱃지·에러 재시도 버튼 포함.
- **누적 수익금 추이**: Recharts AreaChart. 6개월/1년 기간 전환. 누적 실현손익 시계열.
- **포지션 집중도**: 종목별 평가금액 비중 가로 막대 차트(상위 N종목 + 기타). 툴팁에 비중·평가금액.
- **손익 기여도·손실 포지션**: 종목별 평가손익 가로 막대(수익/손실 색상), 손실 포지션(손절·재평가 후보) 링크.
- **전략별 성과(Tags)**: 매매 내역 Tags(`#태그`) 기준 집계. 전략별 매도 건수, 실현손익, 승률.
- **매매 내역 테이블**: 페이지당 건수 선택·페이지네이션. 일자·종목·구분·수량·단가·수수료·세금 컬럼. 로딩 스켈레톤(`components/ui/table-skeleton.tsx`)·에러 재시도 버튼 포함.

### 3.5. 종목 상세 페이지 (`/dashboard/ticker/[id]`)

- **URL**: `id`는 종목코드(6자리) 또는 종목명. `normalizeStockCode()`로 코드 표준화.
- **분산 로딩**: 섹션별 독립 React Query 훅 (`useTickerDetailQueries`, `useAiGuidance`)으로 병렬 로드. 데이터 도착 순서대로 렌더링.
- **수동 갱신**: 헤더 갱신 버튼이 `revalidate=1` 플래그로 Google Sheets 캐시 스킵 후 KIS/DART 재조회.

#### 섹션 구성

| 섹션 | 데이터 출처 | 주요 내용 |
|------|------------|---------|
| 시세 요약 | KIS | 현재가·전일대비·시가·고가·저가·거래량·52주 고저 |
| 가치평가 | KIS | PER·PBR·EPS·BPS·ROE·EV/EBITDA |
| 재무 요약 | KIS | 대차대조표·손익계산서 주요 항목, Recharts 막대 차트 |
| 비율 | KIS | 수익성·안정성·성장성·기타주요비율, 레이더 차트 |
| 추정실적 | KIS | 추정손익계산서·투자지표, 증감율 색상 |
| 매매동향 | KIS | 일자별 OHLC 선 차트, 투자자별 순매수 누적 라인 차트, 매수/매도 체결량 막대 차트 (모두 YYYY-MM-DD 포맷, 최근 30일) |
| 투자의견 | KIS | 종목 의견(의견명·목표가·전망), 증권사별 의견 테이블, 배지 색상(매수/매도/중립) |
| DART 손익 | DART | 매출액·영업이익·당기순이익 5개년 막대 차트 |
| 현금흐름 | DART | 영업·투자·재무 활동 5개년 테이블 |
| 공시 | DART | 잠정실적 공시 링크, DART 공시검색 링크 |
| 내 포트폴리오 | Sheets + KIS | 매수/매도 횟수·금액·실현손익·실현수익률·승률, 보유 수량·평균 단가·평가금액·평가손익 |
| 보조지표 | KIS (일봉 90일) | RSI(14), MACD(12,26,9). 과매수/과매도 기준선. 참고용 |
| AI 분석 및 매매 가이드 | OpenAI gpt-4o-mini | 시세·가치·재무·보조지표·포트폴리오·최근 일지 요약 → 투자전략요약·매매가이드·리스크요인 3섹션. Google Sheets 7일 캐시. 참고용 |
| 최근 매매 일지 | Sheets | 해당 종목 최근 거래 내역 테이블(일자·구분·수량·단가·금액·비고) |

### 3.6. 매매 복기 (Trading Journal)

- 시트 스키마의 **Journal**(매매복기), **Tags**(전략 태그) 컬럼으로 매매 사유·전략 기록.
- 앱 내 POST `/api/sheets/transactions`로 행 추가 시 Journal·Tags 필드 포함.
- 대시보드 매매 내역 테이블 및 종목 상세 최근 매매 일지에서 열람.

---

## 4. 데이터 모델

### 4.1. 매매내역 시트 (필수)

| 시트 헤더 | 타입 | 설명 |
|-----------|------|------|
| Date | String | YYYY-MM-DD 형식 |
| Ticker | String | 종목명 (예: 삼성전자, LG전자) |
| Type | String | `매수` \| `매도` \| `배당` |
| Quantity | Number | 수량 (양수 정수) |
| Price | Number | 단가 (양수) |
| Fee | Number | 수수료 (선택, 기본 0) |
| Tax | Number | 세금 (선택, 기본 0) |
| Journal | Text | 매매 사유·복기 (선택) |
| Tags | String | 전략 태그, 콤마 구분 (예: #돌파,#눌림목) (선택) |

### 4.2. 종목코드 마스터 시트 (선택)

| 컬럼 | 설명 |
|------|------|
| Ticker | 종목명 또는 식별자 |
| Code | 6자리 KIS 종목코드 |

### 4.3. 종목별 집계 시트 (선택)

| 컬럼 | 설명 |
|------|------|
| Ticker | 종목명 |
| Code | 6자리 KIS 종목코드 (선택) |
| 매수횟수, 매도횟수, 총매수금액, 총매도금액, 실현손익, 보유수량 등 | 집계 값 |

### 4.4. 시스템 캐시 탭 (자동 관리)

| 탭명 | 컬럼 | TTL | 설명 |
|------|------|-----|------|
| `_TICKER_CACHE_` | code, section, data (JSON), updatedAt | 장중 30분 / 장외 다음 개장까지 | KIS·DART API 응답 캐시 |
| `_AI_CACHE_` | code, ticker, content, updatedAt | 7일 | OpenAI gpt-4o-mini 분석 결과 |

캐시 섹션 키: `fundamental`, `ratios`, `estimate`, `trading`, `indicators`, `opinion`

---

## 5. 아키텍처

### 5.1. 라우팅 및 페이지

| 경로 | 설명 |
|------|------|
| `/` | `/dashboard` 리다이렉트 |
| `/dashboard` | 메인 대시보드 |
| `/dashboard/ticker/[id]` | 종목 상세 페이지 |
| `/auth/signin` | Google OAuth 로그인 페이지 |
| `/api/**` | API Routes (NextAuth 미들웨어 보호) |

### 5.2. 데이터 흐름

```
UI Component
  → hooks/use*.ts (React Query)
  → /api/* Route Handler
  → lib/*.ts (비즈니스 로직 + 캐시)
  → 외부 API (KIS / DART / Google Sheets / OpenAI)
```

### 5.3. API Route 목록

| 메서드 | 경로 | 데이터 출처 | 설명 |
|--------|------|------------|------|
| GET | `/api/kis/stock-info` | KIS | 현재가·52주 고저 |
| GET | `/api/kis/indicators` | KIS 일봉 90일 | RSI·MACD 기술적 지표 |
| GET | `/api/kis/opinion` | KIS | 종목·증권사 투자의견 |
| GET | `/api/kis/portfolio-summary` | Sheets + KIS | 포트폴리오 평가 |
| GET | `/api/analysis/summary` | Sheets | 실현손익·승률·태그별 집계 |
| GET | `/api/analysis/cumulative-pnl` | Sheets | 누적 실현손익 시계열 |
| GET | `/api/sheets/transactions` | Sheets | 매매 내역 조회 |
| POST | `/api/sheets/transactions` | Sheets | 매매 내역 추가 (입력 검증 포함) |
| GET | `/api/sheets/ticker-master` | Sheets | 종목코드 마스터 |
| GET | `/api/sheets/aggregation` | Sheets | 종목별 집계 |
| GET | `/api/fundamental` | KIS + DART | 종목 기본 재무 정보 |
| GET | `/api/fundamental/ratios` | KIS | 재무비율 (수익성·안정성·성장성) |
| GET | `/api/fundamental/estimate` | KIS | 추정실적 |
| GET | `/api/fundamental/trading` | KIS | 매매동향 (투자자별·체결량) |
| GET | `/api/fundamental/valuation` | KIS | 가치평가 지표 (PER·PBR·EPS·ROE) |
| GET | `/api/dart/financials` | KIS → DART | 재무제표 (KIS 우선, DART 보완) |
| POST | `/api/ai/trading-guide` | OpenAI | AI 분석·매매 가이드 (7일 캐시) |

### 5.4. 캐싱 계층 (빠른 순서)

| 계층 | 구현 | TTL |
|------|------|-----|
| 1. React Query | 클라이언트 메모리 | staleTime 60s |
| 2. In-memory | `globalThis` (OAuth 토큰, KIS 토큰) | 24시간 |
| 3. Google Sheets | `_TICKER_CACHE_` 탭 | 장중 30분, 장외 다음 개장까지 |
| 4. Google Sheets | `_AI_CACHE_` 탭 | 7일 |
| 5. HTTP 헤더 | `Cache-Control: s-maxage, stale-while-revalidate` | 60–3600s |
| 6. Network | KIS / DART / OpenAI API | - |

### 5.5. 핵심 라이브러리 모듈 (`lib/`)

| 모듈 | 역할 |
|------|------|
| `config.ts` | 환경 변수 중앙 관리 (`config` 객체) |
| `logger.ts` | 구조화 로깅 (`createLogger(tag)`) — dev 모드에서만 debug 출력 |
| `google-oauth.ts` | Google Service Account JWT 토큰 생성·캐싱 |
| `google-sheets.ts` | Sheets API 래퍼 (조회·추가·업데이트) |
| `api-response.ts` | API 응답 헬퍼 (`ok`, `badRequest`, `unauthorized`, `serverError`) |
| `stock-utils.ts` | 종목코드 정규화(`normalizeStockCode`) · 검증(`isValidStockCode`) |
| `analysis.ts` | 실현손익·승률·태그 집계, 누적 손익 시계열 |
| `position-tracker.ts` | FIFO 가중평균 포지션 추적 |
| `portfolio-summary.ts` | 포트폴리오 평가 계산 + KIS 현재가 보강 |
| `ticker-cache.ts` | Google Sheets 캐시 읽기/쓰기, 시장시간 기반 TTL |
| `ai-cache.ts` | OpenAI 분석 결과 Google Sheets 캐시 |
| `ticker-mapping.ts` | 종목명 → 6자리 코드 매핑 |
| `indicators.ts` | RSI(14), MACD(12,26,9) 계산 |
| `dart-api.ts` | DART CORPCODE.xml 파싱, 재무 API 호출 |
| `dart-fundamental.ts` | DART 재무제표 파싱·5개년 트렌드 |
| `kis/` (subdirectory) | KIS API 클라이언트 (토큰·가격·재무·의견·매매동향·스로틀링) |
| `normalize-row.ts` | 시트 원본 행 → `SheetTransactionRow` 파싱 |
| `sort-transactions.ts` | 매매 내역 날짜 정렬 |

### 5.6. React Hooks (`hooks/`)

| 훅 | 역할 |
|----|------|
| `useTickerDetailQueries` | 종목 상세 전체 쿼리 오케스트레이션 (stock-info, fundamental, ratios/estimate/trading, indicators, opinion) |
| `useAiGuidance` | AI 가이드 요청·캐시 조회·강제 갱신 |
| `useFundamentalData` | 기본 재무 정보 |
| `useFundamentalExtended` | 비율·추정·매매동향 병렬 쿼리 |
| `usePortfolioSummary` | 포트폴리오 평가 |
| `useAnalysisSummary` | 분석 요약 |
| `useTransactions` | 매매 내역 |
| `useCumulativePnl` | 누적 손익 |

---

## 6. 타입 시스템

TypeScript strict 모드. Path alias `@/*` = 프로젝트 루트.

| 파일 | 주요 타입 |
|------|---------|
| `types/api.ts` | `PortfolioSummaryResponse`, `TickerAnalysisRow`, `AnalysisSummaryResponse`, `CumulativePnlPoint`, `KisPriceInfo`, `TechnicalIndicatorsResponse`, `KisInvestmentOpinion`, `TickerDetailInfo`, `FundamentalApiResponse` |
| `types/sheet.ts` | `SheetTransactionRow`, `TickerMasterRow`, `TickerAggregationRow`, `RawSheetRow` |

---

## 7. UI/UX 요구사항

- **반응형**: Mobile-first. 모바일·태블릿·데스크탑에서 동작.
- **디자인**: shadcn/ui (new-york 스타일) + Tailwind CSS. 다크/라이트 모드(`next-themes`, class 기반).
- **색상 테마**: CSS 변수 `--color-profit`(수익·빨강), `--color-loss`(손실·파랑) — 한국 주식 시장 관행. `text-profit` / `text-loss` 유틸리티 클래스.
- **카드 스타일**: `rounded-2xl border shadow-sm`. 빈 상태·에러 상태 일관 처리.
- **로딩**: `components/ui/table-skeleton.tsx` 공통 테이블 스켈레톤, 섹션별 스켈레톤(`ticker-detail/skeletons.tsx`).
- **에러 재시도**: `queryClient.invalidateQueries()` 기반 재시도 버튼.
- **접근성**: 버튼/링크 `aria-label`, 시맨틱 헤딩·nav.

---

## 8. 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `AUTH_SECRET` | ✅ | NextAuth 세션 서명 (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth 2.0 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth 2.0 클라이언트 시크릿 |
| `GOOGLE_SPREADSHEET_ID` | ✅ | Google Sheets 스프레드시트 ID |
| `GOOGLE_SHEET_NAME` | | 매매내역 탭명 (기본값: `매매내역`) |
| `GOOGLE_SHEET_TICKER_MASTER` | | 종목코드 마스터 탭명 |
| `GOOGLE_SHEET_AGGREGATION` | | 종목별 집계 탭명 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅* | Service Account JSON 문자열 (Vercel) |
| `GOOGLE_APPLICATION_CREDENTIALS` | ✅* | Service Account 키 파일 경로 (로컬) |
| `KIS_APP_KEY` | ✅ | KIS Open API 앱 키 |
| `KIS_APP_SECRET` | ✅ | KIS Open API 앱 시크릿 |
| `KIS_APP_SVR` | | KIS API 서버 URL (기본값: `https://openapi.koreainvestment.com:9443`) |
| `KIS_THROTTLE_MS` | | KIS API 요청 간격 ms (기본값: `200`) |
| `DART_API_KEY` | | DART 전자공시 API 키 (미설정 시 DART 섹션 비활성) |
| `OPENAI_API_KEY` | | OpenAI API 키 (미설정 시 AI 분석 비활성) |
| `ALLOWED_EMAIL` | | 허용 이메일 (미설정 시 모든 Google 계정 허용) |

\* `GOOGLE_SERVICE_ACCOUNT_JSON` 또는 `GOOGLE_APPLICATION_CREDENTIALS` 중 하나 필수.

---

## 9. 제약사항 및 예외 처리

- **API Rate Limit**: React Query `staleTime`/`gcTime` + Google Sheets 캐시로 KIS 요청 최소화. `EGW00133` 응답 시 `lib/kis/client.ts`에서 자동 재시도.
- **부분 실패 허용**: `/api/fundamental`은 `Promise.allSettled` 패턴 적용 — KIS/DART 하나 실패해도 성공한 데이터만 반환.
- **빈 값**: 시트 Fee·Tax·Journal·Tags 등 null/undefined 시 `normalize-row.ts`에서 0 또는 `""` 처리.
- **장외 시간**: KIS API 마지막 종가 정상 표시. 응답 오류 시 "장 마감" 메시지·크래시 방지.
- **재무 데이터 우선순위**: KIS 재무·비율 API 우선, 미제공 시 DART 보완. `DART_API_KEY` 미설정 시 KIS만 표시.
- **KST 타임존**: 캐시 TTL 계산 시 `Intl` API 기반 KST 시간 사용 — UTC 수동 오프셋 방지.
- **POST 입력 검증**: `/api/sheets/transactions` — Quantity·Price 양수 정수, Date `YYYY-MM-DD` 형식, Type 열거형 제한.

---

## 10. 테스트

테스트 프레임워크: **Vitest**. 커버리지: `@vitest/coverage-v8`.

| 파일 | 대상 | 핵심 케이스 |
|------|------|-----------|
| `tests/lib/analysis.test.ts` | `lib/analysis.ts` | 실현손익, 승률, 빈 거래, 다중 매도 |
| `tests/lib/ticker-cache.test.ts` | `lib/ticker-cache.ts` | 장중 30분 TTL, 장마감 후 유지, KST 경계 |
| `tests/lib/stock-utils.test.ts` | `lib/stock-utils.ts` | 코드 정규화, 6자리 패딩, 000000 거부 |
| `tests/lib/position-tracker.test.ts` | `lib/position-tracker.ts` | FIFO 가중평균, 복수 매도 |
| `tests/lib/normalize-row.test.ts` | `lib/normalize-row.ts` | 시트 행 파싱 |
| `tests/lib/sort-transactions.test.ts` | `lib/sort-transactions.ts` | 날짜 정렬 안정성 |

```bash
npm run test              # 전체 실행
npm run test:watch        # 감시 모드
npm run test:coverage     # 커버리지 리포트
npx vitest run tests/lib/analysis.test.ts  # 단일 파일
```

---

## 11. 배포

- **소스 관리**: GitHub 브랜치 전략 (`main` → 프로덕션, `01_claude` → 개발).
- **배포**: Vercel. Next.js App Router·API Routes → 서버리스 함수. 프로덕션 환경 변수는 Vercel 프로젝트 설정 관리.
- **번들 크기**: `next.config.mjs`의 `outputFileTracingExcludes`로 미사용 node_modules 제외 (Vercel 250MB 제한 준수). **이 설정 제거 금지**.
- **KIS 토큰 경로**: 로컬 `.next/cache/kis-token.json` / Vercel `/tmp/kis-token.json` (환경 자동 전환).
- **참고 문서**: `docs/VERCEL_DEPLOYMENT.md`, `docs/ARCHITECTURE.md`

---

## 12. 문서 이력

| 버전 | 일자 | 변경 요약 |
|------|------|-----------|
| 1.0 | 2025-03-05 | 최초 작성 |
| 1.1 | 2026-03-05 | §7 배포 및 소스 관리 추가 |
| 1.2 | 2026-03-05 | §3.4 인사이트 대시보드·네비 추가 |
| 1.3 | 2026-03-06 | §3.3 종목 상세 현행화(KIS+DART, 갱신, AI 가이드) |
| 1.4 | 2026-03-07 | 재무·비율·투자의견·DART 연동·제약 명시 |
| 2.0 | 2026-03-07 | 전면 정리: 인증·대시보드 UI·종목 상세 섹션·매매동향 3종 차트·일자 포맷 통일·배포 참조 |
| 3.0 | 2026-06-02 | 전면 개편 반영: 아키텍처·API 목록·캐싱 계층·신규 모듈(config/logger/google-oauth/api-response/stock-utils)·hooks 분리·타입 시스템·테스트·환경 변수 전체 현행화 |
