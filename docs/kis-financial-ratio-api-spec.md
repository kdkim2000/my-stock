# KIS 재무비율 API (FHKST66430300) 스펙 대조

## API 스펙 요약

| 항목 | 스펙 | 코드 반영 |
|------|------|-----------|
| Method | GET | ✅ kisGet 사용 (GET) |
| URL | /uapi/domestic-stock/v1/finance/financial-ratio | ✅ KIS_TR_PATH.FHKST66430300 |
| 실전 Domain | https://openapi.koreainvestment.com:9443 | ✅ getBaseUrl() |
| TR ID | FHKST66430300 | ✅ kisGet(..., "FHKST66430300", ...) |

## Query Parameter (스펙 필수)

| 스펙 Element | 한글명 | Required | 스펙 값 예 | 코드 전달 |
|--------------|--------|----------|------------|-----------|
| FID_DIV_CLS_CODE | 분류 구분 코드 | Y | 0: 년, 1: 분기 | ✅ extraParams: { FID_DIV_CLS_CODE: "0" } (기본) |
| fid_cond_mrkt_div_code | 조건 시장 분류 코드 | Y | J | ✅ kisGet 기본: FID_COND_MRKT_DIV_CODE: "J" |
| fid_input_iscd | 입력 종목코드 | Y | 000660 | ✅ kisGet 기본: FID_INPUT_ISCD: code |

- 스펙에는 **FID_INPUT_DATE_1이 없음**. 기존에는 `financeExtraParams()`로 FID_INPUT_DATE_1을 함께 보내고 있었음 → **제거함** (재무비율 API는 FID_DIV_CLS_CODE만 사용).

## Response Body (스펙)

- output: Object Array
  - stac_yymm (결산 년월)
  - grs (매출액 증가율)
  - bsop_prfi_inrt (영업 이익 증가율)
  - ntin_inrt (순이익 증가율)
  - roe_val (ROE 값)
  - **eps** (EPS)
  - sps (주당매출액)
  - **bps** (BPS)
  - rsrv_rate (유보 비율)
  - lblt_rate (부채 비율)

코드에서는 `pickFirstOutput(body)`로 output 배열의 첫 번째 객체를 사용하며, `financialRatio.eps`, `financialRatio.bps` 및 per/pbr 등 다른 키를 함께 사용합니다. 스펙에 명시된 **eps**, **bps**는 그대로 활용 중입니다.

## 적용한 수정

- `getKisFinancialRatio()`: **FID_INPUT_DATE_1 제거**. 스펙대로 `FID_DIV_CLS_CODE`만 쿼리로 전달하고, kisGet 기본 파라미터(FID_COND_MRKT_DIV_CODE, FID_INPUT_ISCD)에 의존합니다.
