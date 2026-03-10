# KIS API 로그 점검 결과

## 로그 요약

| 항목 | 상태 | 비고 |
|------|------|------|
| GET /api/fundamental?code=018260 | 200, 5159ms | 정상 |
| [KIS] balanceSheet code=018260 | body=ok, pickFirstOutput=ok | 정상 호출 |
| [KIS] incomeStatement code=018260 | body=ok, pickFirstOutput=ok | 정상 호출 |
| DART (fnlttSinglAcnt, getDartTrendOnly 등) | 일부 013 무데이터 | 종목/연도에 따라 무데이터 가능 |

## 원인 및 조치

API는 **정상 호출**되었으나, 실제 KIS 응답 **키 이름**이 코드에서 사용하던 키와 달라 재무 요약이 비었음.

### 대차대조표 (balance-sheet) 실제 응답 키

- `total_aset` (자산총계) — 기존 코드는 `tot_aset`만 참조
- `total_lblt` (부채총계) — 기존 `tot_liab`, `total_liabilities`만 참조
- `total_cptl` (자본총계) — 기존 `tot_eqty`, `total_equity`만 참조
- `cras` (유동자산), `fxas` (비유동자산), `flow_lblt` (유동부채), `fix_lblt` (비유동부채)

→ 위 키를 **우선 참조**하도록 `getKisBalanceSheet` 파싱 수정함.

### 손익계산서 (income-statement) 실제 응답 키

- `sale_account` (매출액) — 기존 `rev`, `revenue`만 참조
- `op_prfi` / `bsop_prti` (영업이익) — 기존 `op_inc`, `operating_income`만 참조
- `thtr_ntin` (당기순이익) — 기존 `net_inc`, `net_income`만 참조

→ 위 키를 **우선 참조**하도록 `getKisIncomeStatement` 파싱 수정함.

## 적용한 코드 변경 (lib/kis-api.ts)

- **getKisBalanceSheet**: `total_aset`, `total_lblt`, `total_cptl`, `cras`, `fxas`, `flow_lblt`, `fix_lblt` 매핑 추가.
- **getKisIncomeStatement**: `sale_account`, `op_prfi`, `bsop_prti`, `thtr_ntin` 매핑 추가.

이제 동일 종목(018260)으로 재요청 시 재무 요약(대차대조표·손익계산서)이 채워져야 합니다.
