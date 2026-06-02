# 매매동향 OHLC 차트 → 캔들스틱 차트 변경 계획

**작성일**: 2026-06-03  
**대상**: `components/dashboard/ticker-detail/sections/trade-section.tsx`  
**브랜치**: 01_claude

---

## Context

종목 상세 페이지 "매매동향(KIS)" 섹션의 "주식현재가 일자별" 차트가 현재
시가·종가·고가·저가를 **4개 선(Line)**으로 그려 실제 주식 차트처럼 보이지 않는다.
이를 한국 주식 앱의 표준인 **캔들스틱 차트(봉차트)** 로 변경한다.

---

## 현황 분석

### 현재 구현 (`trade-section.tsx:63–114`)
- Recharts `LineChart` + 4개 `Line` (시가/고가/저가/종가)
- 데이터: `buildDailyOhlcChartData()` → `bodyHigh`, `bodyLow`, `isUp` 포함 (캔들스틱용 필드 이미 있음)

### 라이브러리 현황
- Recharts(^3.7.0)만 사용, lightweight-charts·ApexCharts 미설치
- **Recharts는 캔들스틱을 네이티브 지원하지 않음**
- **의존성 추가 없이** Recharts `ComposedChart` + 커스텀 Shape으로 구현 가능

### 기존 유틸 재사용 가능
- `buildDailyOhlcChartData()` → `chart-utils.ts:197`
  - 이미 `bodyHigh`, `bodyLow`, `isUp` 반환 → 캔들스틱에 그대로 활용
  - `volume` 미추출 (KIS 응답에 `acml_vol` 있음) → 추가 필요

---

## 구현 계획

### 수정 1: `chart-utils.ts` — `buildDailyOhlcChartData` 확장

**추가 반환 필드**:
```typescript
volume: number;           // 거래량 (acml_vol)
candleBottom: number;     // = bodyLow (스택 바 하단 앵커용)
candleBodyHeight: number; // = max(bodyHigh - bodyLow, priceRange * 0.001)
                          //   → doji(시가=종가) 시 픽셀 크기 0 방지
```

doji 처리: 전체 가격 범위의 0.1%를 최소 bodyHeight로 설정 → 스케일 계산 안전.

### 수정 2: `trade-section.tsx` — 캔들스틱 차트로 교체

#### 커스텀 캔들스틱 Shape 구현 원리

Recharts **스택 바 + 커스텀 Shape** 방식:

```
ComposedChart data=[{ candleBottom, candleBodyHeight, ...ohlc }]
  ├─ Bar stackId="c" dataKey="candleBottom"   fill="transparent"  // 투명 하단 스페이서
  └─ Bar stackId="c" dataKey="candleBodyHeight" shape={CandlestickBar}
```

`CandlestickBar`가 받는 props:
- `x`, `y`, `width`, `height` → 캔들 몸통의 SVG 좌표 (스택 결과)
- `payload` → 원본 데이터 (`high`, `low`, `bodyHigh`, `bodyLow`, `isUp`)

스케일 계산 (몸통 props → 위아래 꼬리 위치):
```
pixelsPerUnit = height / (bodyHigh - bodyLow)
upperWickTop   = y - (high - bodyHigh) * pixelsPerUnit
lowerWickBottom = y + height + (bodyLow - low) * pixelsPerUnit
```

SVG 렌더링:
```tsx
<g>
  <line x1={cx} x2={cx} y1={upperWickTop} y2={y} stroke={color} />      {/* 위 꼬리 */}
  <rect x={bodyX} y={y} width={bodyW} height={height} fill={color} />    {/* 몸통 */}
  <line x1={cx} x2={cx} y1={y+height} y2={lowerWickBottom} stroke={color} /> {/* 아래 꼬리 */}
</g>
```

색상: 상승(`isUp`)→ `hsl(var(--color-profit))`, 하락 → `hsl(var(--color-loss))`

#### 거래량 차트 추가 (선택적 개선)

캔들스틱 차트 하단에 거래량 바를 추가:
- 같은 `ComposedChart` 안에 `yAxisId="vol"` 보조 축 사용
- 높이를 낮게 설정해 주가 차트 하단 20%에 작게 표시
- 색상: 상승일 `--color-profit/30`, 하락일 `--color-loss/30`

#### 섹션 타이틀 변경
- 기존: `주식현재가 일자별 (최근 30일) — 시가·종가·고가·저가`
- 변경: `주가 차트 (최근 30일) — 캔들스틱`
- 부제: `빨강: 상승봉, 파랑: 하락봉` (한국 색상 규칙)

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|---------|
| `components/dashboard/ticker-detail/chart-utils.ts` | `buildDailyOhlcChartData` — volume/candleBottom/candleBodyHeight 추가 |
| `components/dashboard/ticker-detail/sections/trade-section.tsx` | LineChart → ComposedChart + CandlestickBar 커스텀 Shape |

재사용 유틸:
- `buildDailyOhlcChartData()` — `chart-utils.ts:197` (확장만)
- `ohlcYDomain()` — `chart-utils.ts:185` (그대로 사용)
- CSS 변수 `--color-profit`, `--color-loss` — globals.css (그대로)

---

## 검증 전략

```bash
npx tsc --noEmit
npm run build
```

**수동 확인**:
1. 종목 상세 페이지 "매매동향(KIS)" 섹션 → 캔들스틱 차트 표시
2. 상승봉(빨강), 하락봉(파랑) 색상 확인
3. 꼬리(위·아래) 렌더링 확인
4. 툴팁: 날짜 + 시가·고가·저가·종가 표시
5. 다크/라이트 모드 모두 확인
