# UA-spend × LSTM-revenue Composite Layer — Real ROAS / Payback KPI

**Date**: 2026-04-27
**Status**: Spec — pending implementation
**Source**: brainstorming session (4 clarifying rounds, options 1/2/3 chosen)
**Predecessors**:
- `2026-04-27-lstm-phase-2-retention-forecast-design.md` (LSTM revenue forecast pipeline)
- `2026-04-27-vc-sim-benchmark-vs-actual-gap-design.md` (cohort UA spend / LTV/CPI precedent)
- `2026-04-23-appsflyer-post-registration-workflow-design.md` (cohort summary contract)

---

## 1. Why this spec exists

The Executive Overview KPI cards (`kpi.roas`, `kpi.payback`) and the HeroVerdict / PortfolioVerdict `payback{p10,p50,p90}` confidence band currently render **mock-only** values from `mock-data.ts` (`roas: 142%`, `payback: 47d`, `payback band: {35,44,58}`). Meanwhile two real data lanes have already been built and merged:

- **Cohort UA spend** — AppsFlyer aggregation now emits `cohortSummary.spend.totalUsd` per game (USD pass-through + KRW conversion; JPY/EUR fall through as `null`).
- **LSTM revenue forecast** — `revenue-snapshot.json` carries per-game daily `revenueP10/50/90` curves with a 14-day ARPDAU window and trailing-14d-mean install assumption.

The missing piece is the compute layer that **splices the two together** to compute real cumulative ROAS and payback day, surfaces a 4-state status machine (real / insufficient / fxUnsupported / mock), and exposes a single hook so the KPI cards and the verdict-band widgets always show consistent numbers.

---

## 2. Decisions (locked from brainstorming)

### 2.1 Surface scope (Q1 = B)
First adopters: **KPI cards (`kpi.roas`, `kpi.payback`)** + **HeroVerdict / PortfolioVerdict `payback{p10,p50,p90}` band**. TitleHeatmap row deferred — only one game today (poco), low marginal value.

### 2.2 Fallback gating (Q2 = B)
Real values surface only when **both**: `basisDays ≥ 14` AND `!isRevenueSnapshotStale(now)`. Otherwise the result object exposes the caller-supplied `mockFallback` plus an ML1/ML2 freshness badge. This matches the existing 7-day staleness threshold the LSTM Phase 4 work already established and avoids false precision when ARPDAU's 14-day window is ahead of cohort observation.

### 2.3 Cohort definition (Q3 = A)
"Payback X days" means: **trailing 14-day install cohort recouping its own UA spend**, measured per-install. This aligns the denominator (`spend / installs = CPI`) and numerator (`per-install cumulative revenue`) on the same 14-day window the LSTM ARPDAU/installsAssumption uses, so there is no time-axis mismatch.

### 2.4 Splice mechanic (Q4 = B)
Cumulative revenue at day `d` is built by **splicing** observed per-install revenue (from `cohortSummary.revenue.daily`) for `d ≤ basisDays`, then extending with LSTM forecast incremental for `d > basisDays`. This delivers the "data comes in → KPI corrects automatically" behavior Mike asked for, even before the LSTM snapshot rebuild cron lands (deferred priority 4).

### 2.5 Module placement (Option 1)
A new domain folder `src/shared/api/composite/` hosts the cross-cutting compute. The thin React hook lives at `src/widgets/dashboard/lib/use-real-kpi.ts`. Same pattern as `vc-simulation/`: pure compute is testable in vitest with no React/AppsFlyer/LSTM imports.

---

## 3. Architecture

### 3.1 File tree

```
src/shared/api/composite/                       (NEW)
├── roas-payback.ts                             pure compute
├── types.ts                                    input/output types
└── __tests__/roas-payback.test.ts              vitest unit tests

src/widgets/dashboard/lib/
└── use-real-kpi.ts                             (NEW) thin React hook

src/widgets/dashboard/ui/kpi-cards.tsx          MODIFY — useRealKpi result overrides ROAS/payback
src/widgets/dashboard/ui/hero-verdict.tsx       MODIFY — payback prop sourced from useRealKpi
src/widgets/dashboard/ui/portfolio-verdict.tsx  MODIFY — same as hero-verdict
src/app/(dashboard)/dashboard/page.tsx          MODIFY — call useRealKpi, pass result to widgets

src/shared/i18n/dictionary.ts                   MODIFY — 6 new keys for badge + tooltips
```

### 3.2 Data flow

```
   AppsFlyer cron (03:00 KST)              LSTM snapshot (deferred cron / placeholder)
   ────────────────────────                ──────────────────────────────
   cohortSummary (Vercel Blob)             revenue-snapshot.json
     • cohorts[].uaSpendUsd                  • forecast[gameId].points[]
     • revenue.daily[]                         {day, revenueP10/50/90}
     • spend.totalUsd                        • arpdau.windowDays = 14
     • spend.homeCurrency                    • installsAssumption.method = trailing-14d-mean
            │                                          │
            └────────── computeRealKpi() ──────────────┘   (pure function)
                                │
                  RealKpiResult { roas{p10/50/90}, payback{p10/50/90},
                                  status, basisDays, freshness }
                                │
                  ┌─────────────┴──────────────┐
                  ↓                            ↓
              KPICards                   HeroVerdict / PortfolioVerdict
              (top-line value + badge)   (p10/p50/p90 confidence band)
```

### 3.3 FSD layer compliance

- `shared/api/composite/` lives in **shared** layer. Its imports of `shared/api/lstm/` and `shared/api/appsflyer/` are sibling-shared imports (allowed).
- `widgets/dashboard/lib/use-real-kpi.ts` lives in **widgets** layer. Imports `shared/api/composite/`, `shared/api/lstm/`, `shared/api/appsflyer/` — all flowing widgets → shared (correct direction).
- No widget-to-widget dependency: KPICards and HeroVerdict never import each other; both receive their state from `dashboard/page.tsx` after the hook call.

---

## 4. Compute API

### 4.1 Input / output types

```ts
// src/shared/api/composite/types.ts
import type { CohortSummary } from "../appsflyer"
import type { RevenueSnapshot } from "../lstm/revenue-snapshot"

export type RealKpiInput = {
  gameId: string
  cohortSummary: CohortSummary | null
  revenueSnapshot: RevenueSnapshot
  mockFallback: {
    roas:    { p10: number; p50: number; p90: number }   // %
    payback: { p10: number; p50: number; p90: number }   // days
  }
  now?: Date
}

export type RealKpiStatus = "real" | "insufficient" | "fxUnsupported" | "mock"
export type RealKpiFreshness = "ML1" | "ML2" | null

export type RealKpiResult = {
  roas:    { p10: number; p50: number; p90: number }      // %
  payback: { p10: number; p50: number; p90: number }      // days (≤365 capped)
  status: RealKpiStatus
  basisDays: number                                        // observed cohort age (installs-weighted)
  observedRevenueUsd: number
  forecastRevenueUsd: number
  spendUsd: number | null                                  // null when fxUnsupported
  freshness: RealKpiFreshness
}
```

### 4.2 Function signature

```ts
// src/shared/api/composite/roas-payback.ts
export function computeRealKpi(input: RealKpiInput): RealKpiResult
```

`computeRealKpi` is fully synchronous and side-effect-free. The hook layer is responsible for fetching `cohortSummary` and reading `loadRevenueSnapshot()`; the function only does math.

### 4.3 Hook

```ts
// src/widgets/dashboard/lib/use-real-kpi.ts
"use client"
import { useMemo } from "react"
import { useLiveAfData } from "./use-live-af-data"
import { loadRevenueSnapshot } from "@/shared/api/lstm/revenue-snapshot"
import { computeRealKpi } from "@/shared/api/composite/roas-payback"
import type { RealKpiInput, RealKpiResult } from "@/shared/api/composite/types"

export function useRealKpi(
  gameId: string,
  mockFallback: RealKpiInput["mockFallback"],
): RealKpiResult {
  const { summary, state } = useLiveAfData()
  // Treat 'backfilling' as if cohort isn't ready yet — keeps computeRealKpi pure
  const cohortSummary = state?.status === "backfilling" ? null : summary
  return useMemo(
    () => computeRealKpi({
      gameId,
      cohortSummary,
      revenueSnapshot: loadRevenueSnapshot(),
      mockFallback,
    }),
    [gameId, cohortSummary, mockFallback],
  )
}
```

---

## 5. Algorithm

### 5.1 Step 1 — Normalize inputs

```
spend         = cohortSummary.spend.totalUsd
observedRev   = cohortSummary.revenue.total.sumUsd
installs      = Σ cohortSummary.cohorts[].installs
basisDays     = installs-weighted mean(today − cohort.cohortDate)
```

Guard: if `installs === 0` or `spend === null` or `spend <= 0`, short-circuit to `status: 'insufficient'` with `mockFallback` (avoids NaN propagation). Otherwise:

```
cpi           = spend / installs
horizon       = revenueSnapshot.forecast[gameId].points.length      # 11..365 by schema
```

### 5.2 Step 2 — Per-install daily forecast curves

```
points = revenueSnapshot.forecast[gameId].points         # [{day, revenueP10/50/90}, …]
N      = revenueSnapshot.installsAssumption.perGame[gameId]
curve(d, band) = points[d−1][`revenue${band}`] / N        # per-install daily revenue
```

### 5.3 Step 3 — Splice rule (per band)

```
cumPerInstall(d, band) =
    if d ≤ basisDays:
        (observedRev / installs) × (d / basisDays)        # linear ramp
    else:
        (observedRev / installs)
        + Σ_{k = basisDays+1 .. d} curve(k, band)         # forecast tail
```

The linear ramp on the observed segment is a deliberate first-cut. Reconstructing day-by-day observed revenue per cohort would require a `cohort × day` matrix not present in `cohortSummary`. Payback days virtually always land in `d > basisDays` so ramp accuracy is not material to the result.

### 5.4 Step 4 — Cumulative ROAS at horizon

`horizon` is whatever the snapshot provides (typically 365, schema-bounded 11..365):

```
roas.p10 = cumPerInstall(horizon, P10) / cpi × 100
roas.p50 = cumPerInstall(horizon, P50) / cpi × 100
roas.p90 = cumPerInstall(horizon, P90) / cpi × 100
```

KPI card top-line uses `roas.p50` (rounded, `%` suffix).

### 5.5 Step 5 — Payback (inverted band mapping)

```
firstHit(band) = first d ∈ [1..horizon] where cumPerInstall(d, band) ≥ cpi   # null if none

payback.p10 = firstHit(P90)        # fast revenue → quick payback
payback.p50 = firstHit(P50)
payback.p90 = firstHit(P10)        # slow revenue → late payback
```

**Edge cases**:
- `firstHit(P50) === null` (no recovery within horizon): demote to `status: 'insufficient'` and return `mockFallback`.
- `firstHit(P10) === null` only: cap `payback.p90 = horizon` (UI may render `>${horizon}`).

### 5.6 Step 6 — Output packing

```
return {
  roas, payback,
  status,                                                     # see §6
  basisDays,
  observedRevenueUsd: observedRev,
  forecastRevenueUsd: cumPerInstall(horizon, P50) × installs − observedRev,
  spendUsd: spend,
  freshness,                                                  # see §6
}
```

When status ≠ `real`, `roas` and `payback` are populated from `mockFallback` so the UI never has to handle null values.

---

## 6. Status machine + ML badges

Evaluation is precedence-ordered; the first matching row wins.

| # | Condition | status | freshness |
|---|---|---|---|
| 1 | `cohortSummary === null` (AppsFlyer not connected) | `mock` | **ML1** |
| 2 | `state.status === 'backfilling'` (cohort accumulating) | `mock` | **ML1** |
| 3 | `spend.totalUsd === null` (FX unsupported, e.g. JPY/EUR) | `fxUnsupported` | **ML2** |
| 4 | `basisDays < 14` | `insufficient` | **ML1** |
| 5 | `isRevenueSnapshotStale(now)` (snapshot >7d) | `mock` | **ML2** |
| 6 | `forecast[gameId] === undefined` | `mock` | **ML2** |
| 7 | else | `real` | `null` |

Note: the hook reads `state.status` from `useLiveAfData` independently of `computeRealKpi`. To keep `computeRealKpi` pure, the hook handles row 2 by passing `cohortSummary = null` when `state.status === 'backfilling'` — same effect, simpler function contract.

### 6.1 Badge meaning

- **ML1** "Forecast Mock" — data not yet sufficient. Tooltip explains how many more days of cohort accumulation are needed.
- **ML2** "Stale" — known issue (snapshot stale, FX unsupported, game not in forecast). Tooltip names the specific cause.
- **null** — real value active, no badge rendered.

ML3 is intentionally not introduced (YAGNI; reuses the existing `useLiveAfData` two-tier vocabulary).

---

## 7. UI integration

### 7.1 KPICards

`KPICards` already accepts mocked `kpi.roas` / `kpi.payback` from `gameData.charts.kpis`. The change is one merging block immediately after `useLiveAfData`'s installs/revenue merge:

```tsx
const real = useRealKpi(gameId, mockFallback)

const merged = items.map(item => {
  if (item.labelKey === "kpi.roas")
    return { ...item, value: `${Math.round(real.roas.p50)}%` }
  if (item.labelKey === "kpi.payback")
    return { ...item, value: real.payback.p50 }
  return item
})
```

Badge rendering: if `real.freshness !== null`, render the small `ML1`/`ML2` chip in the same slot the existing live-AF badge uses. When both `useLiveAfData.badge` and `real.freshness` are set, prefer `real.freshness` (more specific to the KPI semantics).

### 7.2 HeroVerdict / PortfolioVerdict

Both widgets already take a `payback: {p10, p50, p90}` prop and feed it to `DecisionSurface.confidence`. No internal changes required. `dashboard/page.tsx` swaps the prop source:

```tsx
// before
<HeroVerdict ... payback={gameData.signal.payback} />

// after
const real = useRealKpi(gameId, {
  roas: gameData.charts.kpis.roas,
  payback: gameData.signal.payback,
})
<HeroVerdict ... payback={real.payback} />
<PortfolioVerdict ... payback={real.payback} />
```

The hardcoded 60-day target inside `PortfolioVerdict.tsx` (`Math.max(60 − payback.p50, 0)`) is left as-is. Externalizing the target is out of scope for this spec.

### 7.3 i18n keys (added to `dictionary.ts`)

```
kpi.realKpi.tooltip.real           "관측 X일 + LSTM Y일 예측 합성"
kpi.realKpi.tooltip.insufficient   "관측 X일 / 14일 누적 후 실값 전환"
kpi.realKpi.tooltip.fxUnsupported  "JPY/EUR cost는 USD 환산 미지원 — 연동 통화 USD/KRW 권장"
kpi.realKpi.tooltip.snapshotStale  "LSTM snapshot Xd 경과 — rebuild 후 갱신"
kpi.realKpi.badge.ML1              "Forecast Mock"
kpi.realKpi.badge.ML2              "Stale"
```

---

## 8. Testing strategy

Per the project's lightweight-stat-pipeline rule, this spec uses **unit tests only**. No golden snapshot regression suite is added.

### 8.1 Unit tests (`__tests__/roas-payback.test.ts`)

| Group | Cases | Verifies |
|---|---|---|
| Status gating | 7 | each precedence row triggers the correct `status` and `freshness` |
| Splice continuity | 4 | no jump at `d = basisDays` boundary; observed segment ramps linearly to observed total |
| Inverted mapping | 3 | `revenueP10` input maps into `payback.p90` slot |
| Edge: 365d miss | 2 | P50 misses → demote to `'insufficient'`; P10 misses only → `payback.p90 = 365` cap |
| Edge: zero spend / installs | 2 | divide-by-zero avoided, returns `'insufficient'` |
| mockFallback pass-through | 1 | every non-real status returns `mockFallback` values verbatim |

Total ≈ 19 cases. Fixtures reuse existing `appsflyer/__tests__/aggregation.test.ts` cohort data and `lstm/__tests__/` snapshot mocks.

### 8.2 Manual integration (dev server)

1. AppsFlyer disconnected → KPI cards show `ML1` + mock values.
2. Cohort connected with `basisDays < 14` → `ML1` + mock values.
3. Cohort `basisDays ≥ 14` and snapshot fresh → no badge, real values; HeroVerdict / PortfolioVerdict band reads the same `payback` numbers.
4. Force snapshot stale (set `generated_at` 8 days ago) → `ML2` + mock values.

---

## 9. Build order

A single TDD-aligned commit:

1. `types.ts` — input/output types
2. `roas-payback.ts` — function stub returning hard-coded mockFallback
3. `__tests__/roas-payback.test.ts` — 19 cases failing
4. `roas-payback.ts` — implementation passes all tests
5. `use-real-kpi.ts` — thin React hook
6. `kpi-cards.tsx` — merge ROAS/payback overrides + freshness badge
7. `dashboard/page.tsx` — call `useRealKpi`, route result to HeroVerdict + PortfolioVerdict
8. i18n dictionary additions (6 keys × ko/en)
9. `tsc --noEmit` + `npm test` + manual dev server check
10. Commit + PR

---

## 10. Out of scope / follow-ups

- **TitleHeatmap row** (`paybackD`, `roas` per game): defer until ≥2 games. One game (poco) is not worth a heatmap update path.
- **60-day payback target externalization**: the hardcoded `60` constant inside `PortfolioVerdict.tsx` stays. Externalizing into a config or snapshot meta is a separate small refactor.
- **LSTM snapshot rebuild cron** (priority 4 from session resume guide): completely independent. The composite layer is designed to keep working with a placeholder snapshot — when the cron lands, the splice pattern will simply pick up the freshly-rebuilt snapshot on next render.
- **New composite charts** (e.g. blended LTV waterfall): future composite modules can colocate in `shared/api/composite/`.
- **Per-cohort `cohort × day` matrix** for higher-fidelity observed-segment reconstruction: only justified if the linear-ramp approximation produces visible inaccuracies in the basisDays > 14 region — unlikely while payback days stay in the forecast-only segment.
