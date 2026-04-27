# VC Simulator — Insights Panel Design

**Date**: 2026-04-27
**Status**: Spec — pending Mike approval before mock implementation
**Branch context**: PR #19 (`fix/vc-sim-design-align`)
**Audience**: Project Compass non-technical executive (game investment decision-maker)

---

## 1. Why this spec exists

`/dashboard/vc-simulation` answers a single question for the decision-maker:
**"With these inputs, when does cumulative ROAS cross 100% (BEP)?"**

The current page (after PR #19 commits 1-4) shows that answer as a chart and a KPI strip. It does **not** explain *what makes ROAS reach 100%* — it just shows the result. The decision-maker still has to fiddle with sliders and form a mental model of which lever matters.

This spec designs an **insights panel** that converts the simulator from a passive analytical tool into an actively prescriptive one: it tells the decision-maker which knob to push, by how much, and what the outcome would be.

---

## 2. Inputs to the design

### 2.1 External research (UI patterns, ranked by impact)

From web research on financial / scenario simulators (Causal, Pigment, Anaplan, Tableau "Explain Data", Bloomberg, Toss):

| Rank | Pattern | Why it works for execs |
|---|---|---|
| **1** | **Decision sentence + 3 If/Then cards** | One-glance verdict + the three specific moves that would change it. Pre-computes the question the exec is going to ask anyway, in plain language. |
| **2** | **Tornado / lever-impact bars** | Ranks levers by impact in <10s. Universal "which knob matters most" answer. |
| 3 | 2D parameter sweep heatmap | Shows the *shape* of the payback frontier. Loses non-quant audiences. |
| 4 | Side-by-side scenario compare | Useful but partially redundant with cards #1 if those are well-written. |
| 5 | Top-N prescriptive recommendation | High-risk: only ship if model can defend *why* a lever was picked. |

### 2.2 Domain research (mobile-game ROAS 100% drivers)

- **LTV/CPI ratio** is the dominant determinant. Liftoff/AppsFlyer benchmarks: profitable casual games need LTV/CPI ≥ 1.2 by D90 to hit D365 break-even.
- **D7→D30 retention slope** matters far more than D1 ("D1 is vanity, D30 is sanity, D90 is payback" — Mobile Dev Memo).
- Industry BEP timing: puzzle/match-3 typically D270-540, casual D180-365, mid-core D365-720, hyper-casual D7-30.

### 2.3 Internal sensitivity sweep results

Default offer (3M investment, UA 60%, hurdle 20%, 12mo horizon, ARPDAU 0.30-0.50, retention from LSTM fixture):

| Lever | BEP impact | Notes |
|---|---|---|
| **uaSharePct** | **Strong, primary driver** | 50% → no BEP; 60% → 11mo; 80% → 9mo |
| **horizonMonths** | **Strong, secondary** | 12 → BEP 11; 18 → 15; 24 → 18; 36 → 24 |
| **deltaLtv** (실험) | Weak | 0% → BEP 11; 50% → BEP 10 |
| **investmentUsd** | **None** | Numerator and denominator scale together |
| **hurdleRate** | **None** | Affects IRR comparison only, not BEP |
| **appsflyerInitialCash** | **None** | Revenue-based BEP unaffected by initial cash |

**Conclusion**: out of the 6 input sliders + 1 hidden lever, only 2 levers (`uaSharePct`, `horizonMonths`) actually move BEP. The decision-maker is currently being given 4 sliders that don't do what they appear to do (relative to BEP). This is the most important fact the insights panel needs to communicate.

---

## 3. Design — what the panel will show

### 3.1 Hierarchy (top to bottom)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   A. Decision sentence (32px font-extrabold serif)          │
│   "현재 조건으로 ROAS 100% 도달은 11개월차."                │
│                                                             │
│   12-month ROAS 116%   ·   Year-end MOIC 1.33×              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   B. Top-3 If/Then cards (horizontal row, 3 columns)        │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│   │ UA share │ │ Horizon  │ │실험 LTV  │                    │
│   │ 70%로 ↑ │ │18mo로 ↑ │ │30% 가정  │                    │
│   │ BEP 10mo │ │ BEP 15mo │ │ BEP 11mo │                    │
│   │ 1mo 단축 │ │ +4mo     │ │ 변화 없음│                    │
│   └──────────┘ └──────────┘ └──────────┘                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   C. Tornado lever-impact bar (vertical card)               │
│   ──────────────  uaSharePct (±20%)   ▓▓▓▓▓▓▓▓ ±3mo        │
│   ──────────────  horizonMonths (±50%) ▓▓▓▓▓▓▓ ±13mo        │
│   ──────────────  deltaLtv (±20%)    ▓▓ ±1mo                │
│   ──────────────  investmentUsd      · 0 (BEP-invariant)    │
│   ──────────────  hurdleRate         · 0 (BEP-invariant)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 A. Decision sentence

**Two states**:

| State | Headline | Sub-text |
|---|---|---|
| BEP hit (paybackMonths ≤ horizon) | "현재 조건으로 ROAS 100% 도달은 **{N}개월차**." | "12개월 누적 ROAS {X}% · MOIC {Y}×" |
| BEP miss (paybackMonths is null) | "현재 조건으로 1년 내 ROAS 100% **도달 불가**." | "12개월 누적 ROAS {X}% (목표 100% 미달) · 가장 큰 막힘: UA share" |

- 32px font-extrabold (game-board DecisionStoryCard hierarchy match)
- BEP hit → `text-foreground`; miss → `text-destructive`
- Mirrors the headline in the existing `CumulativeRoasChart` but consolidates it as the page-level conclusion.

### 3.3 B. Top-3 If/Then cards

3 cards in a `grid-cols-3 gap-3` layout. Each card:

```
┌──────────────────────────┐
│ [LEVER NAME]   ↑ / ↓    │   ← 10px uppercase muted
│                          │
│ {action description}     │   ← 14px medium foreground
│                          │
│ BEP {N}개월              │   ← 24px font-extrabold tabular-nums
│ {delta}                  │   ← 12px medium signal-color
└──────────────────────────┘
```

**Lever selection rules** (deterministic, not ML):

1. Always show **uaSharePct** card — primary lever
   - If BEP hit: "UA share +10%p → BEP {N-1}개월 (1개월 단축)"
   - If BEP miss: "UA share **{threshold}%** 이상 → 1년 안 회수 가능"
   - threshold = computed by sweeping uaSharePct upward and finding first value with paybackMonths ≤ horizon
2. Always show **horizonMonths** card — secondary lever
   - "horizon 18개월로 → BEP {N+M}개월" (note: longer horizon delays BEP because monthly UA dilutes; this is a real insight for the decision-maker)
3. Third card: **deltaLtv** (실험) if `bayesianPosterior` available, else hidden + replaced with a "**다른 입력은 BEP에 영향 없음**" callout
   - "실험 LTV +30% 가정 → BEP {N-1}개월"

**Negative-result cards intentionally included**: showing "투자금 변화 → 영향 없음" tells the decision-maker which sliders not to bother with. This is one of the spec's most important pieces of communication — based on the sensitivity sweep that revealed 4 of 6 sliders are BEP-irrelevant.

### 3.4 C. Tornado lever-impact bar

Horizontal bar chart, one bar per lever, sorted descending by ΔBEP magnitude:

- Bar length: months of BEP shift under a ±20% (or ±50% for horizon, ±100% for deltaLtv) swing on that lever.
- BEP-invariant levers shown as flat 0-length bars with a "BEP-invariant" label — explicit acknowledgment, not omission.
- Color: `bg-primary` (same as Cumulative ROAS line)
- Numerical label at bar end: "±3mo"
- Hover tooltip: actual sweep values (e.g. "uaSharePct 60% → 11mo, 80% → 9mo")

This card answers the universal "which knob matters most?" question in 5 seconds.

### 3.5 D. Hidden-lever callout (small footer text)

Below the tornado:

> 이 시뮬레이션은 다음 가정 위에서 작동합니다: CPI $2.5–3.5, ARPDAU $0.30–0.50 (puzzle/casual production range), retention = LSTM 모델 P50. 게임 자체의 효율(LTV/CPI ratio)이 BEP 도달 한계를 결정합니다.

Honest disclosure. The decision-maker should know the simulator can't model "what if our game becomes a hit?" without changing these hidden levers — those are *game design / product* questions, not *investment terms* questions.

---

## 4. Computation strategy

### 4.1 Data flow

The insights panel derives entirely from `useVcSimulation()` output + small client-side sweep recomputations. **No compute-layer changes needed.**

| Insight | Source |
|---|---|
| Decision sentence | `result.baselineB.paybackMonths`, `cumulativeRevenue.at(-1)`, `p50Moic`, `offer.investmentUsd`, `offer.horizonMonths` |
| If/Then card "UA share +10%p" | `useVcSimulation` re-run with `{ ...offer, uaSharePct: offer.uaSharePct + 10 }` |
| If/Then card "horizon 18mo" | re-run with `horizonMonths: 18` |
| If/Then card "deltaLtv +30%" | re-run with `bayesianDeltaLtv: 0.3` |
| Tornado bar — ±20% sweep | re-run with each lever swept up and down |
| BEP-miss threshold ("UA 60%+") | binary search uaSharePct upward in 5%-step until `paybackMonths != null` |

Each re-run = 2000 Monte Carlo samples × 2 baselines × ~12 months × cohort sum ≈ ~50ms client-side. With ~6 lever sweeps for the tornado + 2-3 for cards, total recomputation is ~400ms. Acceptable for a panel that updates on slider change. If perceived as slow, debounce slider input by 200ms.

### 4.2 Memoization

`useMemo` keyed on `JSON.stringify(offer) + bayesianDeltaLtv`. Sweeps recomputed only when relevant slider moves.

### 4.3 Edge cases

- **All sweeps miss BEP**: threshold card shows "현재 LTV/CPI 가정 하에서 어떤 UA 비중도 1년 안 회수 어려움. 게임 효율 개선 필요."
- **Already at lever boundary** (e.g., uaSharePct = 100%): card shows "UA share already at maximum" + suggest different lever.
- **horizonMonths at min (12)**: card suggests reducing — but min is 12 from Zod schema. Card switches to "horizon 18mo로 늘리면 BEP 더 늦어짐" (counter-intuitive but accurate).

---

## 5. Visual integration

### 5.1 Placement

Insights panel sits **above** the existing `CumulativeRoasChart` in `VcResultBoard`, between `VcKpiStrip` and `CumulativeRoasChart`. The result board becomes:

```
1. VcKpiStrip                  ← 4 KPI cards (existing)
2. VcInsightsPanel             ← NEW: decision sentence + If/Then + tornado
3. CumulativeRoasChart         ← existing, now reads as "evidence for the headline"
4. DualBaselineRunwayChart     ← existing
```

### 5.2 Tokens

All Tailwind semantic tokens from PR #19 commit 1: `bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-destructive`, `text-success`, `rounded-2xl`, `hover:border-primary`. No new tokens.

### 5.3 Locale

All strings keyed under `vc.insights.*`. Bilingual (ko/en). Korean tone matches game-board DecisionStoryCard — short, declarative, decision-oriented.

---

## 6. Implementation outline (next PR)

**File adds**:
- `src/widgets/vc-simulation/ui/vc-insights-panel.tsx` — top-level panel
- `src/widgets/vc-simulation/ui/decision-sentence.tsx`
- `src/widgets/vc-simulation/ui/if-then-card.tsx`
- `src/widgets/vc-simulation/ui/tornado-bar.tsx`
- `src/widgets/vc-simulation/lib/sensitivity.ts` — sweep helpers

**File edits**:
- `src/widgets/vc-simulation/ui/vc-result-board.tsx` — insert `<VcInsightsPanel />`
- `src/widgets/vc-simulation/index.ts` — re-export
- `src/shared/i18n/dictionary.ts` — add `vc.insights.*` keys

**Tests**:
- `src/widgets/vc-simulation/lib/__tests__/sensitivity.test.ts` — node:test (matches existing style); verify sweep helpers return monotonic / threshold values for fixture data.

---

## 7. Out of scope (deliberately deferred)

- **2D parameter sweep heatmap** (UI pattern #3): only 2 levers move BEP, so 2D adds little over the 1D tornado.
- **Side-by-side scenario compare**: cards already serve "what would change" use case.
- **Top-N ML-style recommendation**: too risky without explanation; the deterministic If/Then approach is more defensible.
- **KPI semantic alignment** (IRR -82% vs MOIC 1.33× vs ROAS BEP 11mo): these three metrics describe different time-value frames. A separate doc + KPI label revision PR.
- **Cohort lifecycle precision**: the new compute already includes 12-month cohort tracking; further precision (per-day cohort, organic uplift, eCPM-stack modeling) is a separate compute-layer PR.
- **Daily granularity toggle**: still requires compute-layer extension; previously deferred.

---

## 8. Acceptance criteria for the implementation PR

- [ ] Decision sentence renders correctly in BEP-hit and BEP-miss states (Korean + English).
- [ ] If/Then cards show ΔBEP for `uaSharePct +10%p`, `horizonMonths = 18`, and `deltaLtv = 0.3` (or "BEP-invariant" callout for sliders that don't move BEP).
- [ ] Tornado bar sorts levers by ΔBEP magnitude descending; BEP-invariant levers explicitly labeled.
- [ ] All sweeps complete in <500ms on a current laptop with 2000 Monte Carlo samples.
- [ ] No compute-layer changes.
- [ ] tsc clean, vitest + node:test passing.
- [ ] Visual hierarchy matches game-board DecisionStoryCard (32px extrabold headline, 10px uppercase labels, semantic tokens only).

---

## 9. Open questions for Mike

1. **Decision sentence**: "ROAS 100% 도달은 **11개월차**" — 자연스러운 한국어인가? 아니면 "본전 회수: **11개월차**" 같이 더 캐주얼하게?
2. **If/Then 카드 3번째**: 실험 효과 (deltaLtv) — `bayesianPosterior`가 없을 때 ("LSTM 데이터로 추정 시" 정도의 가정 표시) 그래도 보여줄지, 아니면 카드 자리에 "다른 입력은 BEP에 영향 없음" 안내를 넣을지?
3. **Tornado에 BEP-invariant 명시**: "investmentUsd 영향 없음" 이런 부정 결과를 그대로 보여주는 게 결정권자에겐 가치 있다고 봤는데, "노이즈 같다"고 느끼면 숨기고 sub-text로만 표시 가능.
4. **데모 mock에 fake 데이터 vs 실제 simulator 호출**: 실제 호출이 정직하지만 ~400ms 잠깐 멈춤. mock으로 즉각 반응하는 게 데모 임팩트는 더 클 수도. 어느 쪽 선호?
