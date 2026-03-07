# KIS 재무 요약·비율·추정실적·매매동향 미수집 시 점검

상세 페이지에서 "재무 요약 (KIS)", "비율 (KIS)", "추정실적 (KIS)", "매매동향 (KIS)" 데이터가 나오지 않을 때 단계별로 확인하는 방법입니다.

## 1단계: API 호출 여부 확인

- 상세 페이지는 `GET /api/fundamental?code=066570` 한 번으로 KIS·DART를 모두 받습니다.
- 서버 터미널에서 `GET /api/fundamental?code=...` 로그가 찍히는지 확인하세요.

## 2단계: KIS 오류 로그 확인 (개발 모드)

`NODE_ENV=development`(또는 `npm run dev`)에서 실행 중이라면, KIS 호출 실패 시 아래 로그가 출력됩니다.

- **HTTP 500 / 403 등**
  - `[KIS] kisGet HTTP 500 path=... trId=... code=... msg_cd=... msg1=...`
  - `msg1`에 "기간이 만료된 token" → 토큰 갱신 로직 확인.
  - `msg1`에 "1분당 1회" (EGW00133) → 토큰 캐시/재시도 확인.

- **rt_cd=1 (비정상 응답)**
  - `[KIS] kisGet rt_cd=1 path=... trId=... code=... msg_cd=... msg1=...`
  - **"없는 서비스 코드 입니다"**  
    → 해당 TR_ID가 사용 중인 App Key 권한에 없거나, 실전/모의 구분이 맞지 않을 수 있습니다.  
    → [KIS 오픈API 포털](https://apiportal.koreainvestment.com)에서 해당 TR(예: FHKST66430100, FHKST66430300 등) 사용 권한과 URL을 확인하세요.
  - **"조회된 데이터가 없습니다"**  
    → 종목·기간·기준일 조건에 맞는 데이터가 KIS 쪽에 없을 수 있습니다.  
    → 대차/손익/비율은 `FID_INPUT_DATE_1`(기준일) 없이 한 번 더 재시도하도록 되어 있으므로, 다른 종목으로도 테스트해 보세요.

## 3단계: TR_ID·URL 매핑 확인

`lib/kis-api.ts`의 `KIS_TR_PATH`와 실제 호출하는 `tr_id`가 아래와 같은지 확인하세요.

| 용도           | TR_ID         | path (일부)                    |
|----------------|---------------|--------------------------------|
| 대차대조표      | FHKST66430100 | /finance/balance-sheet        |
| 손익계산서      | FHKST66430200 | /finance/income-statement     |
| 재무비율       | FHKST66430300 | /finance/financial-ratio       |
| 수익성/안정성/성장성/기타 | FHKST66430400 등 | /finance/profit-ratio 등 |
| 추정실적       | HHKST668300C0 | /quotations/estimate-perform   |
| 투자자매매동향  | FHPTJ04160001 | /quotations/investor-trade-by-stock-daily |
| 일별체결량     | FHKST03010800 | /quotations/inquire-daily-trade-volume |

모의투자(VPS) 환경이면 포털 문서에 따라 TR에 `V` 접두어가 필요한지 확인하고, 필요 시 `kisGet` 호출 시 `tr_id`를 `V` + TR 형식으로 바꾸거나 env로 오버라이드할 수 있습니다.

## 4단계: 응답 구조 확인

KIS가 `rt_cd=0`으로 성공했는데도 화면에 데이터가 안 나오면, 응답 구조가 예상과 다를 수 있습니다.

- 재무/비율 API는 보통 `output` 또는 `output1`/`output2`에 단일 객체 또는 배열로 옵니다.
- `lib/kis-api.ts`의 `pickFirstOutput`가 `output` → `output1` → `output2` 순으로 보고, 배열이면 첫 번째 요소를 사용합니다.
- 개발 시 `getKisBalanceSheet` 등 반환 직전에 `console.log(body)`로 실제 구조를 확인해 보시고, 필드명이 한글(자산총계 등)이면 파싱부에 해당 키를 추가하면 됩니다.

## 5단계: 환경 변수 확인

- `KIS_APP_KEY`, `KIS_APP_SECRET`이 설정되어 있는지
- 실전/모의에 맞게 `KIS_APP_SVR`(또는 `KIS_APP_URL`)이 설정되어 있는지

`.env.example`을 참고해 필요한 값을 채워 두세요.
