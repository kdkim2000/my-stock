---
name: KIS TR_ID 영역별 점검
overview: 사용자 제공 TR_ID 목록에 맞춰 [lib/kis-api.ts](lib/kis-api.ts)의 KIS 호출을 영역별로 정리하고, 문서 확인 후 경로·응답 매핑을 반영하는 계획입니다.
todos: []
isProject: false
---

# KIS API TR_ID 영역별 점검 계획

## 1. 현재 코드 사용 TR vs 제공 TR 매핑


| 용도              | 현재 경로                                      | 현재 TR (실전/모의)                  | 제공 TR (사용자)                                      |
| --------------- | ------------------------------------------ | ------------------------------ | ------------------------------------------------ |
| 현재가 시세          | `/quotations/inquire-price`                | FHKST01010100 / VFHKST01010100 | **(미제공)**                                        |
| 일봉 차트           | `/quotations/inquire-daily-itemchartprice` | FHKST03010100 / VFHKST03010100 | **(미제공)**                                        |
| 종목정보(PER/PBR 등) | `/quotations/search-info`                  | FHKST02010100 / VFHKST02010100 | **재무비율** FHKST66430300 등                         |
| 투자의견(종목+증권사)    | `/quotations/invest-opinion`               | FHKST03110100 / VFHKST03110100 | **종목투자의견** FHKST663300C0, **증권사별** FHKST663400C0 |


제공 TR 상세:

- 상품기본조회: CTPF1604R
- 주식기본조회: CTPF1002R
- 국내주식 대차대조표: FHKST66430100
- 국내주식 손익계산서: FHKST66430200
- 국내주식 재무비율: FHKST66430300
- 국내주식 수익성비율: FHKST66430400
- 국내주식 기타주요비율: FHKST66430500
- 국내주식 안정성비율: FHKST66430600
- 국내주식 성장성비율: FHKST66430800
- 국내주식 종목추정실적: HHKST668300C0
- 국내주식 종목투자의견: FHKST663300C0
- 국내주식 증권사별 투자의견: FHKST663400C0

**추가(종목별 활용):**

- 종목별 투자자매매동향(일별): FHPTJ04160001
- 주식현재가 회원사 종목매매동향: FHPST04540000
- 종목별일별매수매도체결량: FHKST03010800

---

## 2. 전제: 문서 필요 사항

TR_ID만으로는 **API URL 경로·메서드·입출력 필드**를 알 수 없습니다. 구현 전에 아래가 필요합니다.

- **TR별 API 정보**
  - 호출 URL 경로 (예: `/uapi/domestic-stock/v1/...` 중 어떤 path인지)
  - HTTP 메서드 (GET/POST)
  - 쿼리/바디 파라미터 (예: FID_COND_MRKT_DIV_CODE, FID_INPUT_ISCD 등)
- **응답 구조**
  - `output` / `output1` / `output2` 등 필드명
  - PER, PBR, EPS, 대차대조표·손익계산서·비율 항목의 필드명(한글/영문)

**질문**: 위 TR들(CTPF*, FHKST6643*, HHKST668300C0, FHKST6633*)에 대한 **API 경로·요청/응답 스펙 문서**를 공유해 주실 수 있나요?  
(현재가/일봉용 TR이 목록에 없으므로, FHKST01010100 / FHKST03010100은 문서에 포함되면 그대로 매핑하고, 없으면 “시세·차트는 기존 TR 유지”로 진행 가능합니다.)

---

## 3. 구현 방향 (문서 확보 후)

### 3.1 TR_ID 상수 및 환경변수 정리

- **[lib/kis-api.ts](lib/kis-api.ts)** 상단에 **영역별 TR 상수** 도입.
  - 예: `TR_INQUIRE_PRICE`, `TR_DAILY_CHART`, `TR_FINANCIAL_RATIO`, `TR_BALANCE_SHEET`, `TR_INCOME_STATEMENT`, `TR_TICKER_OPINION`, `TR_BROKER_OPINION`, `TR_ESTIMATED_EARNINGS` 등.
  - 실전/모의(VPS) 구분은 기존처럼 `isVps ? "V" + trId : trId` 형태로 유지 가능 (문서에서 모의 TR 명명 규칙 확인 필요).
- **.env.example** 에는 이미 있는 `KIS_OPINION_TR_ID`, `KIS_SEARCH_INFO_TR_ID`를, 새 TR 구조에 맞게 **영역별 오버라이드**로 정리 (예: `KIS_TR_FINANCIAL_RATIO`, `KIS_TR_TICKER_OPINION` 등, 문서 확인 후 명명).

### 3.2 현재가·일봉 (문서에 없으면 유지)

- **getPriceInfo** / **getCurrentPrice**: 현재 FHKST01010100 사용.  
  - 제공 목록에 “현재가” TR이 없으므로, **문서에 별도 TR이 있으면 교체**, 없으면 **그대로 유지**.
- **getDailyChart**: FHKST03010100.  
  - 동일하게 문서 확인 후 필요 시에만 TR 변경.

### 3.3 재무/비율 영역 (search-info → 영역별 TR 분리)

- **getKisStockFundamentals** 현재 역할: PER, PBR, EPS, BPS, (선택) 대차대조표·손익계산서.
- 문서 확인 후:
  - **재무비율** FHKST66430300: PER/PBR/EPS 등 메인 비율 조회에 사용 (경로·응답 필드 문서 기준으로 매핑).
  - 필요 시 **대차대조표** FHKST66430100, **손익계산서** FHKST66430200 호출 추가해 `KisStockFundamentals.balanceSheet` / `incomeStatement` 채우기.
  - **수익성/안정성/성장성/기타비율** (FHKST66430400~30800): 화면에서 필요하면 별도 함수로 조회 후 기존 타입에 병합.

호출처: [app/api/fundamental/route.ts](app/api/fundamental/route.ts), [app/api/fundamental/valuation/route.ts](app/api/fundamental/valuation/route.ts), [app/api/kis/stock-info/route.ts](app/api/kis/stock-info/route.ts), [app/api/dart/financials/route.ts](app/api/dart/financials/route.ts) — 모두 `getKisStockFundamentals` 결과에 의존하므로, **getKisStockFundamentals 내부에서 새 TR(들)을 호출하고 기존 반환 타입을 유지**하면 라우트 수정을 최소화할 수 있습니다.

### 3.4 투자의견 (1개 → 2개 TR 분리)

- **종목투자의견** FHKST663300C0, **증권사별 투자의견** FHKST663400C0 로 **API 2회 호출** (경로는 문서 확인).
- **[lib/kis-api.ts](lib/kis-api.ts)** 의 **getInvestmentOpinion**:
  - 두 TR 각각 호출 후,
  - 종목 의견 → `tickerOpinion`,
  - 증권사별 목록 → `brokerOpinions`,
  - 기존처럼 **priceIndicators** 는 증권사별 응답 1행 등에서 추출 가능하면 유지.
- 반환 타입 `KisInvestmentOpinion` 은 그대로 두고, 호출부([app/api/fundamental/route.ts](app/api/fundamental/route.ts), [app/api/kis/opinion/route.ts](app/api/kis/opinion/route.ts)) 변경 없음.

### 3.5 종목추정실적 (선택)

- **HHKST668300C0**: Forward EPS 등 추정 실적용.
- 문서 확인 후, 필요하면 **getKisStockFundamentals** 또는 별도 함수에서 호출해 `forwardEps` 등으로 노출.

### 3.6 상품/주식 기본조회 (CTPF1604R, CTPF1002R)

- 문서에서 **용도·경로·응답** 확인 후, 현재가/종목 기본정보와 중복 여부 판단.
- 필요 시 “주식 기본조회”로 현재가·기본 정보 일부를 대체하거나, 보조 데이터로만 사용할 수 있음.

### 3.7 종목별 매매동향·체결량 (상세 페이지 새 섹션)

상세 페이지에 **새 섹션으로 표시** (사용자 선택 반영).


| TR_ID         | 용도               | 구현 방향                                              |
| ------------- | ---------------- | -------------------------------------------------- |
| FHPTJ04160001 | 종목별 투자자매매동향(일별)  | kis-api에 getInvestorTradingTrendDaily(code, 기간) 추가 |
| FHPST04540000 | 회원사 종목매매동향       | getMemberTradingTrend(code) 추가                     |
| FHKST03010800 | 종목별 일별 매수/매도 체결량 | getDailyBuySellVolume(code, start, end) 추가         |


- API 경로·파라미터: apiportal.koreainvestment.com 확인. UI: TickerDetailContent에 투자자 매매동향·회원사 매매동향·일별 체결량 섹션 추가. 데이터: 신규 API 라우트 + useQuery.

---

## 4. 작업 순서 제안

```mermaid
flowchart LR
  A[TR 상수 및 env 정리] --> B[투자의견 2 TR 분리]
  B --> C[재무비율 등 TR 교체]
  C --> D[현재가 일봉 유지]
  D --> E[매매동향 3 TR 연동]
  E --> F[상세페이지 새 섹션 UI]
```



1. **TR 상수·env**: [lib/kis-api.ts](lib/kis-api.ts) 및 [.env.example](.env.example) 에 전체 TR_ID(기존+신규 3개) 상수·env 오버라이드 정리.
2. **getInvestmentOpinion**: FHKST663300C0 + FHKST663400C0 호출로 분리, 응답 병합 (경로는 apiportal/문서 확인).
3. **getKisStockFundamentals**: FHKST66430300 등 재무·비율 TR로 교체·추가, 기존 반환 타입 유지.
4. **현재가·일봉**: 문서에 별도 TR 없으면 FHKST01010100 / FHKST03010100 유지.
5. **매매동향 3 TR**: FHPTJ04160001, FHPST04540000, FHKST03010800용 함수 추가 및 API 라우트 추가. (경로·파라미터는 apiportal.koreainvestment.com 또는 제공 문서 기준.)
6. **상세 페이지**: [TickerDetailContent.tsx](components/dashboard/TickerDetailContent.tsx)에 투자자 매매동향(일별)·회원사 매매동향·일별 매수/매도 체결량 섹션 추가.

---

## 5. 요약

- **즉시 코드만으로 할 수 있는 것**: TR_ID를 상수/env로 빼서 [lib/kis-api.ts](lib/kis-api.ts) 전역을 정리하고, **기존 TR을 사용하되** 사용자 제공 TR_ID로 치환할 수 있음.  
단, **경로·파라미터·응답 필드가 TR별로 다를 수 있으므로**, 문서 없이 전부 교체하면 413/500 등 오류 가능성이 큼.
- **문서가 있을 때 할 수 있는 것**: 위 3~3.6 절대로, 경로·요청/응답에 맞춰 실제 호출 로직과 파싱을 수정하고, 현재가/일봉/재무/투자의견/추정실적을 영역별 TR에 맞게 정리.

**다음 단계**: 제공하시기로 하신 “관련 문서”에서 **TR별 API 경로·메서드·입출력 스펙**을 알려주시면, 그에 맞춰 위 계획을 구체화한 뒤 단계별 수정안(함수별 변경 포인트, 필드 매핑)을 제안하겠습니다.