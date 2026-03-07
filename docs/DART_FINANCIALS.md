# DART 전자공시 API — 재무제표·비율

가치투자 강화를 위해 [DART Open API](https://opendart.fss.or.kr)를 연동합니다.

## 환경 변수

| 이름 | 설명 |
|------|------|
| `DART_API_KEY` | opendart.fss.or.kr에서 발급한 인증키 (필수) |

## 연동 API

| 용도 | DART API | 비고 |
|------|----------|------|
| 종목코드(6자리) → corp_code(8자리) | GET /api/corpCode.xml (ZIP 내 CORPCODE.xml) | 24시간 인메모리 캐시 |
| 대차대조표·손익계산서 | GET /api/fnlttSinglAcnt.json (사업보고서 11011) | 사업연도·당기 금액 |

## 앱 API

- **GET /api/dart/financials?code=005930**
  - 쿼리: `code`(6자리), 선택 `currentPrice=`, `revalidate=1`
  - 응답: `{ balanceSheet, incomeStatement, ratios, bsnsYear }`
  - 캐시: Next.js `unstable_cache` 3600초. `revalidate=1`이면 캐시 스킵.

## 재무비율

- **수익성**: ROE, ROA, 영업이익률, 순이익률
- **안정성**: 부채비율, 유동비율
- **기타**: PER, PBR (currentPrice·발행주식수 있을 때 계산)

성장성(매출·이익 증가율)은 전기 대비 당기 데이터가 있을 때 추후 확장 가능.
