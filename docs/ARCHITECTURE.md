# Architecture: 국내주식 투자 지원 앱

본 문서는 [PRD.md](PRD.md)에 정의된 요구사항을 구현하기 위한 **기술 아키텍처**, **데이터 흐름**, **폴더 구조**, **API 설계**, **배포**를 정리합니다. 구현·운영 시 참조용 단일 소스로 사용합니다.

---

## 1. 기술 스택

| 영역 | 선택 | 비고 |
|------|------|------|
| **Framework** | Next.js 15 (App Router) | API Route로 키/토큰 비노출, 서버 컴포넌트·클라이언트 구분 |
| **UI** | React 19, shadcn/ui, Tailwind CSS | 반응형, 다크/라이트, 수익/손실 시맨틱 색상 |
| **차트** | Recharts | 대시보드·종목 상세 차트 |
| **데이터 페칭/캐시** | TanStack Query (React Query) | staleTime/gcTime, refetch, Rate Limit 완화 |
| **인증** | NextAuth.js | Google OAuth 2.0, 세션 |
| **데이터 소스** | Google Sheets API (읽기/append) | 서비스 계정 JWT 또는 `GOOGLE_SERVICE_ACCOUNT_JSON` |
| **실시간·종목 정보** | 한국투자증권 KIS Open API | 현재가, 52주, 재무, 비율, 투자의견, 매매동향, 일봉, 보조지표 |
| **재무 보완** | DART 전자공시 API | 5개년 재무·현금흐름, 잠정실적 링크 |
| **AI** | OpenAI API | 종목별 분석·매매 가이드(참고) |
| **소스 관리** | GitHub | 버전 관리, 브랜치 전략 |
| **배포** | Vercel | Next.js 네이티브, 서버리스 API Routes, 환경 변수 |

**백엔드 형태**: 클라이언트는 Google Sheets / KIS / DART / OpenAI를 직접 호출하지 않습니다. 모든 외부 연동은 **Next.js API Routes**를 경유하며, API 키·토큰·시크릿은 서버 전용 환경 변수로만 사용합니다. KIS Access Token은 서버 메모리와 **파일 캐시**(`.next/cache/kis-token.json`)로 캐싱하여 Vercel 서버리스 인스턴스 간 재사용을 도모합니다.

---

## 2. 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Client (Browser)                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │ /dashboard  │  │/dashboard/  │  │ Auth        │                      │
│  │ 대시보드     │  │ticker/[id]  │  │ (NextAuth)  │                      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                      │
│         │                │                │                              │
│         └────────────────┼────────────────┘                              │
│                          │ fetch /api/* (TanStack Query)                 │
└──────────────────────────┼──────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Next.js Server (API Routes, Server Components)                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ /api/sheets/*  /api/kis/*  /api/dart/*  /api/analysis/*           │   │
│  │ /api/fundamental  /api/ai/trading-guide  /api/auth/*               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │ lib/        │  │ KIS Token   │  │ unstable_   │                      │
│  │ google-     │  │ Cache       │  │ cache       │                      │
│  │ sheets,     │  │ (memory +   │  │ (DART 등)   │                      │
│  │ kis-api,    │  │  file)      │  │             │                      │
│  │ dart-api,   │  └──────┬──────┘  └──────┬──────┘                      │
│  │ ticker-     │         │                │                             │
│  │ mapping     │         │                │                             │
│  └──────┬──────┘         │                │                             │
└─────────┼────────────────┼────────────────┼─────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  External APIs                                                            │
│  Google Sheets API │ KIS Open API │ DART Open API │ OpenAI API           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 데이터 흐름

### 3.1. 시트 → 앱 (Read)

- 클라이언트: `useSheetData`, `useAnalysisSummary` 등에서 TanStack Query로 `/api/sheets/transactions`, `/api/analysis/summary` 호출.
- API Route가 Google Sheets API로 스프레드시트 읽기. 서비스 계정 인증: `GOOGLE_APPLICATION_CREDENTIALS`(파일) 또는 `GOOGLE_SERVICE_ACCOUNT_JSON`(문자열).
- 실시간 푸시는 없음. **폴링/탭 포커스 refetch** 또는 사용자 새로고침으로 최신화.

### 3.2. 앱 → 시트 (Append)

- 클라이언트가 `POST /api/sheets/transactions` 호출. Body: Date, Ticker, Type, Quantity, Price, Fee, Tax, Journal, Tags.
- API Route가 Sheets API `spreadsheets.values.append`로 해당 시트 마지막 행에 한 행 추가.

### 3.3. KIS: 토큰·현재가·포트폴리오

- **토큰**: `lib/kis-api.ts`에서 24시간 유효 Access Token 발급. `globalThis` + `.next/cache/kis-token.json`에 캐시. 만료 전 재발급 방지. 1분당 1회 제한(EGW00133) 시 403 후 대기 후 재시도.
- **종목코드**: `getTickerCodeMap()` (ticker-mapping) — (1) 종목코드 마스터 시트 (2) 종목별 집계 시트 Code (3) 하드코딩 fallback.
- **흐름**: `/api/kis/portfolio-summary` → 토큰 취득 → getTickerCodeMap() → 보유 종목별 KIS 현재가 조회 → 총 매수금액·평가금액·평가손익 계산 → JSON 반환.

### 3.4. KIS: 종목 시세·52주

- **GET /api/kis/stock-info?code=|ticker=**: 단일 종목 현재가(전일대비·시고저·거래량)·52주 고/저. `getPriceInfo`, `getDailyChart`(일봉) 사용. Cache-Control: s-maxage=300, stale-while-revalidate.

### 3.5. KIS: 종목 재무·비율·투자의견·매매동향·일봉

- **GET /api/fundamental?code=&revalidate=1**: KIS와 DART를 **Promise.all**로 병렬 조회.
  - **KIS**: 현재가, PER/PBR/EPS/BPS, 대차대조표, 손익계산서, 재무비율(수익성·안정성·성장성·기타), 추정실적, 투자의견(종목+증권사별), 투자자 매매동향 일별, 일별 체결량, 주식현재가 일자별(30거래일). revalidate=1이면 캐시 스킵.
  - **DART**: 5개년 재무·현금흐름, 잠정실적 링크, 공시 문서. `lib/dart-fundamental.ts`, `lib/dart-api.ts`.
- **주식현재가 일자별**: FHKST01010400, FID_COND_MRKT_DIV_CODE=UN, FID_PERIOD_DIV_CODE=D, FID_ORG_ADJ_PRC=1. 수신 후 오늘-30일~오늘(일력) 필터.
- **투자자 매매동향·일별 체결량**: 최근 30일(일력) 구간. FHPTJ04160001(일자별 호출), FHKST03010800(구간 조회).

### 3.6. DART 재무

- **GET /api/dart/financials?code=**: 단일 종목 대차대조표·손익계산서·재무비율. `unstable_cache` 1시간. revalidate 파라미터로 캐시 스킵 가능.
- **fundamental 라우트 내부**: `getDartTrendOnly`, `getDartPreliminaryAndDocument` 등으로 5개년·잠정실적 링크·문서 섹션 조회.

### 3.7. 분석 API (시트 기반 집계)

- **GET /api/analysis/summary**: 시트 매매 내역을 읽어 종목별·태그별 실현손익·승률 집계. `lib/analysis.ts`. 클라이언트: useAnalysisSummary.
- **GET /api/analysis/cumulative-pnl?period=6m|1y**: 기간별 누적 실현손익 시계열. useCumulativePnl.

### 3.8. AI 매매 가이드

- **POST /api/ai/trading-guide**: Body: code, ticker, context?(detailSummary, journalEntries). OpenAI API로 종목 맥락 요약·매매 가이드 생성. `OPENAI_API_KEY` 필수. 참고용, 권유 아님.

---

## 4. 애플리케이션 구조

```
app/
├── layout.tsx                    # 루트 레이아웃, 메타데이터(투자 지원 대시보드)
├── page.tsx                     # / → redirect(/dashboard)
├── globals.css                  # Tailwind, CSS 변수(수익/손실), .scrollbar-thin
├── auth/
│   └── signin/page.tsx          # Google 로그인 페이지
├── dashboard/
│   ├── page.tsx                 # 대시보드 (요약 카드, 종목별 분석, 차트, Tags, 매매 내역)
│   └── ticker/[id]/page.tsx    # 종목 상세 (id = 종목코드 또는 종목명)
└── api/
    ├── auth/
    │   ├── [...nextauth]/route.ts   # NextAuth 핸들러
    │   └── logout/route.ts          # 로그아웃
    ├── sheets/
    │   ├── transactions/route.ts    # GET 목록, POST append
    │   ├── ticker-master/route.ts   # GET 종목코드 마스터
    │   └── aggregation/route.ts     # GET 종목별 집계
    ├── kis/
    │   ├── portfolio-summary/route.ts  # GET 보유 평가
    │   ├── stock-info/route.ts         # GET 단일 종목 시세·52주
    │   ├── opinion/route.ts            # GET 투자의견 (단독 호출 시)
    │   └── indicators/route.ts         # GET RSI, MACD (일봉 기반)
    ├── dart/
    │   └── financials/route.ts    # GET 재무제표·비율
    ├── fundamental/
    │   ├── route.ts               # GET KIS+DART 통합 (재무·비율·투자의견·매매동향·일봉 등)
    │   ├── financials/route.ts    # GET KIS 재무만 (대체 진입점)
    │   └── valuation/route.ts    # GET KIS 가치지표만
    ├── analysis/
    │   ├── summary/route.ts       # GET 종목별·태그별 집계
    │   └── cumulative-pnl/route.ts # GET 누적 수익금 시계열
    └── ai/
        └── trading-guide/route.ts # POST AI 분석·매매 가이드

lib/
├── google-sheets.ts             # Sheets API: 인증, read, append, getTickerMaster, getTickerAggregation
├── normalize-row.ts             # 시트 Row 파싱 시 null/undefined → 0 또는 ""
├── ticker-mapping.ts            # getTickerCodeMap(), tickerToCode, codeToTicker
├── kis-api.ts                   # KIS 인증, 토큰 캐시, 현재가·52주·재무·비율·투자의견·매매동향·일봉·보조지표
├── dart-api.ts                  # DART corpCode, fnlttSinglAcnt (재무 항목)
├── dart-fundamental.ts          # DART 5개년 트렌드, 잠정실적 링크, 문서 섹션
├── analysis.ts                  # 시트 기반 종목별·태그별 집계, 누적 실현손익 시계열
├── portfolio-summary.ts         # 보유 종목 계산, KIS 평가 요약
├── sort-transactions.ts        # 거래 정렬 유틸
├── indicators.ts                # RSI, MACD 계산 (일봉 배열)
├── api-client.ts                # 클라이언트용 fetch 래퍼 (baseURL, credentials)
└── utils.ts                     # 공통 유틸

components/
├── AppNav.tsx                   # 상단 네비: 대시보드, 종목별 분석, 매매 내역, 로그아웃 (스티키)
├── providers.tsx               # QueryClientProvider, SessionProvider
├── dashboard/
│   ├── SummaryCards.tsx         # 실현손익·평가손익·승률·총자산 카드
│   ├── TickerAnalysisTable.tsx  # 종목별 분석 테이블 (정렬·필터·보유/전체)
│   ├── CumulativePnlChart.tsx   # 누적 수익금 AreaChart (6m/1y)
│   ├── PositionConcentrationChart.tsx  # 포지션 집중도 BarChart
│   ├── PnLContributionChart.tsx # 손익 기여도 BarChart + 손실 포지션 테이블
│   ├── TagSummaryTable.tsx     # 전략별 성과 테이블
│   └── TickerDetailContent.tsx  # 종목 상세 전체 (시세·가치·재무·비율·추정·매매동향·의견·DART·공시·포트폴리오·보조지표·AI·일지)
└── transactions/
    └── TransactionTable.tsx     # 매매 내역 테이블 (페이지네이션)

hooks/
├── useSheetData.ts              # 시트 매매 내역 (React Query)
├── usePortfolioSummary.ts       # KIS 포트폴리오 요약
├── useAnalysisSummary.ts        # 종목별·태그별 분석 요약
├── useCumulativePnl.ts          # 누적 수익금 시계열 (6m/1y)
└── useFundamentalData.ts        # GET /api/fundamental (종목 상세용)

types/
├── sheet.ts                     # SheetTransactionRow, TickerMasterRow, TickerAggregationRow
└── api.ts                       # API 응답 타입 (Portfolio, Analysis, KIS, DART, Indicators 등)
```

---

## 5. API 설계

| Method | 경로 | 설명 |
|--------|------|------|
| GET | `/api/sheets/transactions` | 매매 내역 시트 반환 |
| POST | `/api/sheets/transactions` | Body: Date, Ticker, Type, Quantity, Price, Fee, Tax, Journal, Tags. 한 행 Append |
| GET | `/api/sheets/ticker-master` | 종목코드 마스터 시트 |
| GET | `/api/sheets/aggregation` | 종목별 집계 시트 |
| GET | `/api/kis/portfolio-summary` | 보유 종목 + 현재가 → 총매수·평가·평가손익 |
| GET | `/api/kis/stock-info?code=\|ticker=` | 단일 종목 시세·52주 고저. 캐시 5분 |
| GET | `/api/kis/opinion?code=` | KIS 투자의견 (단독) |
| GET | `/api/kis/indicators?code=` | RSI(14), MACD(12,26,9). 일봉 기반 |
| GET | `/api/dart/financials?code=` | DART 재무제표·비율. unstable_cache 1시간 |
| GET | `/api/fundamental?code=&revalidate=1` | KIS(현재가·재무·비율·추정·의견·매매동향·일봉) + DART(5개년·잠정·문서) 통합 |
| GET | `/api/fundamental/financials?code=` | KIS 재무만 |
| GET | `/api/fundamental/valuation?code=` | KIS 가치지표만 |
| GET | `/api/analysis/summary` | 종목별·태그별 실현손익·승률 집계 |
| GET | `/api/analysis/cumulative-pnl?period=6m\|1y` | 누적 실현손익 시계열 |
| POST | `/api/ai/trading-guide` | Body: code, ticker, context?. AI 분석·매매 가이드 |
| * | `/api/auth/[...nextauth]` | NextAuth (Google 등) |
| GET | `/api/auth/logout` | 로그아웃 |

**캐시·Rate Limit**: 클라이언트는 TanStack Query `staleTime`/`gcTime`으로 재요청 완화. KIS 응답은 API Route에서 Cache-Control 또는 서버 캐시 적용. KIS 1분당 제한은 토큰 캐시·재시도 대기로 완화.

---

## 6. 핵심 모듈 책임

| 모듈 | 책임 | PRD/비고 |
|------|------|----------|
| **ticker-mapping** | getTickerCodeMap(): (1) 마스터 시트 (2) 집계 시트 Code (3) 하드코딩 fallback. 종목명→6자리 코드 | §3.2 |
| **KIS token cache** | 24시간 토큰 서버 메모리 + `.next/cache/kis-token.json` 파일 캐시. 만료 전 재발급 방지 | §3.2, §6 |
| **normalize-row** | 시트 Row 파싱 시 Fee, Tax, Journal 등 null/undefined → 0 또는 "" | §6 빈 값 |
| **google-sheets** | JWT 서명·토큰 교환(서비스 계정), spreadsheets.values.get/append, 마스터/집계 시트 읽기 | §3.1 |
| **kis-api** | 인증, getPriceInfo, getDailyChart, 재무(BalanceSheet, IncomeStatement), 비율(재무·수익성·안정성·성장·기타), 추정실적, 투자의견, 매매동향 일별, 일별 체결량, 주식현재가 일자별, RSI/MACD용 일봉 | §3.3, §3.5 |
| **dart-api / dart-fundamental** | DART corpCode, fnlttSinglAcnt, 5개년 트렌드·잠정실적 링크·문서 | §3.3 |
| **analysis** | 시트 거래 기준 종목별·태그별 집계, 누적 실현손익 시계열 | §3.4 |
| **indicators** | RSI(14), MACD(12,26,9) 계산 | §3.5 보조지표 |

---

## 7. UI/UX 아키텍처

- **반응형**: Mobile-first. Tailwind breakpoints (sm, md, lg). 테이블은 overflow-x-auto 또는 min-width로 가로 스크롤.
- **디자인**: shadcn/ui + Tailwind. 다크/라이트는 `class` 기반. 수익/손실은 `--color-profit`, `--color-loss` (hsl) 및 `.text-profit`, `.text-loss`.
- **대시보드**: 섹션별 rounded-2xl 카드, shadow-sm. 요약 카드 아이콘, 차트 기간 pill, 테이블 thead bg-muted/40·text-xs font-medium text-muted-foreground. 빈 상태·에러는 border-dashed·bg-muted/10 또는 destructive/5.
- **종목 상세**: 히어로(종목명·코드·현재가·갱신)·섹션 네비(pill 가로 스크롤)·섹션 scroll-mt-6. 차트 툴팁 rounded-lg border border-border/50 bg-card shadow-md.
- **접근성**: 버튼/링크 aria-label, nav aria-label, 시맨틱 header/section.

---

## 8. 보안 및 환경 변수

- **원칙**: API 키·토큰·시크릿은 **서버 전용** 환경 변수. 클라이언트 번들에 포함되지 않음. 클라이언트는 `/api/*`만 호출.
- **로컬**: `.env.local`에 설정. Git 미커밋. `.env.example`에 변수 목록·설명.
- **프로덕션(Vercel)**: Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에 동일 이름으로 등록. Production/Preview/Development 구분 가능.

**주요 환경 변수 요약** (상세는 `.env.example` 참고):

| 변수 | 용도 |
|------|------|
| AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | NextAuth Google 로그인 |
| GOOGLE_SPREADSHEET_ID, GOOGLE_SHEET_NAME, GOOGLE_SERVICE_ACCOUNT_JSON(또는 GOOGLE_APPLICATION_CREDENTIALS) | Google Sheets API |
| GOOGLE_SHEET_TICKER_MASTER, GOOGLE_SHEET_AGGREGATION | 선택 시트 탭 |
| DART_API_KEY | DART 전자공시 API |
| KIS_APP_KEY, KIS_APP_SECRET | KIS Open API. 실전/모의: KIS_APP_SVR=vps 등 |
| OPENAI_API_KEY | AI 매매 가이드 |

---

## 9. 배포 (Vercel)

### 9.1. 사전 조건

- GitHub 저장소에 소스 푸시.
- Vercel 계정 연동 (GitHub 로그인 권장).

### 9.2. 프로젝트 연결

1. Vercel 대시보드 → **Add New** → **Project**.
2. **Import** 할 GitHub 저장소 선택.
3. **Framework Preset**: Next.js 자동 인식. **Root Directory** 필요 시 지정. **Build Command**: `npm run build`(기본). **Output Directory**: `.next`(기본).
4. **Environment Variables**에서 아래 변수 추가 (Production/Preview 등 적용 환경 선택).

### 9.3. 환경 변수 (Vercel)

| 이름 | 값 | 비고 |
|------|-----|------|
| AUTH_SECRET | `openssl rand -base64 32` 출력 | NextAuth 암호화 |
| GOOGLE_CLIENT_ID | GCP OAuth 2.0 클라이언트 ID | NextAuth Google |
| GOOGLE_CLIENT_SECRET | GCP OAuth 2.0 시크릿 | |
| GOOGLE_SPREADSHEET_ID | 시트 URL의 `/d/`~`/edit` 사이 | 필수 |
| GOOGLE_SHEET_NAME | 매매내역 탭 이름 | 예: 매매내역 |
| GOOGLE_SERVICE_ACCOUNT_JSON | 서비스 계정 JSON **전체 문자열** | 파일 대신 변수로. [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) 참고 |
| GOOGLE_SHEET_TICKER_MASTER | (선택) 종목코드 마스터 탭 | |
| GOOGLE_SHEET_AGGREGATION | (선택) 종목별 집계 탭 | |
| DART_API_KEY | opendart.fss.or.kr 인증키 | 재무 보완용 |
| KIS_APP_KEY | KIS 앱키 | 평가·종목 정보용 |
| KIS_APP_SECRET | KIS 시크릿 | |
| OPENAI_API_KEY | OpenAI API 키 | AI 가이드용(선택) |

- **리디렉션 URI**: GCP OAuth 클라이언트에 `https://<도메인>/api/auth/callback/google` 추가.
- **Vercel 빌드**: 환경 변수는 빌드·런타임 모두 서버에서만 노출. 클라이언트에 `NEXT_PUBLIC_*`가 없으면 노출되지 않음.

### 9.4. 배포 흐름

1. **Deploy**: 저장소 연결 후 첫 Deploy로 자동 빌드·배포. 이후 **main**(또는 설정한 Production Branch) 푸시 시 자동 재배포.
2. **Preview**: PR마다 Preview URL 생성. Preview용 환경 변수 별도 설정 가능.
3. **도메인**: Vercel 기본 `*.vercel.app` 또는 커스텀 도메인 연결.

### 9.5. CI/CD

- GitHub 저장소를 Vercel 프로젝트에 연결하면 **푸시 시 자동 빌드·배포**가 기본 동작.
- 프로덕션 환경 변수는 **Vercel 대시보드에서만** 설정하고, 저장소에는 `.env.example`만 두고 실제 값은 넣지 않음.
- 빌드 실패 시 Vercel 대시보드·이메일에서 확인. 함수 크기 제한(250MB 등)은 [Vercel 문서](https://vercel.com/docs/functions/serverless-functions/runtimes#bundle-size) 참고.

### 9.6. KIS 토큰 캐시 (서버리스)

- Vercel 서버리스는 요청 단위로 인스턴스가 실행되므로 **인메모리 캐시**는 요청 간 유지되지 않을 수 있음.
- 현재 구현: **파일 캐시** `.next/cache/kis-token.json`을 사용. Vercel에서 함수가 같은 인스턴스에서 재사용되면 파일 캐시로 토큰 재사용. 인스턴스가 새로 뜨면 토큰 재발급.
- 필요 시 **Vercel KV / Upstash Redis** 등 외부 캐시에 토큰 저장해 여러 인스턴스가 공유하도록 확장 가능.

---

## 10. 예외 처리 및 제약 (PRD §6 요약)

| 제약 | 처리 |
|------|------|
| **API Rate Limit** | 클라이언트: React Query staleTime/refetch. 서버: KIS 재시도 대기, 캐시 헤더. |
| **빈 값 (null/undefined)** | normalize-row + 타입 optional. Fee/Tax/Journal 등 0 또는 "" fallback. |
| **장외 시간 (KIS)** | kis-api에서 에러 시 크래시 방지, UI에 "시세 없음" 등 메시지. |
| **DART 미설정** | DART_API_KEY 없으면 해당 종목은 KIS 데이터만 표시. |
| **토큰 만료** | 만료 전 재발급 방지. 만료 시 자동 재발급 후 캐시 갱신. |

---

## 11. 문서 이력

| 버전 | 일자 | 변경 요약 |
|------|------|-----------|
| 1.1 | 2026-03-05 | GitHub, Vercel 배포 반영 |
| 1.2 | 2026-03-06 | KIS stock-info, 종목 상세, API 설계 보강 |
| 2.0 | 2026-03-07 | 전면 갱신: §1~§10. 앱 구조·API 목록·배포 상세(Vercel 단계·환경 변수·CI/CD·서버리스 토큰). PRD 2.0과 정합성 유지 |
