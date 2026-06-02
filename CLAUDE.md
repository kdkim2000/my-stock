# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean stock trading dashboard (투자 지원 대시보드) built with Next.js 15 App Router. Integrates Google Sheets (trade journal), KIS Open API (Korea Investment & Securities — real-time prices, holdings), DART (financial disclosures), and OpenAI (AI trading guidance).

## Commands

```bash
npm run dev          # Start dev server on port 3000
npm run dev:clean    # Clear .next cache then start dev
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all tests (Vitest)
npm run test:watch   # Watch mode
npm run test:coverage
```

Run a single test file:
```bash
npx vitest run tests/lib/analysis.test.ts
```

## Environment Setup

Copy `.env.example` to `.env.local`. Required variables:
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth 2.0
- `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SHEET_NAME` (default: "매매내역")
- `GOOGLE_SERVICE_ACCOUNT_JSON` — full JSON string of service account (Vercel) or `GOOGLE_APPLICATION_CREDENTIALS` path (local)
- `DART_API_KEY` — opendart.fss.or.kr
- `KIS_APP_KEY`, `KIS_APP_SECRET` — KIS Open API

## Architecture

### Routing & Pages
- `/` → redirects to `/dashboard`
- `/dashboard` — main dashboard (summary cards, PnL charts, ticker analysis table, tag summary)
- `/dashboard/ticker/[id]` — stock detail page (price, financials, ratios, indicators, DART, portfolio, AI analysis, journal)
- `/auth/signin` — Google OAuth login page
- All routes under `/dashboard` and `/api/*` are protected by NextAuth middleware (`middleware.ts`)

### API Routes (`app/api/`)
Each external integration has its own subdirectory:

| Route prefix | Data source | Notes |
|---|---|---|
| `/api/sheets/` | Google Sheets | Transactions, ticker-master, aggregation sheets |
| `/api/kis/` | KIS Open API | Stock prices, holdings, indicators, opinions |
| `/api/dart/` | DART | Financial statements, preliminary earnings |
| `/api/fundamental/` | KIS + DART combined | Integrated view per ticker |
| `/api/analysis/` | Computed from Sheets | Realized PnL, cumulative PnL time series |
| `/api/ai/` | OpenAI (gpt-4o-mini) | Trading strategy guidance |

### Data Fetching Pattern
Client components fetch via React Query hooks in `hooks/`. Each hook calls an internal API route. The API routes call `lib/` modules which call external APIs.

```
UI Component → hooks/use*.ts (React Query) → /api/* route → lib/*.ts → External API
```

### Key Library Modules (`lib/`)
- `google-sheets.ts` — Google Sheets JWT auth using custom crypto (no google-auth-library); token cached with 5-min buffer
- `kis-api.ts` + `lib/kis/` — KIS API wrapper; token valid 24h, cached in memory + `.next/cache/kis-token.json` (or `/tmp/` on Vercel)
- `dart-api.ts` / `dart-fundamental.ts` — DART API; responses cached 1h via `unstable_cache`
- `analysis.ts` — portfolio analysis calculations (realized PnL, win rate, tag aggregation)
- `indicators.ts` — RSI(14), MACD(12,26,9) calculation
- `ticker-mapping.ts` — maps ticker symbols to KIS stock codes
- `ai-cache.ts` — deduplicates in-flight OpenAI requests

### State Management
React Query (`@tanstack/react-query`) for all server state. No global client state store. `QueryClient` and `ThemeProvider` are set up in `components/providers.tsx`.

### Styling
Tailwind CSS + shadcn/ui ("new-york" style). Dark/light mode via `next-themes` (class-based). Profit/loss semantic colors defined as CSS variables: `--color-profit` (green), `--color-loss` (red), used as `text-profit` / `text-loss` utilities.

## TypeScript

Strict mode is enabled. Path alias `@/*` maps to the project root. Types for API responses live in `types/api.ts`; Google Sheets row shapes in `types/sheet.ts`.

## KIS API Quirks
- KIS issues tokens valid for 24h; the app caches them to avoid hitting the daily issuance limit
- Rate-limited endpoints return `EGW00133`; `lib/kis-api.ts` retries with a delay
- `ticker-mapping.ts` resolves ticker symbols to 6-digit KIS codes; falls back to `lib/ticker-cache.ts`

## Vercel Deployment
`next.config.mjs` aggressively excludes unused node_modules from serverless bundles to stay under the 250MB limit. KIS token file path switches between `.next/cache/` (local) and `/tmp/` (Vercel) based on environment. Do not remove the `outputFileTracingExcludes` configuration.

## Testing
Tests live in `tests/lib/`. Vitest is the test runner. Coverage via `@vitest/coverage-v8`. Test coverage is currently minimal — new utility functions in `lib/` should have unit tests.

## Plan Management

**모든 계획 문서는 `docs/plans/` 에 저장한다.**

- Plan 모드에서 수립한 계획은 반드시 `docs/plans/` 디렉토리에 Markdown 파일로 저장
- 파일명 규칙: `{주제}-{YYYY-MM-DD}.md` (예: `my-stock-전면개편-2026-06-01.md`)
- 각 계획 파일에는 **Context**(배경), **문제 목록**, **Phase별 구현 계획**, **검증 전략** 포함
- 기존 Cursor 계획은 `docs/Cursor/`, Antigravity 계획은 `docs/Antigravity/`에 보관됨 (참고용)
