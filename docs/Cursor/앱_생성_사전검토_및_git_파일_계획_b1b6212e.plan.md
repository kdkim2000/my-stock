---
name: 앱 생성 사전검토 및 Git 파일 계획
overview: PRD/ARCHITECTURE 기반 주식 매매일지 앱 생성에 필요한 항목을 사전검토하고, Git으로 저장소를 안전하게 관리하기 위해 생성할 파일(.gitignore 등)과 내용을 정리한 계획입니다.
todos: []
isProject: false
---

# 앱 생성 사전검토 및 Git 파일 생성 계획

## 1. 애플리케이션 생성 사전검토

현재 프로젝트에는 [docs/PRD.md](docs/PRD.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)와 `.git`만 존재하며, **package.json·Next.js·소스 코드는 없습니다.** 아래 항목을 만족해야 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 구조대로 앱을 생성할 수 있습니다.

### 1.1. 환경 요구사항

- **Node.js**: 18.17+ (Next.js 14+ App Router 권장)
- **패키지 매니저**: npm / yarn / pnpm 중 하나 (선택 후 일관 사용)
- **Git**: 이미 초기화됨. 커밋 전에 `.gitignore` 등으로 불필요 파일 제외 필요

### 1.2. 앱 생성 시 필요한 작업 (참고용 체크리스트)


| 순서  | 항목               | 설명                                                                                                                      |
| --- | ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Git 무시/관리 파일     | `.gitignore`(및 선택 시 `.gitattributes`) 먼저 생성 후, 이후 생성되는 빌드/의존성 폴더가 커밋되지 않도록 함                                            |
| 2   | Next.js 프로젝트 초기화 | `create-next-app`(App Router, TypeScript, Tailwind, ESLint)으로 루트에 생성                                                    |
| 3   | shadcn/ui 설정     | `npx shadcn@latest init` 및 필요한 컴포넌트 추가 (Button, Card, Modal, Table 등)                                                   |
| 4   | 추가 의존성 설치        | Recharts, TanStack Query, Google APIs(client), dotenv 등 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §1 기술 스택 반영        |
| 5   | 환경 변수 템플릿        | `.env.example` 생성 (Google Sheets API 키, 스프레드시트 ID, KIS app key/secret 등). 실제 값은 `.env.local`에만 두고 Git 제외                |
| 6   | 폴더/파일 스캐폴딩       | ARCHITECTURE §4 기준 `app/`, `app/api/sheets/`, `app/api/kis/`, `lib/`, `components/`, `hooks/`, `types/` 디렉터리 및 진입 파일 생성 |


### 1.3. 외부 연동 사전 준비 (구현 전 확인)

- **Google Sheets**: Google Cloud 프로젝트, Sheets API 활성화, 서비스 계정 또는 API 키 확보, 대상 스프레드시트 ID
- **KIS Open API**: 한국투자증권 개발자 포털에서 app key/secret 발급, 토큰 발급 URL 및 현재가 API 스펙 확인

---

## 2. Git으로 파일 관리를 위해 생성할 파일

저장소가 이미 있으므로, **커밋 전에** 아래 파일을 생성하면 빌드 산출물·의존성·비밀 파일이 Git에 올라가는 것을 방지할 수 있습니다.

### 2.1. `.gitignore` (필수)

**위치**: 프로젝트 루트 `e:\apps\my-stock\.gitignore`

**포함할 항목 요약**:

- **의존성**: `node_modules/`
- **Next.js**: `.next/`, `out/`, `build/`
- **환경/비밀**: `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local`
- **로그/캐시**: `*.log`, `npm-debug.log`*, `.turbo`, `.vercel`
- **IDE/에디터**: `.vscode/`(선택), `.idea/`
- **OS**: `.DS_Store`, `Thumbs.db`
- **기타**: `*.tsbuildinfo`, `next-env.d.ts`(Next 생성 시 자동 생성되므로 무시해도 됨)

**참고**: [Next.js 공식 .gitignore](https://github.com/vercel/next.js/blob/canary/examples/with-typescript/.gitignore) 또는 `create-next-app` 시 생성되는 내용과 동일한 수준으로 구성하면 됨.

### 2.2. `.env.example` (권장)

**위치**: 프로젝트 루트 `e:\apps\my-stock\.env.example`

**목적**: 팀원/본인이 어떤 환경 변수가 필요한지 알 수 있도록 템플릿만 커밋. **실제 값은 넣지 않음.**

**예시 변수명 (키만)**:

- `GOOGLE_SHEETS_API_KEY` 또는 `GOOGLE_APPLICATION_CREDENTIALS` (서비스 계정 경로인 경우)
- `GOOGLE_SPREADSHEET_ID`
- `KIS_APP_KEY`, `KIS_APP_SECRET`, `KIS_URL` (필요 시)

`.env.example`은 **커밋 대상**, `.env`, `.env.local` 등은 **.gitignore에 반드시 포함**.

### 2.3. `.gitattributes` (선택)

**위치**: 프로젝트 루트 `e:\apps\my-stock\.gitattributes`

**목적**: line ending 일관성(예: `* text=auto`), diff 시 이진 파일 제외 등. Windows/다중 OS 환경이면 있으면 유리.

**예시**:

- `* text=auto`
- `*.png binary`
- `*.md text`

### 2.4. `README.md` (선택)

**위치**: 프로젝트 루트 `e:\apps\my-stock\README.md`

**목적**: 프로젝트 한 줄 소개, 로컬 실행 방법(`npm install`, `npm run dev`), 환경 변수는 `.env.example` 참고 안내, [docs/PRD.md](docs/PRD.md)·[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 링크. 앱 코드를 생성한 뒤 채워도 됨.

---

## 3. 작업 순서 제안

1. `**.gitignore` 생성** — 다른 작업 전에 수행하여 `node_modules/`, `.next/`, `.env`* 등이 실수로 커밋되지 않도록 함.
2. `**.env.example` 생성** — 앱 구현 시 참고할 환경 변수 목록을 문서화.
3. **(선택) `.gitattributes` 생성** — line ending/이진 파일 정책 적용.
4. **(선택) `README.md` 생성** — 최소 안내만 넣거나, Next.js 앱 스캐폴딩 후 보강.

이후 별도 작업으로 `create-next-app` 및 ARCHITECTURE 기준 폴더/파일 생성 진행 시, 위 Git 관련 파일이 이미 있으므로 첫 커밋부터 깔끔하게 관리할 수 있습니다.

---

## 4. 결과물 요약


| 파일                               | 필수 여부 | 설명                                           |
| -------------------------------- | ----- | -------------------------------------------- |
| [.gitignore](.gitignore)         | 필수    | node_modules, .next, .env*, 로그, IDE, OS 등 제외 |
| [.env.example](.env.example)     | 권장    | 필요한 환경 변수 이름만 나열, 값 없음                       |
| [.gitattributes](.gitattributes) | 선택    | line ending, binary 처리                       |
| [README.md](README.md)           | 선택    | 프로젝트 소개 및 실행 방법                              |


사전검토와 Git 파일 생성 계획을 위와 같이 정리했습니다. 이 계획을 승인하시면 먼저 `.gitignore`와 `.env.example` 생성부터 진행할 수 있습니다.