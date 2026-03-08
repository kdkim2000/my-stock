---
name: PRD 문서 생성
overview: 사용자가 제시한 요구사항을 바탕으로 주식 매매일지 대시보드 앱의 Product Requirements Document(docs/PRD.md)를 생성하는 계획입니다.
todos: []
isProject: false
---

# 주식 매매일지 대시보드 앱 PRD 문서 생성 계획

## 목표

제공된 요구사항을 체계적으로 정리하여 **docs/PRD.md** 파일 하나로 작성한다. `docs` 폴더가 없으면 생성 후 PRD.md를 추가한다.

## 문서 구조 및 내용

다음 섹션으로 구성된 단일 마크다운 파일을 작성한다.


| 섹션                    | 내용 출처   | 비고                                                                             |
| --------------------- | ------- | ------------------------------------------------------------------------------ |
| 1. Project Overview   | 요구사항 1번 | 개인 투자자용 매매일지·포트폴리오 앱, 엑셀→구글시트→앱 동기화, KIS API 연동 요약                             |
| 2. Target Audience    | 요구사항 2번 | 매매 복기·수익률 관리, 엑셀/구글시트 선호 사용자                                                   |
| 3. Core Features      | 요구사항 3번 | 3.1 Google Sheets 동기화, 3.2 KIS 실시간 평가, 3.3 인사이트 대시보드, 3.4 매매 복기(저널)            |
| 4. Data Model         | 요구사항 4번 | Google Sheets 컬럼: Date, Ticker, Type, Quantity, Price, Fee, Tax, Journal, Tags |
| 5. UI/UX Requirements | 요구사항 5번 | 반응형(Mobile-first), shadcn/ui + Tailwind, 다크/라이트 모드                             |


추가로 PRD 관례에 맞춰 다음을 포함할 수 있다(선택).

- **Non-Functional Requirements**: 성능(동기화 지연 허용치), 보안(API 키·시트 접근), 가용성
- **Out of Scope / Assumptions**: v1에서 제외할 기능, 전제 조건(구글 계정, KIS 계좌 등)
- **Success Metrics**: 일지 입력 편의성, 대시보드 로딩 시간 등

## 작업 단계

1. **docs 폴더 생성**
  경로: `e:\apps\my-stock\docs`  
   (파일 작성 시 상위 경로가 없으면 폴더 생성이 필요한 경우 대비)
2. **docs/PRD.md 작성**
  - 제목: `Product Requirements Document (PRD): 주식 매매일지 대시보드 앱`  
  - 위 1~5번 섹션을 요구사항 원문을 해치지 않도록 마크다운으로 정리  
  - Core Features는 3.1~3.4 소제목과 설명, 리스트/표 활용  
  - Data Model은 테이블로 컬럼명·설명·예시 정리  
  - 코드/기술 용어는 인라인 코드 또는 볼드로 구분
3. **일관성 검토**
  - 사용자 규칙의 기술 스택(React, Zustand, Supabase 등)은 현재 프로젝트 규칙이며, 본 PRD는 “Google Sheets + KIS API + shadcn/ui” 중심으로 작성. 기존 칸반 보드 규칙과 충돌하지 않도록 PRD 범위만 명시.

## 산출물

- **단일 파일**: [docs/PRD.md](docs/PRD.md)  
- 형식: Markdown, UTF-8  
- 분량: 요구사항 1~~5를 반영한 2~~4페이지 분량

## 참고

- 수정·실행은 사용자 승인 후 진행한다(Plan 모드).
- 프로젝트가 신규일 수 있으므로 `docs` 디렉터리 존재 여부는 작성 시점에 확인한다.

