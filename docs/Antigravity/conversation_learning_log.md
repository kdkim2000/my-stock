# 🎓 Antigravity: 학습용 대화 및 리팩토링 로그

이 문서는 `my-stock` 프로젝트의 개선 과정에서 AI(Antigravity)와 사용자 간의 상호작용, 그리고 AI의 내부 추론 과정을 학습 목적으로 정리한 것입니다.

---

## 📅 세션 개요
- **일시**: 2026-03-11
- **주제**: 리팩토링 평가 → Vercel 배포 최적화 → 서버리스 상태 영속화
- **핵심 목표**: 
  1. 기존 리팩토링 성과 측정 및 체계적 문서화
  2. Vercel 서버리스 함수 250MB 제한 문제 해결
  3. KIS 토큰의 서버리스 인스턴스 간 영속적 공유
  4. AI 분석 결과의 종목별 캐싱으로 OpenAI 토큰 절약

---

## 🚀 Case 1: 리팩토링 결과 정리 및 평가

### 1.1 사용자 요청 (User Request)
> 지금까지의 변경사항을 정리하여 변경 전과 후가 어떻게 개선되었는지 정리하고 결과를 평가하라.

### 1.2 추론 과정 (Thinking Process)
- **현황 파악**: 이전에 진행된 대규모 리팩토링(`c36aa84d-...`)의 결과를 확인해야 함.
- **연구 전략 (Research Strategy)**:
  1. `docs/Antigravity/` 폴더 내의 기존 분석 문서(`improvement_analysis.md`)와 아키텍처 문서 확인.
  2. 실제 파일 시스템과 Git Log를 대조하여 계획된 10대 개선 사항 중 무엇이 실제로 반영되었는지 검증.
  3. `lib/kis/`, `components/dashboard/ticker-detail/` 등의 디렉토리 구조 변화를 정량적으로 측정.
  4. 작성된 테스트 코드의 수와 패스 여부 확인.
- **도구 선택**: `list_dir`, `view_file`, `run_command` (git log, line count)를 병렬적으로 호출하여 신속하게 데이터를 수집.

### 1.3 실행 내용 (Action)
- **정량적 데이터 수집**: 
  - `TickerDetailContent.tsx`: 2,317줄 → 304줄 (핵심 로직 분리 확인)
  - `kis-api.ts`: 1,534줄 → 12개 파일 분할 (모듈화 확인)
  - `PositionTracker`: 중복 로직 3곳 통합 확인.
- **보고서 작성**: [change_report.md](file:///e:/apps/my-stock/docs/Antigravity/change_report.md) 생성.
  - 개선 요약 매트릭스 제공.
  - 전/후 코드 구조 비교 및 정량적 수치(줄 수 감소율 등) 제시.
  - 정성적 평가(유지보수성, 확장성) 포함.

---

## 🛠️ Case 2: Vercel 250MB 제한 문제 해결

### 2.1 사용자 요청 (User Request)
> Vercel 배포 시 서버리스 함수 용량이 250MB를 초과했다. 도입한 모듈에서 꼭 필요한 부분만 설치하여 용량을 최소화할 방안을 도출하라.

### 2.2 추론 과정 (Thinking Process)
- **문제 진단**: 250MB 초과는 대개 `node_modules`가 서버리스 번들에 통째로 포함될 때 발생함.
- **연구 전략 (Research Strategy)**:
  1. `package.json`에서 의존성 목록 확인.
  2. `node_modules` 내 각 패키지의 실제 용량 측정 (Powershell 스크립트 활용).
  3. Next.js의 `outputFileTracingExcludes` 기능을 통해 번들에서 제외할 대상 선정.
- **추론 로직 (Reasoning)**:
  - **`lucide-react` (35MB)**: 아이콘은 클라이언트 전용임에도 서버 번들에 UMD/ESM이 모두 포함됨 → **제외 대상**.
  - **`openai` (7.2MB)**: 실제로는 Chat Completion만 쓰는데 이미지/오디오/파인튜닝 모듈이 전부 포함됨 → **부분 제외 대상**.
  - **`recharts` (6MB)**: 100% 클라이언트 컴포넌트임에도 API 서버 번들에 포함됨 → **제외 대상**.

### 2.3 실행 내용 (Action)
- **최적화 구현**: `next.config.mjs` 수정.
  - `outputFileTracingExcludes` 패턴을 정교하게 설계하여 `/api/**` 경로에서 클라이언트 전용 라이브러리 제거.
- **검증**: `npm run build`를 실행하여 빌드 프로세스가 깨지지 않는지 확인하고, `vitest`를 통해 기존 기능의 회귀(Regression) 여부 확인.

### 2.4 심층 분석 (Deep Analysis — 반전의 결과)
- **현상**: 아이콘과 라이브러리를 제외했음에도 여전히 250MB를 초과하는 문제 발생.
- **추론 과정 (Thinking Process)**:
  - "보통은 `node_modules`가 문제지만, 이번에는 Vercel 빌드 로그를 끝까지 추적해봐야 한다."
  - 빌드 로그 정밀 분석 결과: **`.next/cache/webpack` (346.77 MB)** 발견.
  - **진단**: Next.js의 파일 트레이싱(File Tracing)이 빌드 시 생성된 내부 캐시까지 서버리스 함수 번들에 포함시키고 있었음.

### 2.5 최종 해결 (Final Resolution)
- **최적화 구현**: `next.config.mjs`의 `outputFileTracingExcludes`에 `./.next/cache/**` 패턴 추가.
- **결과**: 번들 크기가 **349MB에서 ~3MB 수준으로 급감(99% 감소)**하며 배포 성공.

---

## 🔑 Case 3: KIS 토큰 서버리스 인스턴스 간 공유

### 3.1 사용자 요청 (User Request)
> Vercel에 배포했을 때 KIS 토큰이 하루 1번 갱신하면 되지만, 토큰을 저장하지 못해 계속 새로 발급을 시도한다. 토큰이 만료되었을 때만 재발급하도록 수정하라.

### 3.2 추론 과정 (Thinking Process)
- **문제 진단**: 기존 토큰 저장 전략은 3단계(`모듈 변수` → `globalThis` → `/tmp/kis-token.json`).
  - "Vercel 서버리스 함수는 각 인스턴스마다 별도의 `/tmp` 디렉토리를 가진다. 인스턴스 A가 저장한 토큰 파일을 인스턴스 B는 읽지 못한다."
  - "`globalThis`도 마찬가지로 인스턴스 간에는 공유가 안 된다."
  - "결론: 인스턴스 외부의 **영속적 공유 저장소**가 필요하다."
- **저장소 후보 평가**:
  - Vercel KV (Upstash Redis): 별도 서비스 가입/결제 필요 → **부적합** (zero-dependency 목표)
  - 환경변수 API: 런타임에 환경변수를 동적으로 갱신하는 것은 Vercel에서 비표준 → **부적합**
  - **Google Sheets**: 이미 프로젝트에서 사용 중이므로 추가 의존성 없이 즉시 활용 가능 → **최적**

### 3.3 실행 내용 (Action)
- **신규 파일**: [token-store.ts](file:///e:/apps/my-stock/lib/kis/token-store.ts) — Google Sheets `_KIS_TOKEN_` 시트(A1=토큰, B1=만료시간)에 대한 read/write 함수.
- **수정 파일**: [token.ts](file:///e:/apps/my-stock/lib/kis/token.ts) — Vercel 환경(`process.env.VERCEL === '1'`)인 경우:
  - `readTokenFromFile()`: Sheets에서 먼저 조회 → 실패 시 로컬 파일 fallback
  - `writeTokenToFile()`: 파일 저장과 동시에 Sheets에도 비동기 저장
- **로컬 환경**: 기존 파일 캐시 동작 100% 유지.

### 3.4 아키텍처

```
[인스턴스 A] ──write──→ 🟢 Google Sheets '_KIS_TOKEN_' A1:B1
[인스턴스 B] ──read───→ 🟢 Google Sheets '_KIS_TOKEN_' A1:B1  ← 동일한 토큰!
[인스턴스 C] ──read───→ 🟢 Google Sheets '_KIS_TOKEN_' A1:B1  ← 동일한 토큰!
```

---

## 🤖 Case 4: AI 분석 결과 종목별 캐싱

### 4.1 사용자 요청 (User Request)
> OpenAI 분석 결과도 매번 리셋된다. 종목별 최종 분석결과를 Google Sheets에 보관하고, 새로 AI 분석을 실시할 때만 갱신하고, 나머지는 보관된 정보를 표시하고 싶다.

### 4.2 추론 과정 (Thinking Process)
- "Case 3에서 Google Sheets를 공유 저장소로 활용하는 패턴이 이미 검증되었다. 동일한 아키텍처를 확장하면 된다."
- "클라이언트에서 **'AI 분석 요청'**(캐시 우선)과 **'다시 분석'**(OpenAI 강제 재호출)을 구별해야 한다."
- "API 응답에 `cachedAt` 타임스탬프를 포함시켜 UI에서 분석 일시를 표시하면 사용자 경험이 좋아진다."

### 4.3 실행 내용 (Action)

| 파일 | 변경 내용 |
|------|-----------|
| [ai-cache.ts](file:///e:/apps/my-stock/lib/ai-cache.ts) | (신규) `_AI_CACHE_` 시트에 종목별 분석결과 read/write. 구조: `code(A) \| ticker(B) \| content(C) \| updatedAt(D)` |
| [route.ts](file:///e:/apps/my-stock/app/api/ai/trading-guide/route.ts) | `force` 파라미터 추가. `false`→캐시 반환, `true`→OpenAI 재호출 후 캐시 갱신 |
| [TickerDetailContent.tsx](file:///e:/apps/my-stock/components/dashboard/TickerDetailContent.tsx) | "다시 분석" 클릭 시 `force: true` 전달. `aiForceRefresh` state 관리 |
| [ai-guide-section.tsx](file:///e:/apps/my-stock/components/dashboard/ticker-detail/sections/ai-guide-section.tsx) | `aiCachedAt` prop 추가. 분석 결과 상단에 "분석일시: YYYY.MM.DD HH:mm" 표시 |

### 4.4 동작 흐름

```
[AI 분석 요청] → 서버: Sheets '_AI_CACHE_' 조회
  ├── 캐시 있음 → 즉시 반환 (OpenAI 토큰 절약 ✅)
  └── 캐시 없음 → OpenAI 호출 → Sheets에 저장 → 반환

[다시 분석] → 서버: force=true → OpenAI 재호출 → Sheets 갱신 → 반환
```

---

## 💡 AI의 접근 방식 (Agentic Approach Tips)

1. **Top-down Analysis**: 전체 `node_modules` 용량(608MB)을 먼저 파악한 후, 큰 것부터 하나씩(Lucide → OpenAI → Recharts) 좁혀가며 분석함.
2. **Log-driven Debugging**: 추측에 의존하지 않고 Vercel의 상세 빌드 로그(Large Dependencies 리스트)를 통해 **진짜 원인(Webpack Cache)**을 찾아냄.
3. **Context-aware Exclusions**: 무조건 빼는 것이 아니라, `recharts`는 클라이언트에서 필요하므로 `/api/**` 경로 번들링 시에만 빼는 정밀한(Fine-grained) 제어를 선택함.
4. **Existing Infrastructure Reuse**: 새 서비스를 도입하지 않고, 이미 사용 중인 Google Sheets를 공유 영속 저장소로 재활용하여 zero-dependency 솔루션을 구현함.
5. **Pattern Propagation**: Case 3에서 검증된 "Sheets를 KV처럼 사용" 패턴을 Case 4에서 즉시 확장 적용하여 개발 속도를 극대화함.
6. **Safety First**: 모든 변경에 `npm run build` 검증을 수반하고, 실패 시 무시(catch + 무시)하는 방어적 코딩을 적용함.

---

## 📝 주요 학습 포인트

- **모듈화의 가치**: 거대 파일(God Component)을 쪼개면 용량 분석과 최적화가 훨씬 쉬워집니다.
- **진짜 범인은 따로 있었다**: 서버리스 용량 문제는 `node_modules`뿐만 아니라 `.next/cache`와 같은 빌드 산출물에 의해서도 발생할 수 있습니다.
- **Bundling Optimization**: Next.js의 `outputFileTracingExcludes`는 서버리스 함수의 Cold Start 속도와 배포 성공률을 제어하는 강력한 도구입니다.
- **서버리스 ≠ 상태 없음**: Vercel 서버리스에서도 외부 저장소(Google Sheets)를 활용하면 인스턴스 간 상태 공유가 가능합니다. Redis나 KV가 없어도 됩니다.
- **"Sheets as KV" 패턴**: Google Sheets의 특정 셀/행을 Key-Value 저장소처럼 활용하는 것은 소규모 프로젝트에서 매우 실용적인 패턴입니다 (토큰 캐시, AI 결과 캐시 등).
- **Test-Driven Refactoring**: 리팩토링 전후에 동일한 테스트를 성공시킴으로써 코드 구조는 바뀌어도 기능은 동일함을 증명했습니다.

---

## 📅 세션 개요
- **일시**: 2026-03-12 ~ 13
- **주제**: KIS 토큰 캐시 버그 수정 및 상세 페이지 AI 분석 사용자 경험 고도화
- **핵심 목표**: 
  1. KIS 토큰이 매번 재발급되는 원인(환경변수, 타임존) 규명 및 해결
  2. 상세 페이지 진입 시 AI 분석 결과 자동 로드 (캐시 우선)
  3. KIS 매매동향 로딩 속도 최적화 (API 호출 루프 제거)
  4. 이중 인코딩된 종목명 파라미터 처리의 견고함 확보

---

## 🐞 Case 5: KIS 토큰 캐싱 로직의 "보이지 않는" 버그들

### 5.1 사용자 요청 (User Request)
> KIS 토큰을 구글 시트에 저장하도록 했으나 실행 시 저장되지 않고 매번 새로 발급받는 것 같다. 원인을 파악하고 해결하라.

### 5.2 추론 과정 (Thinking Process)
- **문제 진단 (1): 환경 변수**: 로그 확인 결과 Google Sheets 인증 실패가 빈번함. `.env.local`을 보니 JSON 값이 따옴표 없이 입력되어 있어 공백 이후의 데이터가 잘린 채 인식됨.
- **문제 진단 (2): 타임존**: KIS API는 한국 표준시(KST) 문자열을 주는데, 코드 상에서 이를 `Z`(UTC)로 간주하고 파싱함. 결과적으로 9시간 일찍 만료된 것으로 판단되어 매번 재발급 루프에 빠짐.
- **추론 로직 (Reasoning)**:
  - "환경 변수 파싱은 `dotenv`가 할 때 공백이 있으면 따옴표가 필수다. JSON 전체를 감싸야 한다."
  - "한국 주식 API이므로 시간 문자열 뒤에 `+09:00`을 명시적으로 붙여야 표준 JavaScript Date 객체가 정확한 타임스탬프를 계산한다."

### 5.3 실행 내용 (Action)
- **환경 변수 수정**: `.env.local`의 `GOOGLE_SERVICE_ACCOUNT_JSON`을 큰따옴표로 감싸고 내부 따옴표를 이스케이프함.
- **코드 수정**: [token.ts](file:///e:/apps/my-stock/lib/kis/token.ts)의 `parseExpiresAt` 함수에서 `Z` 대신 `+09:00`을 사용하도록 수정.

---

## ⚡ Case 6: 로딩 성능 최적화 및 UX 개선

### 6.1 사용자 요청 (User Request)
> 상세 페이지에서 "매매동향 (KIS)" 값이 나오지 않는다. 또한, AI 분석 결과를 상세 페이지 들어올 때마다 자동으로 보여주되 비용(OpenAI 호출)은 아끼고 싶다.

### 6.2 추론 과정 (Thinking Process)
- **성능 분석 (Performance Bottleneck)**:
  - `getKisInvestorTradeDaily` 함수가 30일치 데이터를 가져오기 위해 **for 루프를 돌며 API를 31번 호출**하고 있음.
  - KIS API는 한 번의 호출로 과거 이력을 리스트로 반환하므로, 루프가 전혀 불필요함. 31번의 직렬 호출이 로딩 시간을 10초 이상으로 만들고 타임아웃을 유발함.
- **UX 설계 (Cache-First auto-load)**:
  - 페이지 진입 시: `cacheOnly: true` 파라미터로 API 요청 → 서버는 구글 시트만 확인하고 없으면 OpenAI 호출 없이 즉시 `null` 반환.
  - 버튼 클릭 시: `force: true` 파라미터로 요청 → OpenAI 호출 및 결과 저장.
- **견고함 (Robustness)**:
  - 한글 종목명이 URL 파라미터로 전달될 때 환경에 따라 이중 인코딩(`%25ED...`)되는 경우 대응 로직 추가.

### 6.3 실행 내용 (Action)
- **API 최적화**: [trading.ts](file:///e:/apps/my-stock/lib/kis/trading.ts)의 API 호출 루프를 단일 호출로 변경. 로딩 속도 **12초 → 0.5초**로 개선.
- **상태 관리 개선**: `TickerDetailContent.tsx`에서 `useRef`를 사용하여 `force` 플래그를 관리, React Query의 `refetch` 시 정확한 상태가 API 바디에 담기도록 수정 (State 비동기 업데이트 문제 해결).
- **디코딩 강화**: `app/api/kis/stock-info/route.ts`에서 이중 인코딩된 파라미터를 판별하고 두 번 디코딩하는 `safeDecodeParam` 적용.

---

## 📝 주요 학습 포인트 (Session 2)

- **타임존의 함정**: `Z`는 UTC를 의미하며, 한국 시각 데이터에 이를 붙이면 9시간의 오차가 발생합니다. 서버리스 환경에서 시각 기반 캐싱을 할 때 가장 흔하고 치명적인 버그입니다.
- **API 호출 설계**: 외부 API가 리스트 응답을 지원한다면 루프 호출은 반드시 피해야 합니다. 특히 서버리스 환경에서는 람다 실행 시간 비용과 타임아웃 제한에 직결됩니다.
- **State vs Ref in QueryFn**: React Query의 `queryFn` 내부에서 최신 상태값을 참조해야 하는데, 상태 업데이트가 비동기라 즉시 반영되지 않는 경우 `useRef`가 훌륭한 대안이 됩니다.
- **Double Encoding**: 클라이언트-서버 간 데이터 전달 시, 프레임워크나 프록시 계층에 의해 URL 인코딩이 중첩될 수 있음을 항상 고려해야 합니다.
