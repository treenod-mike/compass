# Gameboard Design System Alignment — Design Spec

- **Status**: Proposed
- **Date**: 2026-04-27
- **Owner**: Mike
- **Related**: gameboard repo (`treenod/gameboard`) 디자인 시스템

---

## 1. Background

Compass와 gameboard는 같은 회사의 분석 대시보드로, 둘 다 Toss Design System (TDS) 기반의 동일한 디자인 토큰·폰트·레이아웃 컴포넌트 위에 빌드되어 있다. 양쪽 모두 `LayoutWrapper` / `AppTopBar` / `CategorySidebar` 같은 동일한 네비게이션 패턴을 공유하지만, 각자 fork 후 독립적으로 진화하면서 다음과 같은 갭이 누적되었다.

- gameboard는 차트 카드(`chart-container`), KPI 카드(`metric-card`), 차트 툴팁(`custom-chart-tooltip`) 등을 표준 컴포넌트로 추출해 코드 중복을 제거.
- Compass는 위젯별로 `Card + ChartHeader + ExpandButton`을 직접 조립 중이라 24+개 차트 위젯 사이에 미세한 시각·동작 drift 가 존재.
- Compass에는 결정 OS 시그니처(`PortfolioVerdict`, Bayesian P10/P50/P90 fan, `MethodologyModal`, Rocko Ultra 워드마크 등) 가 있고, 이는 정체성이라 보존이 필요.

본 작업의 본질은 **"조립품(Compass 고유 위젯)은 그대로, 부품(차트 컨테이너·툴팁·KPI 카드)은 회사 표준으로 통일"** 이다.

---

## 2. Goals & Non-goals

### Goals

- 차트 24개와 KPI 카드의 시각·동작 일관성을 gameboard 표준 부품으로 끌어올린다.
- 양쪽에 모두 존재하는 navigation 컴포넌트의 drift 를 정리한다.
- Compass 정체성(브랜드 보라, Rocko Ultra 워드마크, 결정 OS 시그니처)은 보존한다.
- light/dark 양쪽 모드에서 회귀 없이 통과한다.

### Non-goals

- 페이지 콘텐츠나 정보 구조 변경 (Overview / Market Gap / MMM / VC Simulation / Connections / PRISM 페이지 그대로).
- Bayesian 통계, prior-data, AppsFlyer pipeline, Sensor Tower crawler 같은 도메인 로직 변경.
- gameboard의 페이지 구조나 정보 계층 차용.
- PNG export, 차트 단일화(toggle-chart), 차트 필터 표준화는 본 spec에서 제외 (Future Work 참조).

---

## 3. Inventory

### 3.1 보존 (Compass 고유 — 변경 없음)

| 카테고리 | 항목 |
|---|---|
| 페이지 | `/dashboard` (Overview) · `/dashboard/market-gap` · `/dashboard/mmm` · `/dashboard/vc-simulation` · `/dashboard/connections` · `/dashboard/connections/appsflyer` · `/dashboard/prism` |
| 차트 위젯 (24+) | `prior-posterior-chart` · `retention-curve` · `runway-fan-chart` · `revenue-forecast` · `revenue-vs-invest` · `capital-waterfall` · `ripple-forecast-fan` · `retention-shift-heatmap` · `cpi-benchmark-table` · `cpi-quadrant` · `contribution-donut` · `response-curve-card` · `reallocation-summary` · `saturation-meter` · `saturation-bar` · `saturation-trend` · `ranking-trend` · `market-benchmark` · `cyclic-update-timeline` · `experiment-bar` · `experiment-revenue` · `cohort-heatmap` · `budget-donut` · `action-roi-quadrant` · `action-timeline` · `causal-impact-panel` · `cumulative-impact-curve` · `rollout-history-timeline` |
| Dashboard 위젯 | `PortfolioVerdict` · `HeroVerdict` · `MarketHeroVerdict` · `KPICards` · `TitleHeatmap` · `MarketContextCard` · `DecisionStoryCard` · `DataFreshnessStrip` · `GameSelector` · `OverviewSummaryStrip` · `DashboardToolbar` · `CurrentMarketChip` · `DateRangePicker` |
| 브랜드/유틸 | `CompassLogo` (+ Rocko Ultra wordmark) · `MethodologyModal` · `DecisionSurface` · `PageTransition` · `MotionCard` · `InfoHint` |
| 도메인 | `shared/lib/bayesian-stats` · `shared/api/prior-data` · AppsFlyer post-registration pipeline · Sensor Tower crawler · CPI benchmark crawler |

### 3.2 차용 (gameboard → Compass)

| gameboard 컴포넌트 | Compass 적용 후 | 효과 |
|---|---|---|
| `shared/ui/chart-container` | 24+ 차트 카드 래퍼 표준화 — Compass의 `Card + ChartHeader + ExpandButton` 조합을 단일 컨테이너로 합체 | 코드 중복 제거, 차트 카드 일관성 향상 |
| `shared/ui/custom-chart-tooltip` | Compass `ChartTooltip` 통합 또는 대체 | 툴팁 디자인 동기화 |
| `shared/ui/metric-card` | `KPICards` 의 카드 비주얼 표준화 (`metric-card`를 내부에서 사용) | 숫자 카드 톤 일관성 |

### 3.3 Drift sync (양쪽에 존재)

- `widgets/navigation/ui/layout-wrapper.tsx`
- `widgets/navigation/ui/app-top-bar.tsx`
- `widgets/navigation/ui/category-sidebar.tsx`
- `widgets/navigation/ui/brand-and-product.tsx`
- `widgets/navigation/ui/category-tabs.tsx`
- `widgets/navigation/ui/sidebar-footer.tsx`
- `shared/ui/page-header.tsx`
- `styles/globals.css` (TDS 토큰)

### 3.4 충돌 해소

| 항목 | 결정 |
|---|---|
| Brand primary | **보라(#9128b4) 유지** — Compass 정체성 (gameboard는 네이비 #083687) |
| `PALETTE.cohort5` | `#9128b4` (purple-600, brand와 동일) → **`#b44bd7` (purple-400)** 로 톤 분리. 베이지안 P50 라인과 코호트5 라인의 시각 충돌 해소 |

---

## 4. Design Decisions

### Decision 1: Brand 보라 유지

**근거**: Compass = "VC 의사결정 OS" 라는 포트폴리오 메시지의 차별 시그널. 회사 일관성은 폰트(Pretendard + Tossface), 팔레트(TDS green/grey/blue/red/orange/yellow/teal/purple 50~900), 레이아웃(AppTopBar + CategorySidebar) 으로 이미 충분히 확보됨.

**적용 범위**: `--primary` · `--ring` · `--brand-line` · `--sidebar-primary` · `--theme-btn-color` · `--theme-tooltip-bg` · `--abtest-color-0` 7개 토큰 + `PALETTE.p50` · `PALETTE.revenue` 모두 보라 유지.

### Decision 2: Cohort5 톤 분리 (#b44bd7)

**근거**: 현재 `PALETTE.cohort5 = #9128b4` 가 brand 보라와 동일 hex 라, 보라 P50 베이지안 라인 위에 코호트5 라인이 겹치면 시각적 분리가 안 된다. 한 단계 밝은 `purple-400 (#b44bd7)` 로 옮기면 brand=600 / cohort=400 의 톤 계층이 생긴다.

**적용 범위**: `src/shared/config/chart-colors.ts` 의 `PALETTE.cohort5` 한 줄. 코호트5 사용 위젯(`retention-curve`, `cohort-heatmap`, `prior-posterior-chart` 등) 시각 회귀 검증.

### Decision 3: chart-container 도입

**근거**: 현재 24+ 차트는 위젯별로 `<Card>` + `<ChartHeader>` + `<ExpandButton>` + `useChartExpand` + `useGridLayout` 조합을 직접 만든다. gameboard의 `chart-container` 는 이 조합을 표준 wrapper 로 추상화해 중복 제거 + 일관성을 동시에 잡는다.

**적용 범위**: `src/shared/ui/chart-container/index.tsx` 신규 (gameboard 패턴 차용). 24+ 차트 위젯 한 번씩 마이그레이션. 기존 `ChartHeader` / `ExpandButton` 은 chart-container 내부 구현으로 흡수되거나 alias 로 호환 유지.

**호환성**: 기존 `ChartHeader` props (title, subtitle, info, expand 등) 를 그대로 받아 위젯 측 변경을 최소화한다.

### Decision 4: custom-chart-tooltip 도입

**근거**: Compass 의 `ChartTooltip` 은 차트별로 호출 패턴이 약간씩 달라 통일도가 낮다. gameboard 의 `custom-chart-tooltip` 은 Recharts content prop 호환 + Compass 의 디자인 토큰 (TDS) 으로 그려져 있어, 그대로 도입하면 24+ 차트 툴팁이 한 패턴으로 정렬된다.

**적용 범위**: `src/shared/ui/custom-chart-tooltip/index.tsx` 신규 도입. 기존 `ChartTooltip` 은 deprecated → custom-chart-tooltip 으로 점진 마이그레이션.

### Decision 5: metric-card 도입

**근거**: `KPICards` 는 portfolio (6개) / single-game (4개) 두 변형을 갖는데 카드 레이아웃·간격·타이포가 위젯 내부에서 직접 정의되어 있다. gameboard 의 `metric-card` 는 라벨/값/델타/sparkline 슬롯이 표준화된 단일 컴포넌트라, 이를 내부 구현으로 채택하면 카드 비주얼이 자동으로 회사 표준에 맞춰진다.

**적용 범위**: `src/shared/ui/metric-card/index.tsx` 신규. `widgets/dashboard/ui/kpi-cards.tsx` 가 내부에서 `metric-card` 사용.

### Decision 6: Navigation drift sync

**근거**: 6개 navigation 컴포넌트 + `page-header` 가 양쪽에 있고 코드 라인 수도 거의 같다 (예: `category-sidebar.tsx` Compass 259 vs gameboard 261). 하지만 미세 drift 가 누적될 가능성이 있어 전체 diff 후 의미 있는 차이만 흡수한다. **단, brand 보라 7개 토큰은 절대 보존**.

**Diff 정렬 규칙**:
1. gameboard 측이 더 뒤에 update 된 코드 → Compass 로 흡수.
2. Compass 측에만 있는 분기 (Compass 도메인 의존: `useGameData`, `MethodologyModal` 등) → 보존.
3. 색상 토큰 사용처는 절대 hex 가 아닌 CSS var 로 통일 (이미 그러함 — 검증).

---

## 5. Architecture Map (변경 대상)

### 추가될 파일

```
src/shared/ui/chart-container/index.tsx         (신규)
src/shared/ui/custom-chart-tooltip/index.tsx    (신규, Compass에 같은 이름 디렉토리 있음 — 통합 검토)
src/shared/ui/metric-card/index.tsx             (신규)
```

### 수정될 파일

```
src/styles/globals.css                          (drift sync, 토큰 정렬)
src/shared/config/chart-colors.ts               (PALETTE.cohort5 → #b44bd7)
src/widgets/navigation/ui/layout-wrapper.tsx    (drift sync)
src/widgets/navigation/ui/app-top-bar.tsx       (drift sync)
src/widgets/navigation/ui/category-sidebar.tsx  (drift sync)
src/widgets/navigation/ui/brand-and-product.tsx (drift sync)
src/widgets/navigation/ui/category-tabs.tsx    (drift sync)
src/widgets/navigation/ui/sidebar-footer.tsx    (drift sync)
src/shared/ui/page-header.tsx                   (drift sync)

src/widgets/charts/ui/*.tsx                     (24+ 파일 — chart-container 마이그레이션)
src/widgets/dashboard/ui/kpi-cards.tsx          (metric-card 사용)
src/shared/ui/chart-header.tsx                  (chart-container 내부로 흡수 또는 deprecated)
src/shared/ui/expand-button.tsx                 (chart-container 내부로 흡수)
src/shared/ui/chart-tooltip.tsx                 (custom-chart-tooltip 으로 대체 또는 deprecated)
```

### 보존되는 파일 (변경 없음)

- 모든 페이지 (`src/app/(dashboard)/dashboard/**/page.tsx`)
- 도메인 로직 (`src/shared/lib/bayesian-stats/**`, `src/shared/api/**`)
- 결정 OS 시그니처 (`src/shared/ui/decision-surface.tsx`, `src/shared/ui/methodology-modal.tsx`, `src/shared/ui/page-transition.tsx`, `src/shared/ui/compass-logo.tsx`)

---

## 6. Phased Implementation

각 Phase 는 **독립 PR** 로 분리해 회귀 위험을 최소화한다.

### Phase 1: 토큰 sync + cohort5 분리 (0.5일)

- `globals.css` 의 TDS 토큰을 gameboard 와 diff 후 의미 있는 drift 만 정렬. brand 7개 토큰 보존.
- `chart-colors.ts` 의 `PALETTE.cohort5` 를 `#b44bd7` 로 변경.
- 영향 위젯 시각 검증: `retention-curve`, `cohort-heatmap`, `prior-posterior-chart`, `revenue-forecast` 등 cohort5 쓰는 차트.

### Phase 2: Navigation drift sync (0.5일)

- 6개 navigation 컴포넌트 + `page-header` 를 gameboard 최신과 diff.
- 의미 있는 drift 만 가져오고 brand-purple 보존.
- light/dark 모드 양쪽에서 사이드바·상단바 시각 검증.

### Phase 3: chart-container + custom-chart-tooltip 도입 (2~3일)

1. `src/shared/ui/chart-container/index.tsx` 신규 — gameboard 패턴 차용, props는 기존 `ChartHeader` 와 호환되게 설계.
2. `src/shared/ui/custom-chart-tooltip/index.tsx` 신규.
3. 24+ 차트를 한 번씩 chart-container 로 마이그레이션. 기존 `ChartHeader` / `ExpandButton` / `ChartTooltip` 호출은 wrapper 가 흡수.
4. 마이그레이션 완료 후 deprecated 컴포넌트 제거 또는 alias 로 유지 결정.

### Phase 4: metric-card 도입 + KPICards 마이그레이션 (0.5일)

- `src/shared/ui/metric-card/index.tsx` 신규.
- `widgets/dashboard/ui/kpi-cards.tsx` 가 내부에서 `metric-card` 사용.
- portfolio 6장 / single-game 4장 두 모드 모두 시각 검증.

### Phase 5: light/dark 회귀 검증 (0.5일)

- 모든 페이지 (Overview, Market Gap, MMM, VC Sim, Connections, PRISM) 를 light/dark 양쪽에서 한 번씩 본다.
- chart-1~20 토큰을 쓰는 차트 24+개의 색이 양쪽 모드에서 의도대로 나오는지 확인.

---

## 7. Risks & Rollback

| 위험 | 완화 |
|---|---|
| chart-container 마이그레이션 중 일부 차트의 expand/tooltip 동작 회귀 | Phase 3 를 PR 1개로 묶지 않고 차트 묶음 단위(예: market-gap 4개 → revenue 6개 → action 3개 …) 로 sub-PR 분할. 각 sub-PR 마다 타깃 페이지 시각 회귀 확인 |
| navigation drift sync 가 의도치 않게 사이드바 동작 변경 | Phase 2 PR 머지 전 dev server 에서 모든 페이지의 사이드바 active 표시·collapse 동작·route loading toast 직접 확인 |
| cohort5 톤 변경이 차트 의미를 바꿈 (예: "5번 코호트가 항상 진한 보라" 라는 mental model) | `chart-colors.ts` 한 줄 변경이라 롤백 즉시. Phase 1 머지 후 24h 이내에 Mike 가 차트 페이지 한번 보고 OK/되돌리기 결정 |
| brand 보라가 다크 모드에서 contrast 부족 | gameboard 의 `--primary` 다크값은 `#f9fafb` (화이트). Compass 도 다크에서 brand 를 어떻게 표현할지 globals.css 에서 명시 (현재 `.dark` 블록의 `--primary` 토큰 검토 후 결정) |

### Rollback 전략

- Phase 1, 4 는 단일 토큰/컴포넌트 변경이라 PR revert 로 즉시 복구.
- Phase 2 는 6개 컴포넌트 묶음이라 sub-commit 단위로 revert 가능.
- Phase 3 는 sub-PR 단위 revert. chart-container 자체는 보존하되 위젯별 마이그레이션만 되돌릴 수 있게 wrapper 호환성 유지.

---

## 8. Testing Strategy

- **Unit**: chart-colors 의 새 hex 값에 대한 snapshot 테스트는 추가하지 않음 (Compass 컨벤션: 통계/색 토큰은 시각 검증으로 충분, golden snapshot regression 은 회귀 사고 후 추가).
- **Type check**: `npx tsc --noEmit` 모든 Phase 통과.
- **Vitest**: 기존 차트·위젯 테스트가 새 chart-container/metric-card props 로 깨지지 않는지 확인.
- **수동 시각 회귀**: 각 Phase 종료 시 Mike 가 dev server 에서 영향 페이지를 light/dark 양쪽으로 한 번씩 확인.

---

## 9. Future Work

본 spec 범위 밖이지만 후속 spec 으로 분리 가능한 항목.

- **`downloadable-chart` (PNG export)** — gameboard 의 `shared/ui/downloadable-chart` 풀 패키지 (provider, registry, capture-refs, dialog). 포트폴리오용 차트 export 기능.
- **`chart-filters` 표준화** — 차트별 필터 컨트롤 패턴 통일.
- **`toggle-chart` 도입** — Bar/Line/Area 전환이 의미 있는 차트(`revenue-forecast`, `experiment-revenue` 등) 에 한해 도입.
- **표준 입력 컴포넌트 차용** — `button-group`, `multi-select`, `date-picker-input`, `alert`, `accordion` 등 gameboard 의 표준 라이브러리.
- **`chart-guide` 페이지 도입** — gameboard 처럼 디자인 시스템 데모 페이지를 `/dashboard/design-guide` 같은 경로로 추가.

---

## 10. References

- gameboard repo: `treenod/gameboard` (디자인 시스템 출처)
- gameboard 차트 가이드: `docs/guidelines/05-chart-components.md` (gameboard 측)
- Compass CLAUDE.md `§6 Design System` (현재 디자인 토큰·radius·signal 색 정의)
- 기존 토큰 마이그레이션 메모: 2026-04-20 Phase 4/5a 차트 팔레트·타이포 TDS 마이그레이션
