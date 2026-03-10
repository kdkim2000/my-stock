# 📚 Antigravity: 프로젝트 전체 히스토리 및 학습 로그 (Cumulative)

이 문서는 `my-stock` 프로젝트에 Antigravity가 도입된 이후의 모든 주요 대화와 작업 내역을 학습 목적으로 소급하여 정리한 것입니다. 프로젝트의 탄생(초기 분석)부터 성숙(리팩토링 및 최적화)까지의 과정을 AI의 시각에서 기술합니다.

---

## 🕒 프로젝트 타임라인 개요

| 세션 ID | 시기 | 핵심 작업 | 주요 성과 |
|---------|------|-----------|-----------|
| `0efcf1f6` | 초기 | **프로젝트 심층 분석** | 10대 개선 영역 도출, 아키텍처 문서화 |
| `c36aa84d` | 중기 | **대규모 리팩토링 수행** | 모듈 분리, 중복 제거, 테스트 도입 시작 |
| `f503a045` | 최근 | **최종 평가 및 최적화** | 리팩토링 결과 보고, Vercel 250MB 제한 해결 |

---

## 🟢 Session 1: 기초 다지기 (`0efcf1f6`)

### 1.1 주요 환경 및 분석
- **현행 시스템**: Google Sheets 기반의 매매 내역 관리 앱. 단일 거대 파일(`TickerDetailContent.tsx`, `kis-api.ts`) 중심의 구조.
- **AI의 추론 (Thinking)**:
  - "이 프로젝트는 기능적으로는 훌륭하나, 파일 하나가 2,300줄에 달해 유지보수가 불가능한 상태다."
  - "관심사 분리(Separation of Concerns)를 위해 UI 섹션과 API 모듈을 잘게 쪼개는 로드맵이 필요하다."

### 1.2 주요 결과물
- **[improvement_analysis.md]**: 10가지 개선 영역(God Component 분리, 로직 중복 제거 등)과 우선순위 도출.
- **[project_architecture.md]**: Next.js App Router 기반의 전체 시스템 구조도 및 데이터 흐름 정의.

---

## 🔵 Session 2: 실행과 변환 (`c36aa84d`)

### 2.1 주요 작업 내용
- **핵심 모듈 분리**: `lib/kis-api.ts` (1,534줄)를 기능별로 12개 서브모듈로 분산.
- **UI 리팩토링**: `TickerDetailContent.tsx` (2,317줄)를 14개 섹션 컴포넌트로 분리하여 가독성 확보.
- **비즈니스 로직 고도화**: `PositionTracker` 클래스를 도입하여 매수원가 계산 방식을 전역적으로 통일.

### 2.2 AI의 추론 (Thinking)
- "단순히 파일을 쪼개는 것이 아니라, 기존 API 호출 부위가 깨지지 않도록 `export *`를 활용한 하위 호환성(Backward Compatibility)을 유지해야 한다."
- "복잡한 금융 계산은 실수가 잦으므로, 리팩토링과 동시에 단위 테스트 환경을 구축해야 한다."

---

## 🔴 Session 3: 최적화 및 평가 (현재 - `f503a045`)

### 3.1 주요 성과 측정
- **정량적 수치**: 최대 파일 크기 87% 감소, 중복 로직 100% 제거.
- **테스트 안착**: Vitest 기반의 핵심 비즈니스 로직 10개 테스트 케이스 100% 통과.

### 3.2 Vercel 배포 최적화
- **문제**: 250MB 제한으로 인한 배포 실패.
- **AI의 추론 (Thinking)**:
  - "Next.js의 파일 트래킹이 클라이언트 전용 라이브러리(Lucide, Recharts)를 서버 번들까지 끌고 들어가는 것이 원인이다."
  - "`outputFileTracingExcludes`를 활용해 서버리스 함수에서 불필요한 50MB 이상의 자산을 거부(Pruning)해야 한다."
- **결과**: `next.config.mjs` 수정 후 빌드 성공 및 배포 용량 안정화.

---

## 🧠 Antigravity의 전문적 접근 방식 (Summary)

1. **Systemic Analysis**: 단기적인 기능 추가보다 시스템 전체의 **유지보수성**과 **운영 안정성**을 우선순위에 둠.
2. **Step-by-Step Roadmap**: 긴급도(🔴)와 난이도를 고려하여 Phase 1(기반) -> Phase 2(구조) -> Phase 3(UI) 순으로 작업을 제안.
3. **Safety First**: 모든 리팩토링에는 반드시 **검증 계획(Verification Plan)**을 수반하며, 가능한 경우 테스트 코드로 이를 증명함.
4. **Knowledge Persistence**: 각 세션의 결과물을 문서화하여, 다음 세션의 AI가 이전 맥락을 완벽히 파악할 수 있게 함.

---

본 문서는 `docs/Antigravity/full_project_history_log.md`로 저장되어 프로젝트의 영구적인 자산으로 남습니다.
