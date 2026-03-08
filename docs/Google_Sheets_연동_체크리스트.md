# Google Sheets 연동 체크리스트

Sheets에서 자료를 가져오지 못할 때 아래를 순서대로 확인하세요.

## 1. 환경 변수 (.env.local)

| 변수 | 설명 |
|------|------|
| `GOOGLE_SPREADSHEET_ID` | 스프레드시트 URL의 `/d/` 와 `/edit` 사이 문자열 (필수) |
| `GOOGLE_APPLICATION_CREDENTIALS` | **로컬 전용** — 서비스 계정 JSON 파일 경로 (예: `./my-stock-service-account.json`) |
| 또는 `GOOGLE_SERVICE_ACCOUNT_JSON` | **Vercel/한 줄** — 서비스 계정 JSON 전체를 한 줄 문자열로 |

- `GOOGLE_SPREADSHEET_ID`가 비어 있으면 매매내역을 가져오지 않고 빈 배열을 반환합니다.
- 인증은 **서비스 계정**만 사용합니다. (로그인용 Google OAuth2와 별개)

## 2. 서비스 계정 JSON 파일 (로컬)

- `GOOGLE_APPLICATION_CREDENTIALS`에 넣은 경로에 파일이 실제로 존재하는지 확인.
- Windows: 경로는 `./my-stock-service-account.json` 또는 `E:\apps\my-stock\my-stock-service-account.json` 형태로 절대 경로 가능.
- JSON 안에 `client_email`, `private_key` 필드가 있어야 합니다.

## 3. Google Cloud Console

- **Google Sheets API** 사용 설정: [API 및 서비스 → 라이브러리](https://console.cloud.google.com/apis/library) → "Google Sheets API" 검색 → 사용 설정.
- 서비스 계정은 **동일 프로젝트**에서 생성한 것을 사용해야 합니다.

## 4. 스프레드시트 공유

- Google Sheets에서 해당 스프레드시트를 연 뒤 **공유** 클릭.
- **공유 대상**에 서비스 계정 이메일(`client_email`, 예: `xxx@project-id.iam.gserviceaccount.com`)을 추가하고 **뷰어** 또는 **편집자** 권한 부여.
- 이 단계를 하지 않으면 403 또는 "권한 없음" 오류가 납니다.

## 5. 시트 탭 이름

- `GOOGLE_SHEET_NAME`(기본: `매매내역`)이 실제 시트 탭 이름과 일치하는지 확인.
- 한글 탭명이면 `매매내역`, 영문이면 `Sheet1` 등으로 맞춥니다.

## 6. 오류 메시지 확인

- **개발 모드**: `/api/sheets/transactions` 요청 시 503 응답 body에 `detail` 필드로 서버 오류 메시지가 포함됩니다.
- **터미널**: 서버 로그에 `[Sheets]` 로 시작하는 메시지로 토큰/API 오류가 출력됩니다.

### 자주 나오는 오류

| 메시지 | 대응 |
|--------|------|
| `Set GOOGLE_SERVICE_ACCOUNT_JSON (Vercel) or GOOGLE_APPLICATION_CREDENTIALS` | 위 1번·2번 확인 — 인증 변수 미설정 또는 파일 없음 |
| `Google OAuth2 token 403` / `unregistered callers` | GCP에서 Sheets API 사용 설정, 동일 프로젝트 서비스 계정 사용 |
| `Sheets API 403` | 스프레드시트를 서비스 계정 이메일과 **공유**했는지 확인 (4번) |
| `Sheets API 404` | `GOOGLE_SPREADSHEET_ID`와 시트 ID, 탭 이름 확인 |
