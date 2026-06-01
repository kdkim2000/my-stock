# AI 분석 Google 로그인 요구 및 미동작 버그 수정 계획

**작성일**: 2026-06-02  
**대상**: `/dashboard/ticker/[id]` AI 분석 섹션  
**브랜치**: 01_claude

---

## Context

종목 상세 페이지에서 "AI 분석 요청" 버튼 클릭 시 두 가지 문제가 발생한다:
1. 이미 로그인된 상태임에도 Google 로그인 페이지로 리다이렉트됨
2. 실제 AI 분석이 수행되지 않음

코드 분석 결과 세 가지 독립적인 버그가 확인되었다.

---

## 근본 원인 분석

### 버그 1: `apiFetch` 401 응답 시 즉시 전체 페이지 리다이렉트 (최우선)

**파일**: `lib/api-client.ts:13-16`

```typescript
if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/auth/signin?callbackUrl=${callbackUrl}`;  // ← 전체 페이지 강제 이동
    return res;
}
```

AI 분석 요청(`POST /api/ai/trading-guide`)이 401을 받으면 전체 페이지가 `/auth/signin`으로 이동된다. 사용자는 Google 로그인 버튼이 있는 로그인 페이지를 보게 되어 "구글로그인을 요구한다"고 느낀다.

페이지 로드 시 세션이 유효했더라도, 세션 쿠키 전달 문제(SameSite, 만료 등) 또는 `AUTH_SECRET` 불일치로 AI POST 요청이 401을 받을 수 있다. 이때 다른 섹션의 GET 요청들은 이미 완료되어 데이터를 표시하고 있어도 전체 페이지가 사라진다.

**원인**: GET 요청과 POST 요청이 같은 세션 쿠키를 사용하지만, 브라우저의 `SameSite=Lax` 정책 또는 NextAuth 세션 토큰 갱신 타이밍 차이로 POST 요청만 401이 반환될 수 있다.

---

### 버그 2: `OPENAI_API_KEY` 검사가 `cacheOnly` 처리보다 먼저 실행됨

**파일**: `app/api/ai/trading-guide/route.ts:59-65`

```typescript
export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 503 });
    // ↑ cacheOnly: true 요청도 여기서 막힘 — 캐시 조회조차 안 됨
  }
  ...
  if (body.cacheOnly === true) {  // ← 이 코드에 도달 못 함
    return NextResponse.json({ content: null, cachedAt: null });
  }
```

페이지 로드 시 `useAiGuidance`가 자동으로 `cacheOnly: true` 요청을 보낸다. 이 요청은 OpenAI를 호출하지 않고 캐시만 조회하면 되지만, `OPENAI_API_KEY` 미설정 시 503이 반환된다. 결과:
- `aiError = "OPENAI_API_KEY is not configured"`
- AI 섹션에 에러 상태 표시
- 버튼 비활성화 (aiLoading 처리가 꼬일 수 있음)

---

### 버그 3: `requestAiGuide` 가드가 캐시된 콘텐츠가 있을 때 분석을 막음

**파일**: `hooks/useAiGuidance.ts:64-68`

```typescript
const requestAiGuide = useCallback(() => {
    if (!code || aiGuideQuery.data?.content) return;  // ← 콘텐츠가 있으면 즉시 반환
    aiForceRef.current = true;
    void aiGuideQuery.refetch();
}, [code, aiGuideQuery.data?.content, aiGuideQuery.refetch]);
```

초기 `cacheOnly: true` 요청으로 Google Sheets 캐시에서 AI 분석 결과를 가져왔을 경우, `aiGuideQuery.data.content`가 채워진다. 이 상태에서 "AI 분석 요청" 버튼을 클릭하면 가드 조건이 `true`가 되어 **아무 일도 일어나지 않는다** — 재분석 요청이 전혀 전송되지 않음.

`requestAiGuideRefresh`(다시 분석)는 이 가드가 없어 정상 동작하지만, "AI 분석 요청" 버튼은 콘텐츠가 없을 때만 동작한다는 것이 명확하지 않아 사용자가 혼란을 겪는다.

---

## 수정 계획

### 수정 1: `apiFetch` — 401 시 즉시 리다이렉트 제거, 에러 throw로 변경

**파일**: `lib/api-client.ts`

```typescript
// 변경 전: 전체 페이지 리다이렉트
if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = `/auth/signin?callbackUrl=${callbackUrl}`;
    return res;
}

// 변경 후: 에러를 throw하여 React Query가 잡도록 함
if (res.status === 401) {
    const err = new Error("세션이 만료되었습니다. 페이지를 새로고침하거나 다시 로그인해 주세요.");
    (err as Error & { isAuthError: boolean }).isAuthError = true;
    throw err;
}
```

- 배경 API 호출에서 401이 발생해도 전체 페이지가 이동되지 않음
- React Query가 에러를 잡아 컴포넌트에서 처리 가능
- 사용자는 현재 페이지 컨텍스트를 잃지 않음

### 수정 2: `trading-guide/route.ts` — `cacheOnly` 요청 시 OpenAI 키 불필요

**파일**: `app/api/ai/trading-guide/route.ts`

`OPENAI_API_KEY` 검사를 `cacheOnly: true` 처리 **이후**로 이동:

```typescript
export async function POST(request: Request) {
  // body 파싱 및 code 검증 먼저
  ...
  
  // cacheOnly: true 요청은 OpenAI 불필요 — 캐시만 확인
  if (!forceRefresh) {
    const cached = await readAiCache(code);
    if (cached?.content) return NextResponse.json({ content: cached.content, cachedAt: cached.updatedAt });
    if (body.cacheOnly === true) return NextResponse.json({ content: null, cachedAt: null });
  }

  // 실제 OpenAI 호출 시에만 API 키 확인
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 503 });
  }
  ...
}
```

### 수정 3: `useAiGuidance.ts` — `requestAiGuide` 가드 제거

**파일**: `hooks/useAiGuidance.ts`

콘텐츠 존재 여부와 무관하게 "AI 분석 요청" 버튼이 항상 동작하도록 가드 제거:

```typescript
// 변경 전
const requestAiGuide = useCallback(() => {
    if (!code || aiGuideQuery.data?.content) return;  // 콘텐츠 있으면 막음
    aiForceRef.current = true;
    void aiGuideQuery.refetch();
}, [code, aiGuideQuery.data?.content, aiGuideQuery.refetch]);

// 변경 후
const requestAiGuide = useCallback(() => {
    if (!code) return;
    aiForceRef.current = true;
    void aiGuideQuery.refetch();
}, [code, aiGuideQuery.refetch]);
```

### 수정 4: `ai-guide-section.tsx` — 인증 오류 전용 에러 UI 추가

**파일**: `components/dashboard/ticker-detail/sections/ai-guide-section.tsx`

`isAuthError` 플래그를 감지해 "세션 만료" 안내 및 재로그인 링크 제공:

```typescript
// aiError가 인증 오류인 경우 별도 UI 표시
{aiAuthError && (
  <div className="...">
    <p>세션이 만료되었습니다.</p>
    <a href="/auth/signin">다시 로그인</a>
  </div>
)}
```

`aiAuthError` prop을 `useAiGuidance`에서 반환:
```typescript
// useAiGuidance.ts 반환값에 추가
aiAuthError: (aiGuideQuery.error as Error & { isAuthError?: boolean })?.isAuthError ?? false,
```

---

## 수정 대상 파일 요약

| 파일 | 변경 내용 | 우선순위 |
|------|---------|---------|
| `lib/api-client.ts` | 401 시 `window.location.href` → `throw Error(isAuthError: true)` | CRITICAL |
| `app/api/ai/trading-guide/route.ts` | `OPENAI_API_KEY` 검사를 `cacheOnly` 이후로 이동 | HIGH |
| `hooks/useAiGuidance.ts` | `requestAiGuide` 가드 제거, `aiAuthError` 반환값 추가 | HIGH |
| `components/dashboard/ticker-detail/sections/ai-guide-section.tsx` | 인증 오류 UI 추가 (`aiAuthError` prop 처리) | MEDIUM |
| `components/dashboard/TickerDetailContent.tsx` | `aiAuthError` prop 전달 추가 | MEDIUM |

---

## 검증 전략

```bash
npx tsc --noEmit
npm run build
npm run test
```

**수동 확인 포인트**:
1. 종목 상세 페이지 로드 → AI 섹션에 에러 없음 (OPENAI_API_KEY 미설정 시에도 페이지 로드 정상)
2. "AI 분석 요청" 클릭 → 페이지 리다이렉트 없이 로딩 상태로 전환
3. OPENAI_API_KEY 미설정 환경에서 "AI 분석 요청" 클릭 → "OPENAI_API_KEY가 설정되지 않았습니다" 에러 메시지 표시
4. 세션 만료 시뮬레이션(쿠키 삭제) → "세션이 만료되었습니다" 메시지 + 재로그인 링크 표시 (전체 페이지 리다이렉트 없음)
5. 캐시된 AI 결과가 있는 상태에서 "AI 분석 요청" 클릭 → 재분석 시작됨 (이전: 아무 일도 없음)
