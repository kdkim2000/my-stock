# 🎓 Antigravity: 학습용 대화 및 리팩토링 로그

이 문서는 `my-stock` 프로젝트의 개선 과정에서 AI(Antigravity)와 사용자 간의 상호작용, 그리고 AI의 내부 추론 과정을 학습 목적으로 정리한 것입니다.

---

## 📅 세션 개요
- **일시**: 2026-03-11
- **주제**: 프로젝트 리팩토링 평가 및 Vercel 배포 용량 최적화
- **핵심 목표**: 
  1. 기존 리팩토링 성과 측정 및 체계적 문서화
  2. Vercel 서버리스 함수 250MB 제한 문제 해결

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

## 💡 AI의 접근 방식 (Agentic Approach Tips)

1. **Top-down Analysis**: 전체 `node_modules` 용량(608MB)을 먼저 파악한 후, 큰 것부터 하나씩(Lucide → OpenAI → Recharts) 좁혀가며 분석함.
2. **Log-driven Debugging**: 추측에 의존하지 않고 Vercel의 상세 빌드 로그(Large Dependencies 리스트)를 통해 **진짜 원인(Webpack Cache)**을 찾아냄.
3. **Context-aware Exclusions**: 무조건 빼는 것이 아니라, `recharts`는 클라이언트에서 필요하므로 `/api/**` 경로 번들링 시에만 빼는 정밀한(Fine-grained) 제어를 선택함.
4. **Safety First**: 변경 사항 적용 전 사용자 승인을 얻고, 적용 후에는 `npm run build`와 `test`를 강제 실행하여 배포 안정성을 확보함.

---

## 📝 주요 학습 포인트

- **모듈화의 가치**: 거대 파일(God Component)을 쪼개면 용량 분석과 최적화가 훨씬 쉬워집니다.
- **진짜 범인은 따로 있었다**: 서버리스 용량 문제는 `node_modules`뿐만 아니라 `.next/cache`와 같은 빌드 산출물에 의해서도 발생할 수 있습니다.
- **Bundling Optimization**: Next.js의 `outputFileTracingExcludes`는 서버리스 함수의 Cold Start 속도와 배포 성공률을 제어하는 강력한 도구입니다.
- **Test-Driven Refactoring**: 리팩토링 전후에 동일한 테스트를 성공시킴으로써 코드 구조는 바뀌어도 기능은 동일함을 증명했습니다.
