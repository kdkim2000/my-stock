---
name: OAuth2 인증으로 접근 제한
overview: NextAuth.js + Google OAuth2로 로그인을 도입하고, 허용 이메일(본인만)으로 제한하여 대시보드·상세·API 전역을 인증된 사용자만 접근하도록 합니다.
todos: []
isProject: false
---

# OAuth2 인증으로 투자 목록 접근 제한

## 목표

- 아무나 접속 불가. **OAuth2로 인증된 사용자(본인만)** 접속 가능.
- 허용 이메일 목록에 있는 계정만 로그인 후 이용 가능.

## 현재 구조

- **라우트**: `/` → 리다이렉트 `/dashboard`, [app/dashboard/page.tsx](app/dashboard/page.tsx), [app/dashboard/ticker/[id]/page.tsx](app/dashboard/ticker/[id]/page.tsx).
- **API**: [app/api/](app/api/) 하위 13개 라우트(시트·KIS·DART·분석·fundamental 등). 인증 없음.
- **미들웨어**: 없음.
- **인증 라이브러리**: 없음.

---

## 1. 기술 선택

- **NextAuth.js v4**: Next.js 14 App Router 지원, Google Provider, 세션 쿠키, 미들웨어 연동.
- **Google OAuth2**: 이미 Google(Sheets) 사용 중이라 동일 계정으로 로그인 가능. GitHub 등 다른 provider 추가도 가능.

---

## 2. 보호 범위


| 대상                                | 동작                                  |
| --------------------------------- | ----------------------------------- |
| `/`, `/dashboard`, `/dashboard/*` | 비로그인 시 로그인 페이지로 리다이렉트. 로그인 후 접근 허용. |
| `/api/*` (단, `/api/auth/*` 제외)    | 비로그인 또는 허용 이메일 아님 → 401.            |
| `/api/auth/*`                     | NextAuth 전용. 미들웨어에서 제외.             |


---

## 3. 허용 사용자(본인만) 제한

- 환경 변수 `**ALLOWED_EMAIL`** (또는 `ALLOWED_EMAILS` 복수)에 허용할 이메일 지정.
- NextAuth **callbacks.signIn**에서 로그인 시도 시 `user.email`이 허용 목록에 없으면 `false` 반환 → 로그인 거부.
- 선택: **callbacks.jwt / session**에서 `email`을 세션에 넣어, API/미들웨어에서 동일 규칙으로 한 번 더 검사 가능.

---

## 4. 구현 항목

### 4.1 패키지 및 환경 변수

- **설치**: `next-auth@4` (Next 14 호환).
- **.env.example / 문서** 추가:
  - `AUTH_SECRET`: NextAuth 암호화용 비밀키 (필수).
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth 클라이언트 (Cloud Console에서 OAuth 2.0 클라이언트 ID 생성).
  - `ALLOWED_EMAIL`: 허용 이메일 1개 (본인). 복수일 경우 `ALLOWED_EMAILS=email1@x.com,email2@x.com` 형태로 파싱 가능.

### 4.2 NextAuth 설정

- **파일**: [app/api/auth/[...nextauth]/route.ts](app/api/auth/[...nextauth]/route.ts) (신규).
- **Options**:  
  - Provider: `GoogleProvider` with `clientId`, `clientSecret`.  
  - `callbacks.signIn`: `user.email`이 `process.env.ALLOWED_EMAIL`(또는 ALLOWED_EMAILS 목록)에 포함되는지 검사. 아니면 `return false`.  
  - `callbacks.jwt` / `callbacks.session`: 필요 시 `email` 포함.  
  - `pages.signIn`: `/auth/signin` 등 커스텀 로그인 경로 지정 가능(선택).
- **세션**: JWT 세션 사용(기본). `strategy: "jwt"`, `maxAge` 적절히 설정.

### 4.3 미들웨어

- **파일**: [middleware.ts](middleware.ts) (프로젝트 루트, 신규).
- **동작**:
  - `matcher`: `/dashboard/:path`*, `/api/:path*` (단, `/api/auth`로 시작하는 경로 제외).
  - 루트 `/`는 미들웨어에서 제외하고, 페이지에서 “미인증이면 로그인으로” 처리하거나, matcher에 `/` 포함해 세션 없으면 `/api/auth/signin`으로 리다이렉트.
- **로직**: `getToken()`으로 JWT 확인. 없거나 만료면:
  - 페이지 요청: `NextResponse.redirect(new URL("/api/auth/signin", request.url))`.
  - API 요청: `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`.
- NextAuth 미들웨어 wrapper 사용 시: `withAuth`로 보호 경로만 감싸고, 나머지 위와 동일.

### 4.4 루트 페이지 `/` 처리

- **현재**: [app/page.tsx](app/page.tsx)에서 무조건 `redirect("/dashboard")`.
- **변경**: 미들웨어에서 `/` 접근 시 비로그인이면 로그인 페이지로 보내므로, 페이지는 그대로 `redirect("/dashboard")` 유지해도 됨. 또는 서버에서 `getServerSession`으로 확인 후 비로그인이면 로그인 페이지로 리다이렉트 후 로그인 시에만 `/dashboard`로 보내도 됨(선택).

### 4.5 레이아웃·Provider

- [app/layout.tsx](app/layout.tsx): 기존 [components/providers](components/providers)에 **SessionProvider** 래핑 추가(NextAuth는 클라이언트에서 SessionProvider 필요).  
- 또는 [app/dashboard/layout.tsx](app/dashboard/layout.tsx)가 있다면 그 안에서만 SessionProvider를 써도 됨. 대시보드·상세만 클라이언트 세션을 쓰는 경우.

### 4.6 로그아웃 UI

- [components/AppNav.tsx](components/AppNav.tsx) 등 상단 네비에 **로그아웃** 버튼 추가. `signOut()` 호출.

### 4.7 API 라우트 개별 수정

- 미들웨어에서 이미 `/api/`*(auth 제외)에 대해 401을 반환하므로, **기존 API 라우트 코드는 수정하지 않아도 됨**.  
- 필요 시 특정 API에서만 `getServerSession()`으로 이메일 재검증 가능(이중 확인).

---

## 5. Google OAuth 클라이언트 설정 (사용자 작업)

1. Google Cloud Console → 프로젝트 선택 → API 및 서비스 → 사용자 인증 정보.
2. OAuth 2.0 클라이언트 ID 생성(웹 애플리케이션).
3. 승인된 리디렉션 URI: `https://<본인도메인>/api/auth/callback/google`, 로컬은 `http://localhost:3000/api/auth/callback/google`.
4. 클라이언트 ID·비밀을 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 설정.

---

## 6. Vercel 배포 시

- Environment Variables에 `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL` 설정.
- `AUTH_SECRET`는 `openssl rand -base64 32` 등으로 생성.

---

## 7. 구현 순서 제안

1. `next-auth` 설치, [app/api/auth/[...nextauth]/route.ts](app/api/auth/[...nextauth]/route.ts) 추가(Google Provider + ALLOWED_EMAIL 검사).
2. [middleware.ts](middleware.ts) 추가: `/dashboard`, `/api`(auth 제외) 보호, 비인증 시 리다이렉트/401.
3. [components/providers](components/providers)에 SessionProvider 래핑, [.env.example](.env.example)에 AUTH_SECRET, Google, ALLOWED_EMAIL 설명 추가.
4. AppNav에 로그아웃 버튼 추가.
5. (선택) 커스텀 로그인 페이지 [app/auth/signin/page.tsx](app/auth/signin/page.tsx) 추가.

---

## 8. 주의사항

- `ALLOWED_EMAIL`이 비어 있으면 로그인을 모두 거부하거나, 개발 시에만 특정 이메일 허용하도록 문서화.
- 쿠키는 HTTPS에서만 전송되도록 프로덕션에서 설정됨(NextAuth 기본).
- 기존 KIS/Google Sheets/DART API 키는 그대로 두고, **웹 접근만** OAuth2로 제한하는 구조.

