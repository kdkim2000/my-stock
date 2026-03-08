# 투자의견을 항상 못 가져오는 원인 — 단계별 점검

## 데이터 흐름 개요

```
[UI] TickerDetailContent (fundamentalData.kis?.opinion)
  ← [API] GET /api/fundamental?code=005930
      ← getInvestmentOpinion(code) (lib/kis-api.ts)
          ← getKisInvestOpinion(code)     → FHKST663300C0 (종목 투자의견)
          ← getKisInvestOpinionBySec(code) → FHKST663400C0 (증권사별 투자의견)
              ← kisGet(path, trId, code, { FID_COND_SCR_DIV_CODE, FID_INPUT_DATE_1, FID_INPUT_DATE_2 })
```

---

## 1단계: UI (표시 조건)

**파일**: `components/dashboard/TickerDetailContent.tsx`  
**섹션**: `id="section-opinion"` (투자의견)

- **데이터 소스**: `fundamentalData.kis?.opinion`
  - `fundamentalData` = `useFundamentalData(code)` → **GET /api/fundamental?code=...** 결과.
- **표시 조건**
  - `fundamentalData.isPending && !fundamentalData.kis` → "로딩 중…"
  - `fundamentalData.error` → **"투자의견을 불러올 수 없습니다."** (여기서 막히면 API/네트워크 오류)
  - 그 외: `opinion.tickerOpinion` 또는 `opinion.brokerOpinions.length > 0` 이 없으면  
    → "이 종목은 KIS 투자의견 데이터가 제공되지 않을 수 있습니다."

**점검**:  
- 브라우저 개발자 도구 → Network에서 `/api/fundamental?code=005930` 요청이 **200** 인지, 응답 body 안 `kis.opinion` 이 있는지 확인.  
- `fundamentalData.error` 가 있으면 **2단계(API 라우트)** 또는 **4단계(kisGet)** 에서 실패한 것.

---

## 2단계: API 라우트 (/api/fundamental)

**파일**: `app/api/fundamental/route.ts`

- **동작**: `getInvestmentOpinion(code)` 를 **Promise.all** 로 `getPriceInfo`, `getDartTrendOnly` 와 함께 호출.
- **반환**: `opinion` 값을 그대로 `kis.opinion` 에 넣어 클라이언트에 전달.
- **중요**: `getInvestmentOpinion` 은 **항상** `KisInvestmentOpinion` 객체를 반환 (예: `{ tickerOpinion: null, brokerOpinions: [] }`).  
  → API가 **throw** 하지 않으면 응답은 200이고, `kis.opinion` 은 항상 존재.  
  → "투자의견을 불러올 수 없습니다." 가 나온다면 **fundamental 전체 요청이 실패**한 경우 (예: 500, fetch 실패).

**점검**:  
- 서버 로그에 `/api/fundamental` 처리 중 예외가 있는지 확인.  
- Network에서 `/api/fundamental` 응답이 **200** 이고, body 에 `kis.opinion: { tickerOpinion: null, brokerOpinions: [] }` 처럼 **빈 구조**로 오는지, 아예 `kis` 가 없거나 에러 필드가 있는지 확인.

---

## 3단계: getInvestmentOpinion (병합 로직)

**파일**: `lib/kis-api.ts`  
**함수**: `getInvestmentOpinion(stockCode)`

- **동작**
  1. `getKisInvestOpinion(code)` → 종목 투자의견 1건 (단일 객체 또는 null)
  2. `getKisInvestOpinionBySec(code)` → 증권사별 투자의견 배열
  3. `tickerOut` 이 있으면 → 목표가/제시일로 `tickerOpinion` 생성
  4. `tickerOpinion` 이 없고 `brokerOpinions` 에 목표가가 있으면 → **컨센서스** (평균 목표가) 로 `tickerOpinion` 생성
  5. `tickerOut` 또는 `list[0]` 에서 PER/PBR/EPS/BPS 추출 → `priceIndicators`

- **항상 반환**: `{ tickerOpinion, brokerOpinions, priceIndicators }` (최악이라도 `tickerOpinion: null`, `brokerOpinions: []`).

**문제가 될 수 있는 경우**
- `getKisInvestOpinion(code)` 이 **null** 반환
- `getKisInvestOpinionBySec(code)` 이 **빈 배열** 반환
- 그리고 `tickerOut` 에 목표가/제시일이 없고, `brokerOpinions` 도 비어 있으면  
  → **tickerOpinion = null, brokerOpinions = []** 로 UI에 "데이터가 제공되지 않을 수 있습니다" 만 보임.

**점검**:  
- 4·5단계에서 **종목/증권사별 API** 가 null·빈 배열을 반환하는지 확인하면 됨.

---

## 4단계: getKisInvestOpinion (종목 투자의견 FHKST663300C0)

**파일**: `lib/kis-api.ts`  
**함수**: `getKisInvestOpinion(code)`

- **요청** (스펙 국내주식-188 반영)
  - path: `/uapi/domestic-stock/v1/quotations/invest-opinion`
  - tr_id: `FHKST663300C0`
  - Query: `FID_COND_MRKT_DIV_CODE=J`, `FID_INPUT_ISCD=code`,  
    **`FID_COND_SCR_DIV_CODE=16633`** (스펙 Primary key, 기존 "J"는 미지원 → 수정됨),  
    `FID_INPUT_DATE_1=start`, `FID_INPUT_DATE_2=end`  
    (start/end = **최근 3개월**, `toKisDate00` → `00YYYYMMDD` 형식)
  - 응답: **output** = Object Array. 필드: invt_opnn(투자의견), hts_goal_prc(목표가), stck_bsop_date(주식영업일자), mbcr_name(회원사명)
- **응답 처리**: `body` 가 있으면 `pickFirstOutput(body)` 반환, 없으면 **null**.

**null 이 되는 경우**
1. **code** 가 6자리 숫자가 아님 → 즉시 null
2. **path** 없음 (상수 있으면 해당 없음)
3. **kisGet** 이 **null** 반환 (아래 5단계)
4. **pickFirstOutput(body)** 가 **null** 반환 (응답이 output/output1/output2 에 없거나 구조 불일치)

**점검**:  
- 개발 모드에서 추가한 로그 확인:
  - `[KIS] investOpinion code=... body=null` → kisGet 실패
  - `[KIS] investOpinion code=... pickFirstOutput=null bodyKeys=...` → 응답 구조 문제

---

## 5단계: kisGet (HTTP · KIS 오류)

**파일**: `lib/kis-api.ts`  
**함수**: `kisGet(path, trId, code, extraParams)`

**body 가 null 이 되는 경우**

| 단계 | 조건 | 결과 |
|------|------|------|
| 5-1 | 캐시에 있으면 | 캐시 반환 (null 아님) |
| 5-2 | **getAccessToken() 실패** | null |
| 5-3 | **KIS_APP_KEY / KIS_APP_SECRET 없음** | null |
| 5-4 | **HTTP !res.ok** (4xx/5xx) | null |
| 5-5 | **body.rt_cd !== "0"** (KIS 비즈니스 오류) | null |
| 5-6 | **JSON 파싱 실패** | null |

- **투자의견 API** 는 **실전 전용** (모의투자 미지원) 이므로, **실전 앱키/시크릿** 과 **실전 URL** 이어야 함.
- 개발 모드에서는 5-4, 5-5 시 `[KIS] kisGet ... path=.../invest-opinion ... rt_cd=... msg_cd=... msg1=...` 로그 출력.

**점검**:  
- 서버 로그에서 `invest-opinion`, `FHKST663300C0` 검색.  
- `rt_cd` 가 "0" 이 아닌지, `msg_cd` / `msg1` 내용 확인 (예: 권한 없음, 일일 한도, 조회 기간/종목 제한).

---

## 6단계: pickFirstOutput (종목 의견 1건 추출)

**파일**: `lib/kis-api.ts`  
**함수**: `pickFirstOutput(body)`

- **순서**: `body.output` → `body.output1` → `body.output2` 순으로 확인.
- **규칙**: 배열이면 첫 번째 **객체** 반환, 단일 객체면 그대로 반환.
- **해당 없음**: 위 키에 데이터가 없거나, 빈 배열/다른 구조면 **null** 반환.

**점검**:  
- KIS 투자의견 API 공식 스펙에서 **응답 body 의 키 이름** (output / output1 / output2 등) 확인.  
- 개발 로그에서 `bodyKeys=...` 로 실제 응답 키를 확인해, 다른 키(예: output3)로 오는지 여부 확인.

---

## 7단계: getKisInvestOpinionBySec (증권사별 FHKST663400C0)

**파일**: `lib/kis-api.ts`  
**함수**: `getKisInvestOpinionBySec(code)`

- **요청** (스펙 국내주식-189 반영): path `/uapi/domestic-stock/v1/quotations/invest-opbysec`, tr_id `FHKST663400C0`,  
  **`FID_COND_SCR_DIV_CODE=16634`** (스펙 Primary key, 기존 "J"는 미지원 → 수정됨),  
  `FID_DIV_CLS_CODE=0`(전체)/1(매수)/2(중립)/3(매도),  
  `FID_INPUT_DATE_1/2` = 최근 3개월 (00년월일).
- **응답**: `extractListFromKisBody(body)` → **배열** (비어 있으면 []).

**빈 배열이 되는 경우**
1. **kisGet** 이 null (5단계와 동일)
2. **extractListFromKisBody** 가 output/output2 에서 배열을 찾지 못함 (구조 불일치)

**점검**:  
- 개발 로그에서 `investOpinionBySec code=... body=null` / `bodyKeys=...` 확인.

---

## 8단계: 날짜 형식 (FID_INPUT_DATE_1 / 2)

- **현재**: `getLast3MonthsKisDates()` → `toKisDate00(start)`, `toKisDate00(end)`  
  → **10자리** 문자열 `00YYYYMMDD` (예: 0020240307).
- KIS 스펙에 **00년월일** 등 다른 형식 요구가 있으면, 형식 불일치로 **빈 결과** 또는 **rt_cd 오류** 가 날 수 있음.

**점검**:  
- KIS 개발자센터 문서에서 **FHKST663300C0 / FHKST663400C0** 의 `FID_INPUT_DATE_1`, `FID_INPUT_DATE_2` 요구 형식 확인.  
- 필요 시 `toKisDate00` 대신 스펙에 맞는 포맷으로 변경.

---

## 9단계: 정리 — 가능한 원인 우선순위

1. **KIS API 권한/환경**
   - 실전 앱키/시크릿 미설정 또는 **모의용** 사용 (투자의견은 실전 전용일 수 있음).
   - **rt_cd ≠ "0"**: 해당 종목 미제공, 조회 기간 제한, 일일 한도 등.

2. **kisGet 실패**
   - 토큰 만료/실패, HTTP 4xx·5xx, **rt_cd** 오류 → body null → 종목/증권사별 모두 데이터 없음.

3. **응답 구조**
   - 투자의견 API가 **output / output1 / output2 가 아닌 키**로 데이터를 주는 경우  
     → pickFirstOutput / extractListFromKisBody 가 null·빈 배열 반환.

4. **날짜 형식**
   - `FID_INPUT_DATE_1/2` 가 스펙과 다르면 빈 결과 또는 오류.

5. **종목/서비스 제한**
   - 일부 종목만 투자의견 제공, 또는 특정 계정/권한만 조회 가능.

---

## 10단계: 권장 점검 순서

1. **Network**: `/api/fundamental` 이 200 인지, 응답 `kis.opinion` 이 `{ tickerOpinion: null, brokerOpinions: [] }` 인지 확인.
2. **서버 로그**: `[KIS] kisGet` 에서 `invest-opinion`, `invest-opbysec`, `rt_cd`, `msg_cd`, `msg1` 확인.
3. **개발 로그**: `[KIS] investOpinion ... body=null` / `pickFirstOutput=null bodyKeys=...` 로 어느 단계에서 끊기는지 확인.
4. **환경변수**: `KIS_APP_KEY`, `KIS_APP_SECRET` 실전 설정 여부, `KIS_COND_SCR_DIV_CODE` (기본 J), `KIS_OPINION_DIV_CLS_CODE` (기본 0).
5. **KIS 문서**: FHKST663300C0, FHKST663400C0 의 요청 파라미터(날짜 형식 포함)·응답 body 구조 확인.

이 문서는 `docs/KIS_투자의견_미수집_단계별_점검.md` 로 두고, 위 순서대로 확인하면 어느 단계에서 문제가 발생하는지 좁힐 수 있다.
