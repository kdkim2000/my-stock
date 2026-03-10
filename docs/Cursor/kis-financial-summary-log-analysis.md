# 재무 요약 (KIS) 미표시 로그 분석

## 제공 로그 분석 결과

제공해 주신 로그에는 **KIS 재무 API(대차대조표/손익계산서) 호출에 대한 기록이 전혀 없습니다.**

- **있는 로그**: DART (`getDartTrendOnly`, `getDartReportRceptNo`, `fnlttSinglAcnt` 등), GET 요청 (`/api/fundamental?code=018260` 200 등)
- **없는 로그**: `[KIS]` 접두어 로그 (kisGet 실패 시 `rt_cd` 로그, HTTP 실패 로그 등)

### 가능한 원인

1. **NODE_ENV가 development가 아님**  
   기존 KIS 로그는 `process.env.NODE_ENV === "development"` 일 때만 출력됩니다. production이면 KIS 실패가 로그에 남지 않습니다.

2. **kisGet이 null을 반환하는 경우**
   - HTTP가 200이 아닐 때 (토큰 만료, 403 등)
   - `body.rt_cd !== "0"` (KIS 비즈니스 에러)
   - JSON 파싱 실패  
   → development일 때만 일부 로그가 나가며, 재무 API 경로에 대한 전용 로그는 없었음.

3. **재무 API 응답 구조 차이**  
   `pickFirstOutput(body)`가 null을 반환하면 대차대조표/손익계산서가 null이 되는데, 이때 원인(어떤 키로 데이터가 왔는지)을 로그로 남기지 않았음.

---

## 조치 사항 (적용됨)

`lib/kis-api.ts`에 **재무 요약 전용 개발 로그**를 추가했습니다.

- **getKisBalanceSheet**
  - 코드 검증 실패 시: `[KIS] balanceSheet skip: invalid code`
  - 요청 후: `[KIS] balanceSheet code=018260 quarterEnd=YYYYMMDD body=ok|null`
  - 파싱 후: `[KIS] balanceSheet code=018260 pickFirstOutput=ok|null keys=...`
- **getKisIncomeStatement**
  - 동일한 패턴으로 `[KIS] incomeStatement ...` 로그 추가

### 다음 확인 방법

1. **NODE_ENV 확인**  
   `npm run dev` 로 실행 시 보통 `development`입니다. 터미널에서 `NODE_ENV`가 뭘로 설정되는지 확인하세요.

2. **상세 페이지에서 재무 갱신**  
   종목 018260 등으로 상세 진입 후 「재무·시세 갱신」 버튼을 눌러 `/api/fundamental?code=018260&revalidate=1` 이 호출되게 합니다.

3. **서버 로그 확인**  
   같은 시점에 다음 로그가 나오는지 봅니다.
   - `[KIS] balanceSheet code=018260 quarterEnd=... body=...`
   - `[KIS] balanceSheet code=018260 pickFirstOutput=... keys=...`
   - `[KIS] incomeStatement code=018260 ...`

4. **로그별 의미**
   - `body=null` → kisGet 실패 (HTTP 에러 또는 `rt_cd !== "0"`). 같은 요청 시점에 `[KIS] kisGet HTTP ...` 또는 `[KIS] kisGet rt_cd=...` 로그가 있는지 확인.
   - `pickFirstOutput=null` → KIS 응답의 output/output1/output2 구조가 예상과 다름. `keys=`가 비어 있으면 body 구조 로그를 더 넣어야 함.
   - `pickFirstOutput=ok`, `keys=...` → 정상 파싱된 경우. 이때도 재무 요약이 안 보이면 프론트/API 매핑을 확인.

위 단계로 다시 실행한 뒤, 새로 찍힌 `[KIS] balanceSheet` / `[KIS] incomeStatement` 로그를 알려주시면 원인을 더 좁혀서 안내할 수 있습니다.
