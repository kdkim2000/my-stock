# KIS Open API 연동 — 종목정보·시세

앱에서 사용하는 한국투자증권(KIS) Open API 목록과 응답 필드 매핑입니다.

## 연동 API 목록

| 용도 | TR ID (실전) | TR ID (모의) | 경로 | 비고 |
|------|--------------|--------------|------|------|
| 현재가 시세 | FHKST01010100 | VFHKST01010100 | `/uapi/domestic-stock/v1/quotations/inquire-price` | 기존 + 확장(전일대비, 시고저) |
| 일봉 차트 | FHKST03010100 | VFHKST03010100 | `/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice` | 52주 고/저 계산용, 최대 100건 |
| 종목정보(재무 요약) | FHKST02010100 | VFHKST02010100 | `/uapi/domestic-stock/v1/quotations/search-info` | DART 재무 미제공 시 폴백, PER/PBR 등 |
| 종목/증권사별 투자의견 | FHKST03110100 | VFHKST03110100 | `/uapi/domestic-stock/v1/quotations/invest-opinion` | 시세분석. FHKST01010100은 현재가용이라 동일 경로여도 현재가 응답 반환됨. env: KIS_OPINION_TR_ID |

## 필드 매핑 (앱 ↔ KIS)

### inquire-price (현재가)

| 앱 필드 (KisPriceInfo) | KIS output 필드 | 설명 |
|------------------------|-----------------|------|
| stckPrpr | stck_prpr | 현재가 |
| prdyVrss | prdy_vrss | 전일 대비 변화량 |
| prdyCtrt | prdy_ctrt | 전일 대비 변화율 |
| stckOprc | stck_oprc | 시가 |
| stckHgpr | stck_hgpr | 고가 |
| stckLwpr | stck_lwpr | 저가 |
| acmlVol | acml_vol | 누적 거래량 |
| stckShrnIscd | stck_shrn_iscd | 종목 약칭 |

### inquire-daily-itemchartprice (일봉)

| 앱 필드 (KisDailyChartPoint) | KIS output2 필드 | 설명 |
|------------------------------|------------------|------|
| date | stck_bsop_date | 영업일 (YYYYMMDD) |
| open | stck_oprc | 시가 |
| high | stck_hgpr | 고가 |
| low | stck_lwpr | 저가 |
| close | stck_clpr | 종가 |
| volume | acml_vol | 누적 거래량 |

### invest-opinion (종목/증권사별 투자의견)

응답은 `output` 또는 `output2` 배열. 각 요소:

| 앱 필드 (KisBrokerOpinion) | KIS output 필드 | 설명 |
|----------------------------|-----------------|------|
| brokerName | mbcr_name | 증권사명 |
| opinion | stck_opnn_txt | 투자의견 텍스트 |
| targetPrice | stck_tgpr | 목표가 |
| date | stck_anal_dt | 분석일 |

앱에서 **종목 요약(KisTickerOpinion)** 은 위 목록의 목표가 평균(컨센서스)과 최신 분석일로 계산해 표시합니다.

## 캐시 정책

- `/api/kis/stock-info`: `Cache-Control: public, s-maxage=300, stale-while-revalidate=120` (5분 캐시).
- `/api/kis/opinion`: 실시간 갱신 항목이 아니므로 **메모이제이션** 적용. 서버는 `unstable_cache` 10분(`revalidate=1`이면 캐시 스킵), 클라이언트는 `staleTime` 30분. "재무·시세 갱신" 버튼으로 투자의견도 함께 재조회 가능.

### search-info (종목정보, DART 폴백용)

DART에서 대차대조표·손익계산서를 가져올 수 없을 때 KIS search-info로 PER, PBR, EPS, BPS 및 재무 요약(해당 필드 존재 시)을 조회합니다. TR ID는 KIS 개발자센터 [국내주식] 종목정보 문서에서 확인 후 필요 시 수정하세요.

### 보조지표 (indicators, KIS 일봉 기반 계산)

| 앱 API | 설명 |
|--------|------|
| GET /api/kis/indicators?code= | KIS 일봉(inquire-daily-itemchartprice) 조회 후 서버에서 RSI(14), MACD(12,26,9) 계산하여 반환. 캐시 5분. |

- **RSI**: 종가 기준 14일, 0~100. 70 이상 과매수, 30 이하 과매도 참고.
- **MACD**: fast=12, slow=26, signal=9. macd, signal, histogram 최근값 반환.

## 추후 연동 후보
- [국내주식] **시세분석** 카테고리: KIS에서 MACD/RSI 직접 제공 시 해당 API로 전환 검토.
