# Marketing Simulator — Design Spec

**날짜**: 2026-04-26
**페이지 경로**: `/dashboard/marketing-sim`
**상태**: Draft (구현 시작 전)
**의존성**:
- W9 Phase 1 — `RevenueSnapshot` 스키마 (PR #14, 관측 ARPDAU baseline 입력)
- W9 Phase 3 — 실 retention curve (mock fallback 가능, full 가치는 머지 후)
- MMM Phase 2 — `cpi-benchmarks.ts` (이미 머지)

---

## 1. 목적 / 비목적

### 목적
"이 게임에 광고를 N달러 쓰면 90일 후 매출/ROAS는?" 질문에 단일 페이지로 답한다.

UA budget × CPI lookup → installs → W9 retention curve → DAU → 목표 ARPDAU → Revenue → ROAS / payback. 슬라이더 변경 시 클라이언트에서 즉시 재계산.

### 비목적
- LTV cohort attribution (어떤 채널이 얼마 기여했는가) — MMM 본 페이지 책임
- 다국가/다장르 동시 시뮬레이션 — v1은 단일 (country, genre, platform) 조합
- UA budget 시간 변동 — 일정 예산을 horizon 동안 일정하게 집행한다고 가정
- Real-time A/B 결과 반영 — 본 시뮬은 미래 예측, 실험 결과 반영은 별도 페이지

---

## 2. 사용자 시나리오

투자자 미팅 직전, "JP merge 시장에 월 30k USD 쓰면 어떻게 되나" 빠르게 확인:
1. `/dashboard/marketing-sim` 진입
2. Country=JP, Genre=merge, Platform=ios 선택 → CPI $4.20 자동 표시
3. UA budget 슬라이더로 1k USD/day → 일일 설치 ≈ 238 자동 표시
4. ARPDAU 슬라이더 — 관측치 $0.55 default, 목표 $0.65로 올려보기
5. 90일 ROAS 곡선이 바로 갱신, payback day 표시
6. P10/P50/P90 밴드로 retention 불확실성 시각화

---

## 3. 페이지 구조

### 3.1 URL & Navigation
- 경로: `/dashboard/marketing-sim`
- 사이드바 카테고리: `overview` (VC simulation, 투자 판정 옆)
- i18n key prefix: `marketing-sim.*`

### 3.2 Layout (3-row 카드)
```
┌─────────────────────────────────────────────────┐
│ Hero — 결론 한 줄 (예: "JP merge 1k$/d → 76d payback") │
└─────────────────────────────────────────────────┘
┌──────────────────────────┬──────────────────────┐
│ 입력 (좌, 1/3 폭)          │ KPI tiles (우, 2/3)   │
│ - Country / Genre / Pf    │ - Daily installs      │
│ - UA budget (slider)      │ - Day-30 ROAS         │
│ - 목표 ARPDAU (slider)    │ - Payback day         │
│ - CPI (read-only chip)    │ - 90d cumulative rev  │
└──────────────────────────┴──────────────────────┘
┌─────────────────────────────────────────────────┐
│ ROAS curve — P10/P50/P90 fan chart, day 1~90    │
│ y-axis: cumulative ROAS, ROAS=1 가로선 강조       │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ Revenue/DAU stacked area — 일별 revenue + DAU    │
│ 관측 ARPDAU vs 목표 ARPDAU 두 선 비교 (점선/실선)  │
└─────────────────────────────────────────────────┘
```

---

## 4. 입력

| 필드 | 타입 | 출처 | 비고 |
|---|---|---|---|
| `country` | `CountryCode` enum | `cpi-benchmarks.ts` | 25국가 |
| `genre` | `Genre` enum | 동일 | 8장르 |
| `platform` | `"ios" \| "android"` | 동일 | — |
| `uaBudgetUsdPerDay` | number, [10, 100_000] | UI slider + numeric input | log scale slider |
| `targetArpdauUsd` | number, [0.05, 5.0] | UI slider | default = `RevenueSnapshot.arpdau.perGame[gameId]` (관측치) |
| `gameId` | string | Game selector (Zustand `useSelectedGame`) | poko_merge default |
| `horizonDays` | 90 | 상수 (v1) | 향후 30/60/90/180 토글 |

**CPI는 입력이 아닌 derived chip**: `lookupCpiDetailed(country, genre, platform)` → 표시 + `usedFallbackGenre`이면 ⚠ 배지.

---

## 5. 계산 모델

### 5.1 Pure 함수 (client-side)
모든 계산은 입력 변화 시 동기 재실행. Web Worker 불필요 (90일 forecast = 90 × 11 retention point = O(1000) 연산).

### 5.2 핵심 식
```
CPI = lookupCpi(country, genre, platform)              [USD/install]
installs_per_day = uaBudgetUsdPerDay / CPI             [installs/day, constant]
spend_per_day = uaBudgetUsdPerDay                      [USD/day, constant]

retention(a) = W9 retention curve at age a (P10/P50/P90)

DAU_p{10,50,90}(t) = Σ_{a=1..t} installs_per_day × retention_p{10,50,90}(a)
                     + installs_per_day                 [day-0 cohort = 100%]

revenue_p{10,50,90}(t) = DAU_p{10,50,90}(t) × targetArpdauUsd

cumulative_revenue_p{10,50,90}(t) = Σ_{d=1..t} revenue_p{10,50,90}(d)
cumulative_spend(t) = spend_per_day × t

ROAS_p{10,50,90}(t) = cumulative_revenue_p{10,50,90}(t) / cumulative_spend(t)

payback_day_p50 = min(t : ROAS_p50(t) ≥ 1) ?? null
```

### 5.3 Retention 보간
W9 retention snapshot은 11개 keypoint (1, 3, 7, 14, 30, 60, 90, 180, 365, 730, 1095). 일별 retention은:
- power-law fit (`r(a) = α × a^(-β)`) on log-log keypoints
- 또는 인접 keypoint 사이 log-linear 보간 (간단, 충분한 정확도)

v1: log-linear 보간 (간단, 시각적 차이 미미). power-law fit은 W9 Phase 3에서 cron handler가 직접 계산하면 keypoint 자체가 더 촘촘해져 본 페이지에선 보간 단순화 가능.

### 5.4 ARPDAU band
v1은 점추정만 (slider 단일 값). 향후 ARPDAU 분포 모델 도입시 `revenue_p{10,50,90}(t) = DAU_p50(t) × arpdau_p{10,50,90}` 형태로 분해 가능.

---

## 6. 출력

### 6.1 KPI tiles (4개)
- **일일 설치** = `installs_per_day` (rounded int)
- **Day-30 ROAS** = `ROAS_p50(30)` (% 표시, 1 = 100%)
- **Payback day** = `payback_day_p50` 또는 "90일 내 미회수"
- **90일 누적 매출** = `cumulative_revenue_p50(90)` (USD)

### 6.2 ROAS Fan Chart
- x: day 1~90, y: cumulative ROAS
- P50 line + P10/P90 band
- ROAS=1 가로 reference line (signal-positive 색)
- payback intersection이 P50 곡선과 만나는 점에 마커

### 6.3 Revenue / DAU Comparison
- 일별 revenue (P50 only)
- 관측 ARPDAU 시나리오 vs 목표 ARPDAU 시나리오 두 선 비교 (delta band fill)
- y2 축에 DAU (중성 회색 선)

---

## 7. 데이터 의존성

| 소스 | 위치 | 본 페이지 사용 |
|---|---|---|
| Retention snapshot | `src/shared/api/data/lstm/retention-snapshot.json` | retention curve P10/P50/P90 |
| Revenue snapshot | `src/shared/api/data/lstm/revenue-snapshot.json` (PR #14) | ARPDAU 관측치 default |
| CPI benchmark | `src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json` | CPI lookup |
| 게임 메타 (genre 매핑) | `src/shared/store/game-settings.ts` | gameId → genre/country mapping |

Staleness 표시:
- retention snapshot 7일 stale → ROAS 차트 상단 경고 chip
- CPI benchmark 35일 stale → CPI chip 옆 ⚠ (`isBenchmarkStale`)
- revenue snapshot 7일 stale → ARPDAU slider 라벨에 "관측치 stale" 부기

---

## 8. Phase 분할

| Phase | 작업 | 의존 | LoC 추정 |
|---|---|---|---|
| 1 | `src/shared/api/marketing-sim/` 모듈 — types + 순수 compute 함수 + 단위 테스트 | PR #14 | ~250 |
| 2 | `src/widgets/marketing-sim/` UI 컴포넌트 (Controls, KpiTiles, RoasChart, RevenueCompareChart) | Phase 1 | ~400 |
| 3 | `src/app/(dashboard)/dashboard/marketing-sim/page.tsx` + i18n keys + sidebar nav | Phase 2 | ~150 |
| 4 | (선택) Smoke E2E + 시각 회귀 캡처 | Phase 3 | — |

각 Phase = 1 PR. Phase 1만 단독 머지 가능 (UI 미생성).

---

## 9. 향후 확장 (비-목적, v2+)

- **시간변동 budget**: budget을 30/60/90 day마다 변경 가능한 schedule로 입력
- **다국가/장르 mix**: budget을 여러 (country, genre) bucket에 split해 합산
- **Cohort fade-out vs ramp-up**: 캠페인 시작 후 첫 7일은 retention이 더 낮을 수 있음 (early-cohort penalty)
- **Confidence bands on ARPDAU**: AppsFlyer revenue events 분산을 ARPDAU 밴드로 변환
- **A/B 결과 통합**: 실험 ΔLTV가 retention/ARPDAU에 미치는 영향을 시뮬에 반영

---

## 10. 검증 기준 (Phase 별)

### Phase 1 (data layer)
- [ ] tsc --noEmit clean
- [ ] vitest: compute 함수 unit test (boundary: budget=0, CPI=null, retention 비어있음, payback 미발생)
- [ ] payback day 계산이 P50 ROAS=1 첫 일과 일치

### Phase 2~3 (UI)
- [ ] next build 성공, `/dashboard/marketing-sim` Static prerender
- [ ] 슬라이더 입력 변경 시 200ms 이내 차트 갱신 (60fps 기준)
- [ ] CPI fallback genre 발생 시 ⚠ 배지 노출
- [ ] retention 7일 stale 시 차트 상단 chip 노출
- [ ] i18n ko/en 모두 노출 라벨 존재
- [ ] 게임 셀렉터 변경 시 ARPDAU default가 해당 게임 관측치로 갱신

---

## 11. 결정 요약 (이 시점)

| 결정 | 선택 | 근거 |
|---|---|---|
| 단일 vs 다국가 | 단일 (v1) | 슬라이더 UX 단순화, 첫 출시 기준 |
| Horizon | 90일 고정 (v1) | mobile UA short cycle (3~6개월), VC sim과 차별 |
| ARPDAU band | 점추정 only (v1) | 시뮬은 가정값 — 분포보다 명료성 우선 |
| Compute 위치 | 100% client | Vercel function 호출 없음, 슬라이더 응답성 |
| 차트 컴포넌트 재사용 | 신규 (`RoasChart`, `RevenueCompareChart`) | 기존 `RunwayFanChart` 와 의미가 달라 차트 분리 권장 |
| Revenue snapshot 의존 | optional default-source | snapshot 없을 시 슬라이더 default $0.50 hardcode fallback |
