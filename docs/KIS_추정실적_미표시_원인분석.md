# 추정실적 (KIS) 값이 나오지 않는 원인 — 단계별 분석

## 1. UI 단계 (표시 조건)

**파일**: `components/dashboard/TickerDetailContent.tsx`  
**섹션**: `id="section-estimate-kis"` (추정실적 (KIS))

- **표시 조건**
  - `fundamentalData.kis` 가 있어야 섹션이 렌더됨.
  - 그 다음:
    - `fundamentalData.kis.estimatePerform` 이 **없거나**
    - `Object.keys(fundamentalData.kis.estimatePerform).length === 0` 이면  
      → "KIS 추정실적 데이터를 가져올 수 없습니다. (일부 종목은 미제공)" 표시.
- **데이터가 있어도**
  - `estimatePerform` 내부에 **숫자 또는 비어 있지 않은 문자열**이 하나도 없으면  
    → "추정실적 항목이 없습니다." 표시  
    (`numEntries = Object.entries(ep).filter(([, v]) => typeof v === "number" || (typeof v === "string" && v))`).

**결론**: 값이 안 나오는 경우는  
① `estimatePerform` 자체가 `null`/`undefined` 이거나,  
② 빈 객체 `{}` 이거나,  
③ 키는 있지만 값이 전부 숫자/문자열이 아닌 경우(예: 배열·중첩 객체만 있음) 이다.

---

## 2. API 라우트 단계 (데이터 소스)

**파일**: `app/api/fundamental/route.ts`

- `GET /api/fundamental?code=066570` 에서 `getKisEstimatePerform(code)` 를 **Promise.all** 로 다른 KIS/DART 호출과 함께 호출.
- 반환값을 `estimatePerform` 에 넣어 `kis.estimatePerform` 으로 클라이언트에 전달.
- `getKisEstimatePerform` 이 `null` 을 반환하면 `estimatePerform: estimatePerform ?? null` → **null** 이 전달됨.

**결론**: 서버에서 이미 `estimatePerform` 이 `null` 이면 UI에서는 절대 값이 나올 수 없다.

---

## 3. KIS API 호출 단계 (getKisEstimatePerform)

**파일**: `lib/kis-api.ts`  
**함수**: `getKisEstimatePerform(code)`

동작 순서:

1. **종목코드 검증**  
   `code` 가 6자리 숫자가 아니면 즉시 `null` 반환.

2. **경로 확인**  
   `KIS_TR_PATH.HHKST668300C0` → `/uapi/domestic-stock/v1/quotations/estimate-perform`  
   path 가 없으면 `null` 반환 (실제 코드에서는 상수 존재).

3. **kisGet 호출**
   - `kisGet(path, "HHKST668300C0", code, { SHT_CD: code })`
   - **SHT_CD**: KIS 스펙상 **종목코드(필수)**. 6자리 종목코드를 그대로 전달 (ex) 265520). (기존에는 `"0"`을 보내 잘못 호출됨 → 수정됨)

4. **body 가 null 이면**  
   → `getKisEstimatePerform` 은 `null` 반환 → UI 에서 "가져올 수 없습니다" 표시.

5. **body 가 있으면**  
   → `pickFirstOutput(body)` 결과를 그대로 반환.

**결론**: `body` 가 null 이 되는 원인(아래 4단계) 또는 `pickFirstOutput` 이 null 을 반환하는 원인(아래 5단계)을 찾아야 한다.

---

## 4. kisGet 단계 (HTTP·응답 처리)

**파일**: `lib/kis-api.ts`  
**함수**: `kisGet(path, trId, code, extraParams)`

`body` 가 **null** 이 되는 경우:

| 단계 | 조건 | 결과 |
|------|------|------|
| 4-1 | 캐시에 있으면 | 캐시 반환 (null 아님) |
| 4-2 | `getAccessToken()` 실패 | `null` |
| 4-3 | `process.env.KIS_APP_KEY` 또는 `KIS_APP_SECRET` 없음 | `null` |
| 4-4 | **HTTP `!res.ok`** (4xx/5xx 등) | `null` |
| 4-5 | **`body.rt_cd !== "0"`** (KIS API 비즈니스 오류) | `null` |
| 4-6 | 응답 JSON 파싱 실패 | `null` |

- 개발 모드에서는 4-4, 4-5 시 `console.log` 로 `path`, `trId`, `code`, `msg_cd`, `msg1` (또는 body 일부) 로그 출력.

**확인 방법**  
- 서버 로그에서 `[KIS] kisGet ... path=.../estimate-perform ...` 또는 `rt_cd=... msg_cd=... msg1=...` 확인.  
- `rt_cd` 가 "0" 이 아니거나, HTTP 상태코드가 200 이 아니면 이 단계에서 null.

**결론**:  
- 토큰/앱키 문제,  
- KIS 측 오류 코드(rt_cd, msg_cd),  
- 또는 해당 종목/계정에 대해 추정실적 API 미제공 시  
→ `body` 가 null 이 되어 추정실적이 나오지 않는다.

---

## 5. pickFirstOutput 단계 (응답에서 1개 레코드 추출)

**파일**: `lib/kis-api.ts`  
**함수**: `pickFirstOutput(body)`

- **순서**: `body.output` → `body.output1` → `body.output2` 순으로 확인.
- **각 키에 대해**
  - 값이 **배열**이고 길이 > 0 이면 → **첫 번째 요소(객체)** 반환.
  - 값이 **객체**이면 → 그 객체의 값 중 하나가 객체이면 그걸 반환, 아니면 키가 있으면 그 객체 자체 반환.
- 위에 해당하는 것이 **하나도 없으면** → **null** 반환.

**스펙 기준 응답 구조 (국내주식-187)**  
- **output1**: 단일 Object (sht_cd, item_kor_nm, name1, name2, estdate, rcmd_name, capital, forn_item_lmtrt)  
- **output2**: Object Array (6개) — 추정손익계산서: 매출액, 매출액증감율, 영업이익, 영업이익증감율, 순이익, 순이익증감율. 각 행에 data1~data5  
- **output3**: Object Array (8개) — 투자지표: EBITDA(십억), EPS(원), EPS증감율, PER, EV/EBITDA, ROE, 부채비율, 이자보상배율. 각 행에 data1~data5  
- **output4**: Object Array — dt(결산년월), data1~5 결산월 정보  

**수정 후**: `normalizeEstimatePerformOutput(body)` 로 output2·output3 배열을 파싱해 data1(및 data2) 값을 꺼내 flat 객체(revenue, eps, ebitda, per, roe 등)로 반환. 이 객체를 그대로 estimatePerform 으로 사용.

---

## 6. 정리: 가능한 원인 우선순위

1. **KIS API 자체**
   - 해당 종목에 대해 **추정실적 데이터 미제공** (일부 종목만 제공).
   - **rt_cd ≠ "0"** (권한, 종목 제한, SHT_CD 오류 등).
   - **HTTP 오류** (인증, 일일 한도 등).

2. **kisGet 단계**
   - 토큰/앱키 없음, 만료, 403 등으로 `body` 가 null.

3. **응답 구조**
   - 추정실적 API가 **output / output1 / output2 가 아닌 키**로 데이터를 주는 경우  
     → `pickFirstOutput` 이 null 반환.

4. **SHT_CD** (해결됨)
   - 스펙: Query Parameter **SHT_CD = 종목코드(필수)**. 6자리 종목코드(ex) 265520)를 넣어야 함.  
   - 기존에 `SHT_CD=0` 으로 호출해 잘못된 요청이었음 → 코드에서 `SHT_CD: code` 로 수정함.

5. **UI 필터**
   - `estimatePerform` 에는 데이터가 있는데,  
     **모든 값이 숫자/문자열이 아닌 경우** (중첩 객체·배열만 있는 경우)  
     → "추정실적 항목이 없습니다." 로만 보일 수 있음.

---

## 7. 권장 점검 순서

1. **서버 로그**  
   - `[KIS] kisGet` 로그에서 `estimate-perform`, `HHKST668300C0`, `rt_cd`, `msg_cd`, `msg1` 확인.
2. **실제 응답 구조 확인**  
   - `getKisEstimatePerform` 내부에서 `body` 를 개발 모드에서 한 번 로그로 출력해  
     `output` / `output1` / `output2` 외에 실데이터가 들어 있는 키가 있는지 확인.
3. **다른 종목 테스트**  
   - 대형주 등 추정실적이 제공될 가능성이 높은 종목으로 동일 API 호출해 보기.
4. **KIS 문서**  
   - 종목추정실적(HHKST668300C0) 공식 스펙에서  
     응답 필드명(output/ output1/ output2), SHT_CD 의미, 제공 대상 종목 여부 확인.

이 문서는 `docs/KIS_추정실적_미표시_원인분석.md` 로 두고, 위 순서대로 점검하면 원인을 단계별로 좁힐 수 있다.
