# VC Simulator Product Pivot — Design

**Date:** 2026-04-29
**Status:** Approved (Mike)
**Author:** Claude (brainstormed with Mike)
**Predecessor specs:**
- `2026-04-24-vc-simulation-design.md` (VC sim 컴포넌트·스키마 원형)
- `2026-04-27-vc-sim-typography-hierarchy-design.md`
- `2026-04-27-vc-sim-insights-design.md`
- `2026-04-27-ua-revenue-composite-layer-design.md`

---

## 1. Why — 제품 정체성 재정의

**Before:** Project Compass는 *관찰형 대시보드* 였다. 6개 페이지 (Executive Overview, Market Gap, MMM, PRISM, VC Simulation, Connections), 24개 차트 위젯이 병렬로 노출되어, 사용자는 "이 게임이 어떻게 됐다"를 *읽는* 것이 목적.

**After:** Project Compass는 *조작형 자본 배분 시뮬레이터* 다. 첫 화면은 슬라이더, 결과 차트는 슬라이더의 함수, 그 외 모든 분석(베이지안, MMM, 시장 비교)은 시뮬의 *재료*로 흡수되어 평소엔 보이지 않는다.

> **한 문장 정의:**
> "Project Compass = 게임 자본 배분 시뮬레이터. 슬라이더를 만지면 1년 후 자본·매출·런웨이가 어떻게 바뀌는지 보여준다. 그 시뮬레이션의 기본 가정은 우리 게임 데이터 + 시장 데이터로 자동 채워진다."

이 변화는 단순 IA 재배치가 아니라:
- **위젯의 정체성**이 바뀐다 (예: RevenueForecast = "예측 결과" → "조작 가능한 가정값").
- **서비스 카테고리**가 바뀐다 (관찰형 → 조작형).
- **사용자 동선**이 바뀐다 (멀티 페이지 탐색 → 한 화면 조작).

---

## 2. Out of Scope (이번 라운드 안 함)

- **PRISM × LTV 통합** — 다음 챕터에서 "3가지 대표 시나리오"로 합쳐질 예정. 본 라운드는 PRISM 페이지를 *사이드바에서만* 숨기고 코드/라우트는 보존.
- **Connections 페이지** — 계정 연동은 시뮬레이터의 일부가 아니라 백엔드 설정. 사이드바 위치, 페이지 자체, 코드 모두 *그대로* 유지.
- **Crawler / AppsFlyer 데이터 파이프라인** — 백엔드 데이터 수집 로직은 변경 없음. UI 상의 *소비 방식*만 변경.

---

## 3. Information Architecture

### Before
```
/dashboard               Executive Overview
/dashboard/market-gap    Bayesian Prior/Posterior
/dashboard/mmm           Marketing Mix
/dashboard/prism         PRISM (LTV)
/dashboard/vc-simulation 자본 시뮬레이터
/dashboard/connections   AppsFlyer 연동 관리
```

### After
**원칙: 기존 URL은 모두 보존.** 외부 링크·북마크 호환 + 코드 보존이 목적. 사이드바 노출만 정리.

| 라우트 | 사이드바 노출 | 역할 |
|---|---|---|
| `/dashboard` | ✅ ◎ Dashboard | **VC 시뮬레이터 = 제품 그 자체.** 입력 슬라이더 + 결과 보드 + 펼침 3종. |
| `/dashboard/connections` | ✅ ⚙ Settings → Connections | 그대로. 백엔드 설정. |
| `/dashboard/market-gap` | ❌ 숨김 | URL 보존. 펼침의 "전체 화면으로 보기" 링크에서만 진입. |
| `/dashboard/mmm` | ❌ 숨김 | URL 보존. Channel drawer의 "전체 화면" 링크에서만 진입. |
| `/dashboard/prism` | ❌ 숨김 | URL/코드 보존. 다음 챕터에 부활. |
| `/dashboard/vc-simulation` | ❌ 숨김 | URL 보존 + `/dashboard`로 301 리다이렉트 (북마크 호환). |

### 사이드바 변화

```
Before                           After
─────────────                    ─────────────
Overview                         ◎ Dashboard
Market Gap                       ─────────────
MMM                              ⚙ Settings
PRISM                              └ Connections
VC Simulation
Connections
```

폭: 192px → 160px.

---

## 4. Widget 역할 재정의

핵심 원칙: **24개 차트 위젯 모두 코드 보존**. 각 위젯의 *마운트 컨텍스트*와 *props 입력 소스*만 바꾼다.

| 위젯 | Before role | After role |
|---|---|---|
| HeroVerdict / PortfolioVerdict | "이 게임/포트폴리오 상태 = X" | **시뮬 출력 헤로**: "이 자본 배분이면 결정 = Invest/Hold/Reduce" |
| RevenueForecast | 예측 결과 차트 | **시뮬 베이스라인** — 슬라이더 안 만진 출발 라인. 슬라이더 변경 시 위/아래로 흔들리는 라이브 차트 |
| PriorPosteriorChart | 독립 베이지안 시각화 | **불확실성 밴드 데이터 소스** — VC 결과의 P10/P50/P90 신뢰 구간을 채움 |
| KPICards | 현재 KPI 보드 | **델타 인디케이터** — "베이스라인 KPI" vs "시뮬 결과 KPI" ↑↓ |
| CapitalWaterfall | 자본 흐름 분석 | **시뮬 결과 보드** (역할 거의 동일, 입력은 시뮬에서) |
| RevenueVsInvest | 수익 vs 투자 | **시뮬 결과 보드** |
| RunwayFanChart / DualBaselineRunway | 런웨이 분석 | **시뮬 결과 메인 차트** (이미 VC sim 안에 있음) |
| MarketBenchmark / SaturationTrend / RankingTrend | 시장 분석 페이지 | **"시장과 비교" 토글 ON 시 분포 오버레이 데이터** |
| TitleHeatmap | 포트폴리오 히트맵 | **자본 분배 입력 UI** — 클릭으로 게임당 비중 조정 (입력으로 변신) |
| CohortHeatmap / RetentionCurve | 코호트 관찰 | **베이스라인 가정 출처** — 좌측 "가정값" 펼침 안에서만 |
| DataFreshnessStrip | 신선도 표시 | **시뮬 입력 신뢰도** — "N일 된 데이터로 시뮬 중" |
| MMM / CPI 차트 (CpiBenchmarkTable, CpiQuadrant 등) | MMM 페이지 본체 | **Channel drawer 안** — "시장 평균 CPI vs 우리" |
| 나머지 PRISM 차트 | PRISM 페이지 | **이번엔 손 안 댐** |

---

## 5. 화면 골격 (Desktop, ≥1024px)

```
┌─ TopBar (sticky, 56px) ──────────────────────────────────────────────┐
│  ◎ Compass   |  [poco merge ▾]  |  ● 신선 2일 전  |  □ 시장과 비교  │
└──────────────────────────────────────────────────────────────────────┘
┌─ Decision Sentence (Hero) ───────────────────────────────────────────┐
│  "12억 더 부으면 6개월 내 BEP, 신뢰도 72%."   [Invest 배지]            │
└──────────────────────────────────────────────────────────────────────┘
┌──────── 좌 40% ──────────────┬───────── 우 60% ────────────────────┐
│ INPUT PANEL                   │ RESULT BOARD                         │
│                               │                                      │
│ [Preset 탭]                   │  KPI Delta Strip (4개)               │
│ Horizon  ▰▰▰▰▱  12 mo         │  Dual Baseline Runway 차트            │
│ Fund     ▰▰▰▰▰▰▱▱▱▱  $1.2M    │  Cumulative ROAS 차트                 │
│ Channel Mix  FB/Google/TT     │  Capital Waterfall                    │
│ Offer Fields ▸                │  If-Then 카드 / Tornado 인사이트      │
│                               │                                      │
│ ── 가정값 출처 ▸              │                                      │
│ ⚠ 입력 검증 (있을 때만)       │                                      │
└───────────────────────────────┴──────────────────────────────────────┘
```

### Mobile (≤768px)

상하 stack: TopBar → Decision → InputPanel (collapsible) → KPI Delta → Result charts (수직). Drawer는 풀스크린 모달.

---

## 6. 펼침 (Drawer) 구조

| 트리거 | 위치 | 내용 | 컴포넌트 |
|---|---|---|---|
| TopBar **"시장과 비교"** 토글 ON | 결과 차트별 inline 오버레이 | 시장 분포 레이어 | PriorPosterior + MarketBenchmark + RankingTrend 의 데이터를 차트 위에 옅은 색으로 그림 |
| INPUT 좌측 **"가정값 출처 ▸"** | 좌측 인라인 펼침 (220px) | 조작 불가, 출처만 | RevenueForecast 미니 / CohortHeatmap 미니 / KPI baseline 카드 |
| INPUT **Channel Mix 클릭** | 우측 슬라이드 인 drawer (480px) | 채널 분해 + CPI 비교 | CpiBenchmarkTable + CpiQuadrant + ContributionDonut |
| TopBar **신선도 점 호버** | 툴팁 | 데이터 freshness | DataFreshnessStrip 내용 인라인 |

---

## 7. 데이터 흐름

```
useSelectedGame()                              ◀── 전역 게임 선택 (Zustand)
        │
        ▼
useGameData(gameId)                            ◀── mock + live AppsFlyer
        │ ─────► baseline KPI, retention, revenue, cohort
        ▼
useVcSim({ baseline, inputs })                 ◀── 핵심 훅
        │ inputs: preset, horizon, fund, channelMix, offer
        │ outputs: decision, deltaKpis, runwayPoints, roasPoints, waterfall
        ▼
<DecisionSentence /> <KPIDeltaStrip />
<DualBaselineRunwayChart /> <CumulativeRoasChart />
<CapitalWaterfall /> <IfThenCard /> <TornadoBar />
```

### 핵심 변경
- **현재 `/dashboard` 페이지에서** `useGameData()`를 직접 호출하던 위젯들이, **새 모델**에서는 `useVcSim()`이 만든 결과 객체의 *서브트리*를 prop으로 받는다.
- `RevenueForecast`는 더 이상 `useGameData().revenue`를 직접 읽지 않는다. `<RevenueForecast baseline={vcSim.baseline.revenue} simulated={vcSim.output.revenue} />` 형태.
- `useVcSim` 출력 스키마는 기존 `src/shared/api/vc-simulation/types.ts`의 `VcSimResult` Zod 스키마를 확장. 새 필드: `baseline.revenue`, `baseline.retention`, `baseline.kpi`, `simulated.*` (delta), `marketOverlay` (optional).

### `marketOverlay` 데이터
- TopBar "시장과 비교" 토글 ON 시 `useVcSim`이 `priorByGenre()` (`shared/api/prior-data.ts`) + `lookupCpi()` (`shared/api/cpi-benchmarks.ts`) 호출 → `marketOverlay = { revenueDistribution, cpiDistribution, retentionDistribution }` 추가.
- 토글 OFF 시 `marketOverlay = null`. 차트는 단일 라인.

---

## 8. 디자인 시스템 준수

| 토큰 | 적용 |
|---|---|
| Radius | 카드 `--radius-card` (4px), drawer/모달 `--radius-modal` (6px), 배지 `--radius-inline` (2px) |
| 배경 | 모노크롬 `--bg-0/1/2/3/4` 만 사용 |
| Signal 색 | Decision 배지 (Invest/Hold/Reduce), KPI delta 화살표, *그 외 금지* |
| Brand 색 | `--brand` — 시뮬 라인, 슬라이더 핸들, 포커스 링 |
| Baseline 색 | `--fg-2` — 베이스라인 라인, 시장 분포 (옅게) |
| Typography | Decision sentence: Instrument Serif (Latin) / Noto Serif KR. 숫자: Geist Mono `tabular-nums`. UI: Geist Sans / Pretendard |
| Motion | 슬라이더 → 차트 200ms ease. Drawer 슬라이드 240ms. `framer-motion` `layout` 속성 활용 |

`docs/superpowers/specs/2026-04-27-gameboard-design-system-alignment-design.md`에서 정렬한 토큰을 그대로 사용. 새 토큰 추가 없음.

---

## 9. 마이그레이션 단계

각 단계는 별도 PR. 단계 간 main이 항상 동작 가능 상태.

### Phase 1 — 사이드바 + 라우팅 정리 (1-2일)
- 사이드바에서 Market Gap / MMM / PRISM / VC Simulation 항목 제거
- Connections를 Settings 그룹으로 이동
- `/dashboard` 라우트는 *현재 vc-simulation 페이지의 콘텐츠*를 임시로 보여주는 thin wrapper로 교체 (`<VcSimulationContent />` import)
- `/dashboard/vc-simulation` → `/dashboard` 301 리다이렉트
- 기존 라우트(`/market-gap`, `/mmm`, `/prism`)는 살아있으나 진입 동선만 제거
- **검증:** Mike가 로컬에서 사이드바 단순화 + VC sim이 홈에 노출 확인

### Phase 2 — Decision Sentence + KPI Delta Strip + 골격 분할 (2-3일)
- `/dashboard` 페이지를 새 골격(좌 40% INPUT / 우 60% RESULT) 으로 재배치
- 기존 vc-simulation 컴포넌트들을 좌/우로 재배치
- `<DecisionSentence />` 위치 상단으로
- `<KPIDeltaStrip />` 신규 컴포넌트 (KPICards 재활용)
- **검증:** Mike가 슬라이더 만져 보고 결과가 즉시 반응하는 것 확인

### Phase 3 — 가정값 출처 펼침 + RevenueForecast 정체성 변경 (3-4일)
- 좌측 "가정값 출처 ▸" 펼침 추가
- `RevenueForecast` props 변경: `useGameData()` 직접 호출 제거, `baseline` prop 받음
- 미니 카드 형태 변종 추가 (collapsed view)
- 기존 `/dashboard` (Executive Overview) 의 RevenueForecast 사용 코드 정리
- **검증:** Mike가 펼침 동작 + 차트가 입력 가정으로 표시되는 의미론 확인

### Phase 4 — "시장과 비교" 토글 + 분포 오버레이 (3-4일)
- TopBar 토글 추가
- `useVcSim`에 `marketOverlay` 출력 확장
- Runway / Cumulative ROAS / KPI 차트에 시장 분포 레이어 추가 (옅은 `--fg-2`)
- 기존 PriorPosteriorChart / MarketBenchmark / RankingTrend 의 데이터 추출 helper만 재사용 (UI는 새 차트에 흡수)
- **검증:** Mike가 토글로 우리 vs 시장 비교 확인

### Phase 5 — Channel drawer + MMM 흡수 (2-3일)
- INPUT의 Channel Mix 카드 클릭 → 우측 drawer
- drawer 안에 CpiBenchmarkTable + CpiQuadrant + ContributionDonut 배치
- 기존 `/dashboard/mmm` 페이지는 drawer의 "전체 화면" 링크로만 진입
- **검증:** Mike가 채널 분해 동선 확인

### Phase 6 — 정리 (1일)
- 사용 안 하는 기존 Executive Overview 전용 코드 (PortfolioVerdict의 dashboard 위치 등) 제거
- 죽은 라우트의 `<head>` noindex
- README의 Dashboard Pages 섹션 업데이트
- CLAUDE.md §4 업데이트

총 예상: **2-3주**.

---

## 10. 테스트 전략

프로젝트의 lightweight test policy 따름 (memory: 통계/파이프라인은 unit + CLI dry-run 2층, golden snapshot 회귀는 사고 후에만).

### 필수
- `useVcSim` 단위 테스트 — 새 `marketOverlay` 케이스 추가
- `KPIDeltaStrip` 컴포넌트 — baseline vs simulated 차이 계산 검증
- `RevenueForecast` snapshot — props 변경 후 렌더 회귀 방지
- `DecisionSentence` — Invest/Hold/Reduce 분기 3개

### 선택
- E2E (Playwright) — 슬라이더 조작 후 결과 차트 변화 확인. 단, 현재 프로젝트에 E2E 인프라 없음. Phase 6 이후 별도 논의.

### 비-목표
- 기존 24개 차트 위젯의 시각 회귀 테스트 (golden snapshot) — 위젯 코드 변경이 *마운트 컨텍스트*만이라 시각 회귀 가능성 낮음.

---

## 11. Open Questions

1. **TopBar 토글 OFF가 기본인가, ON이 기본인가?** — 추천: OFF 기본. "시장과 비교"는 의식적 행동일 때 효과. 사용자가 비교를 안 켜면 시뮬에 집중.
2. **"가정값 출처" 펼침이 좌측 인라인 vs 우측 drawer?** — 추천: 좌측 인라인. 입력 패널과 같은 시야에서 "왜 이 베이스라인이 이 값인지" 즉시 확인 가능.
3. **`/dashboard/vc-simulation` 301 vs 410?** — 추천: 301. 외부 링크/북마크 호환. 6개월 후 410 검토.

위 3개는 Phase 1-2 진행하면서 Mike와 라이브로 결정.

---

## 12. 성공 기준

- 사이드바 항목 **2개** (Dashboard + Settings)
- `/dashboard` 진입 후 **3초 이내** 슬라이더 조작 가능
- 슬라이더 변경 시 결과 차트 **200ms 이내** 반응
- 비개발자에게 한 문장 ("슬라이더 만지면 자본·매출·런웨이 변화") 으로 제품 설명 가능
- 기존 24개 차트 위젯 **삭제 0개**, 마운트 컨텍스트만 변경
- PRISM × LTV 통합을 위한 *확장 지점* 보존 (Phase 1에서 PRISM 라우트 코드 그대로 둠)
