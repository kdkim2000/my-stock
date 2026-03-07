# Vercel 배포 가이드

로컬의 `.env.local`과 `my-stock-service-account.json` 파일 없이, **Vercel 환경 변수만**으로 동작하도록 설정하는 방법입니다.

## 1. Vercel 환경 변수 설정

Vercel 대시보드 → 프로젝트 선택 → **Settings** → **Environment Variables**에서 아래 변수를 추가합니다.

### Google Sheets (필수)

| 이름 | 값 | 비고 |
|------|-----|------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | 서비스 계정 JSON **전체 내용** | `my-stock-service-account.json` 파일 내용을 한 줄로 복사. 줄바꿈 제거 또는 그대로 둬도 됨. |
| `GOOGLE_SPREADSHEET_ID` | 스프레드시트 ID | 시트 URL의 `/d/` 와 `/edit` 사이 문자열 |
| `GOOGLE_SHEET_NAME` | 매매내역 시트 탭 이름 | 예: `매매내역` |
| `GOOGLE_SHEET_TICKER_MASTER` | (선택) 종목코드 마스터 탭 이름 | 예: `종목코드` |
| `GOOGLE_SHEET_AGGREGATION` | (선택) 종목별 집계 탭 이름 | 예: `종목별집계` |

### KIS API (평가손익 사용 시)

| 이름 | 값 |
|------|-----|
| `KIS_APP_KEY` | 한국투자증권 앱키 |
| `KIS_APP_SECRET` | 한국투자증권 앱시크릿 |

모의투자/실전 전환은 `KIS_APP_SVR=vps` 또는 `KIS_APP_URL=...` 로 설정합니다.

## 2. GOOGLE_SERVICE_ACCOUNT_JSON 값 넣는 방법

1. 로컬의 `my-stock-service-account.json` 파일을 연다.
2. 전체 내용을 복사한다.
3. Vercel Environment Variables에서 `GOOGLE_SERVICE_ACCOUNT_JSON` 이름으로 **Value**에 붙여넣기 한다.  
   (한 줄로 넣어도 되고, 여러 줄 그대로 넣어도 파싱 가능합니다.)

## 3. 동작 방식

- **Vercel**: `GOOGLE_SERVICE_ACCOUNT_JSON`이 있으면 해당 JSON으로 Google Auth를 사용합니다. `GOOGLE_APPLICATION_CREDENTIALS`(파일 경로)는 사용하지 않습니다.
- **로컬**: `GOOGLE_APPLICATION_CREDENTIALS`에 파일 경로를 두면 기존처럼 파일을 읽어 사용합니다. `GOOGLE_SERVICE_ACCOUNT_JSON`을 로컬 `.env.local`에 넣어도 동작합니다.

이렇게 설정하면 Vercel 빌드/런타임에 별도 파일 없이 환경 변수만으로 서비스가 동작합니다.
