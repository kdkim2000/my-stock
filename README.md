# 주식 매매일지 대시보드 앱

개인 주식 투자자를 위한 매매일지 및 포트폴리오 관리 웹 앱입니다. Google Sheets에 매매 내역을 두고, 웹에서 인사이트 대시보드와 실시간 평가 손익(KIS API)을 제공합니다.

## 문서

- [PRD (제품 요구사항)](docs/PRD.md)
- [Architecture (기술 아키텍처)](docs/ARCHITECTURE.md)

## 로컬 실행 (앱 구현 후)

```bash
npm install
cp .env.example .env.local
# .env.local에 필요한 값 입력 후
npm run dev
```

환경 변수는 `.env.example`을 참고하여 `.env.local`에 설정합니다. `.env.local`은 Git에 포함되지 않습니다.

## 기술 스택

- Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Google Sheets API, 한국투자증권 KIS Open API
