# 앱 일괄 생성 체크리스트 및 추가 필요사항

[docs/PRD.md](PRD.md), [docs/ARCHITECTURE.md](ARCHITECTURE.md)를 기준으로 애플리케이션을 **일괄 생성**할 때 필요한 항목을 검토하고, ARCHITECTURE에 없거나 보완이 필요한 사항을 정리한 문서입니다.

---

## 1. 현재 완료된 항목 (추가 생성 불필요)

| 항목 | 상태 |
|------|------|
| PRD, ARCHITECTURE 문서 | 완료 |
| .gitignore | 완료 |
| .env.example | 완료 |
| .gitattributes | 완료 |
| README.md | 완료 |
| Git 저장소 | 초기화됨 |

---

## 2. ARCHITECTURE 보완 사항 (구현 시 반영)

아래는 ARCHITECTURE에는 폴더/역할만 있고, **실제 파일 경로·구성**을 일괄 생성할 때 명확히 해야 할 부분입니다.

### 2.1. API Route 파일 위치 (Next.js App Router)

- **시트**: `app/api/sheets/transactions/route.ts` 한 파일에서 GET(목록), POST(append) 모두 처리.  
  `app/api/sheets/route.ts`는 사용하지 않음.
- **KIS**: `app/api/kis/portfolio-summary/route.ts` 한 파일에서 GET만 처리.

### 2.2. Provider 및 전역 설정 (ARCHITECTURE에 미명시)

- **TanStack Query**: 앱 전역에서 사용하려면 `QueryClientProvider`로 루트 레이아웃을 감싸야 함.  
  → `app/layout.tsx`에서 사용할 `components/providers.tsx`(또는 `app/providers.tsx`) 생성 필요.
- **테마(다크/라이트)**: shadcn/ui 권장대로 `next-themes`의 `ThemeProvider` 사용.  
  → 동일하게 `components/providers.tsx`에 포함하거나, layout에서 직접 래핑.
- **Path alias**: `@/components`, `@/lib`, `@/hooks`, `@/types` 등.  
  → `tsconfig.json`의 `paths` (create-next-app 시 보통 `@/*` 설정됨).

### 2.3. Tailwind 테마 확장 (PRD §5 한국 주식 색상)

- 수익(빨강)·손실(파랑)을 재사용하려면 `tailwind.config.ts`에 커스텀 색상 추가 또는 CSS 변수 정의.  
  → 예: `profit: '...'`, `loss: '...'` 또는 `--color-profit`, `--color-loss`.

---

## 3. 일괄 생성 시 추가로 필요한 항목

### 3.1. 프로젝트 루트

| 대상 | 목적 |
|------|------|
| **Node 버전 고정** | `.nvmrc`에 `20` 또는 `18` 기입, 또는 `package.json`의 `engines.node` 지정. ARCHITECTURE 권장 18.17+ 준수. |
| **create-next-app 실행 옵션** | 기존 `.gitignore`, `.env.example`, `README.md`를 덮어쓰지 않도록, 생성 후 병합하거나 옵션으로 기존 유지. |

### 3.2. 패키지 의존성 (ARCHITECTURE §1 + 구현 필수)

- **필수**: next, react, react-dom, typescript, tailwindcss, shadcn/ui 설치 시 필요한 의존성 (tailwind-merge, class-variance-authority, clsx 등).
- **데이터/차트**: @tanstack/react-query, recharts.
- **Google Sheets**: 서버 전용이면 `googleapis`(google-api-nodejs-client) 또는 fetch로 Sheets API 호출.  
  → 클라이언트 노출 금지이므로 API Route에서만 사용.
- **테마**: next-themes (shadcn 다크모드용).

### 3.3. 종목코드 매핑 데이터 (ARCHITECTURE §6)

- `lib/ticker-mapping.ts`에서 사용할 **초기 데이터** 필요.  
  - 한글 종목명 → 6자리 코드 매핑을 JSON 또는 TS 상수로 보관.  
  - 일괄 생성 시: 빈 객체 `{}` 또는 샘플 1~2종목으로 스캐폴딩 후, 실제 데이터는 추후 확장.

### 3.4. 환경 변수 (클라이언트 노출 여부)

- `.env.example`에 있는 변수는 모두 **서버 전용**으로 두고, `NEXT_PUBLIC_*`는 사용하지 않음.  
  → next.config에서 env 노출 설정 불필요.  
- (선택) 빌드/실행 전 필수 env 검사: API Route에서 `process.env.GOOGLE_SPREADSHEET_ID` 등이 없으면 503 또는 명확한 에러 메시지 반환하도록 stub에서부터 준비.

---

## 4. 일괄 생성 권장 순서

1. **Git/문서 유지**  
   기존 `.gitignore`, `.env.example`, `README.md`, `docs/`는 유지.

2. **Next.js 프로젝트 초기화**  
   `create-next-app` (App Router, TypeScript, Tailwind, ESLint)으로 루트에 생성.  
   생성 시 `.gitignore` 등이 덮어쓰이면, 기존 내용으로 복구하거나 수동 병합.

3. **shadcn/ui 초기화**  
   `npx shadcn@latest init` 후, 필요한 컴포넌트 추가: Button, Card, Table, Dialog(Modal), Sheet(사이드 시트), Input, Label 등.

4. **추가 패키지 설치**  
   @tanstack/react-query, recharts, next-themes, googleapis(또는 선택한 Google API 클라이언트).

5. **타입·유틸·스텁 생성**  
   - `types/sheet.ts`, `types/api.ts`  
   - `lib/normalize-row.ts`, `lib/ticker-mapping.ts`  
   - `lib/google-sheets.ts`, `lib/kis-api.ts` (스텁: 미구현 시 빈 배열/고정값 반환 또는 "Not implemented" 응답).

6. **API Route 생성**  
   - `app/api/sheets/transactions/route.ts` (GET, POST)  
   - `app/api/kis/portfolio-summary/route.ts` (GET).

7. **Provider 및 레이아웃**  
   - `components/providers.tsx` (QueryClientProvider, ThemeProvider)  
   - `app/layout.tsx`에서 providers 래핑, 메타/폰트 등 설정.

8. **페이지·컴포넌트 스캐폴딩**  
   - `app/page.tsx` (대시보드로 리다이렉트 또는 대시보드 임베드)  
   - `app/dashboard/page.tsx`  
   - `components/dashboard/` (SummaryCard, 차트 placeholder)  
   - `components/transactions/` (거래 테이블 placeholder)  
   - `components/journal/` (모달/사이드시트 placeholder).

9. **훅 생성**  
   - `hooks/useSheetData.ts`, `hooks/usePortfolioSummary.ts`, `hooks/useTransactions.ts`  
   - 각각 `/api/sheets/transactions`, `/api/kis/portfolio-summary` 호출 및 TanStack Query 사용.

10. **Tailwind 테마**  
    - 수익/손실 색상용 CSS 변수 또는 tailwind.config 확장.

---

## 5. 생성할 파일 목록 (실행 가능한 최소 스캐폴딩)

아래는 **일괄 생성** 시 만들어 두면, `npm run dev` 후 빌드가 되고 대시보드/API가 동작하는 최소 집합입니다.

| 경로 | 용도 |
|------|------|
| `app/layout.tsx` | 루트 레이아웃, providers 래핑 |
| `app/page.tsx` | `/` → 대시보드 리다이렉트 또는 대시보드 포함 |
| `app/dashboard/page.tsx` | 대시보드 페이지 (카드·차트 placeholder) |
| `app/api/sheets/transactions/route.ts` | GET 목록, POST append |
| `app/api/kis/portfolio-summary/route.ts` | GET 포트폴리오 요약 |
| `components/providers.tsx` | QueryClientProvider, ThemeProvider |
| `components/dashboard/SummaryCards.tsx` | 지표 카드 placeholder |
| `components/transactions/TransactionTable.tsx` | 거래 테이블 placeholder |
| `components/journal/JournalModal.tsx` | 매매 복기 모달 placeholder |
| `hooks/useSheetData.ts` | 시트 거래 목록 useQuery |
| `hooks/usePortfolioSummary.ts` | 포트폴리오 요약 useQuery |
| `hooks/useTransactions.ts` | 거래 목록/상세 (useSheetData 래핑 또는 별도) |
| `lib/google-sheets.ts` | getTransactions, appendTransaction (스텁 가능) |
| `lib/kis-api.ts` | getToken, getCurrentPrice, 토큰 캐시 (스텁 가능) |
| `lib/ticker-mapping.ts` | 종목명→코드 매핑 (빈 객체/샘플) |
| `lib/normalize-row.ts` | 시트 행 null/undefined → 0 또는 "" |
| `types/sheet.ts` | Date, Ticker, Type, Quantity, Price, Fee, Tax, Journal, Tags 타입 |
| `types/api.ts` | 포트폴리오 요약·거래 목록 응답 타입 |

shadcn/ui 컴포넌트는 `npx shadcn@latest add button card table dialog sheet input label` 등으로 생성되면 `components/ui/` 아래에 추가됩니다.

---

## 6. 요약: 추가 필요사항만 정리

- **ARCHITECTURE 보완**: API Route는 `.../route.ts` 한 파일에 GET/POST 구분; Provider(Query + Theme) 및 path alias(`@/`) 명시.
- **설정**: Node 버전(.nvmrc 또는 engines), Tailwind 수익/손실 색상 확장.
- **데이터**: ticker-mapping 초기 데이터(빈 객체 또는 샘플).
- **일괄 생성 순서**: Git/문서 유지 → create-next-app → shadcn init → 패키지 설치 → 타입/lib/API/Provider → 페이지·컴포넌트·훅 → 테마.
- **실행 가능 최소 집합**: 위 §5 파일 목록 생성 시, 앱이 빌드되고 대시보드·API가 스텁 수준으로 동작하도록 구성.

이 체크리스트를 따라 일괄 생성하면 PRD·ARCHITECTURE 기준으로 빠진 항목 없이 앱을 올릴 수 있습니다.
