# VC Simulator — Benchmark vs Actual Gap Disclosure

**Date**: 2026-04-27
**Status**: Spec — pending implementation (next commit on PR #19)
**Source**: deep-interview session (5 rounds, ambiguity 100% → 14%)
**Branch**: `fix/vc-sim-design-align`
**Companion spec**: `2026-04-27-vc-sim-typography-hierarchy-design.md`

---

## 1. Why this spec exists

After Mike confirmed in the typography interview that the simulator's hidden levers (CPI, ARPDAU, retention) should remain auto, he flagged a separate concern:

> "벤치마크값인데, 실제 AppsFlyer와의 격차를 보여줘야 하는데 — 실제와 시뮬레이션의 격차"

The simulator runs on puzzle/casual production benchmarks (CPI $2.5–3.5, ARPDAU $0.30–0.50). The decision-maker needs to know **how far the actual game's economics differ from those benchmarks**, so they can interpret simulator output as conservative / optimistic / on-target without exposing the hidden levers as inputs.

This is *not* Bayesian prior calibration (Mike explicitly said "베이지나는 아니지만"). It's a transparency disclosure: a single ratio number that says "your real numbers are X% above/below the benchmark we simulated against."

---

## 2. Decisions (locked from interview)

### 2.1 Single combined number
- The disclosure surfaces as **one ratio**: `actual LTV/CPI ÷ simulated LTV/CPI` expressed as a percent gap (e.g. `+33%`, `-7%`).
- LTV/CPI is chosen because it folds the three hidden levers (CPI, ARPDAU, retention) into one health metric familiar to mobile-game decision-makers.

### 2.2 Time-window selection: launch maturity
- **Launch < 90 days** → use D30-cohort LTV/CPI (the freshest signal a young game can deliver).
- **Launch ≥ 90 days** → use cumulative LTV/CPI (more stable, more data).
- The chart-card chip shows **both** values so the decision-maker can see the auto-selection logic; Decision-sentence narrative shows **only the auto-selected one**.

### 2.3 Two display locations (per interview round 2)
- **Decision sentence narrative** — one short clause appended: "이 조건은 1년 안 회수 가능. **실측은 시뮬보다 +33% 양호** — 보수적 결과."
- **ROAS chart card chip** — small assumption-line companion: "시뮬 ARPDAU $0.30–0.50 · 실측 LTV/CPI: D30 1.8 / 누적 1.5 (+33%)"

### 2.4 Threshold-based color tone
| Gap range | Tone | Korean text |
|---|---|---|
| ±10% | `text-muted-foreground` (neutral) | "거의 일치" |
| +10% to +30% | `text-success` (light) | "실측 양호 — 시뮬은 보수적" |
| > +30% | `text-success` (strong) | "시뮬이 너무 보수적" |
| -10% to -30% | `text-warning` | "실측 미달 — 시뮬이 낙관적" |
| < -30% | `text-destructive` | "시뮬이 너무 낙관적" |

### 2.5 AppsFlyer-disconnected fallback
- When the selected game has no AppsFlyer connection (state ≠ `active` / `stale`), the chip renders muted gray with text "실측 미연결 — 시뮬 가정만 사용" and the Decision sentence narrative drops the gap clause entirely.
- Existing connection state lookup: `useLiveAfData()` already returns the necessary `state.status` — no new fetcher.

### 2.6 Hidden levers stay hidden
- ARPDAU / CPI / retention remain compute-internal as already locked in the typography spec. This spec only adds disclosure of how they compare to actual.

---

## 3. Computation — derive actual LTV/CPI

### 3.1 D30-cohort LTV/CPI

For the most recent fully-formed D30 cohort:
```
ltv30 = Σ(cohort revenue from install day to install day + 29) / cohort installs
cpi30 = cohort UA spend / cohort installs
gapD30 = (ltv30 / cpi30) / simulatedLtv30PerCpi - 1
```

### 3.2 Cumulative LTV/CPI

```
ltvCum = total revenue since launch / total installs since launch
cpiCum = total UA spend since launch / total installs since launch
gapCum = (ltvCum / cpiCum) / simulatedLtvCumPerCpi - 1
```

### 3.3 Simulated reference values

The simulator's expected LTV/CPI mid-points (from compute.ts midpoints, not the random draws):
- `simulatedLtv30PerCpi` ≈ ARPDAU_mid × Σret(1..30) / CPI_mid = 0.40 × 5.5 / 3.0 ≈ 0.73
- `simulatedLtvCumPerCpi` ≈ ARPDAU_mid × Σret(1..N) / CPI_mid where N = horizon × 30
- These are pure-function constants computed once from defaults, not Monte Carlo runs.

### 3.4 Days-from-launch source

`useLiveAfData()` exposes the earliest install date through the AppsFlyer state (snapshot's `firstInstallAt` field, or fallback derive from cohort earliest day). If unavailable, default to "≥ 90 days" (use cumulative).

### 3.5 Edge cases

| Case | Behavior |
|---|---|
| ZERO cohorts of D30 maturity yet | Fall back to cumulative even if launch < 90 days |
| Cumulative installs = 0 | Render full fallback (미연결 chip) |
| `simulatedLtvCumPerCpi` < ε | Skip ratio (degenerate sim) |

---

## 4. Files affected

| File | Change |
|---|---|
| `widgets/vc-simulation/lib/benchmark-gap.ts` (new) | Pure helpers: `computeBenchmarkGap(afSummary, simOffer) → { selected, d30Gap, cumGap, days, status }`; threshold→tone resolver. Vitest covers `gap` calculation, threshold buckets, fallback. |
| `widgets/vc-simulation/ui/decision-sentence.tsx` | Append optional gap clause when `status === "active"` and `gap` returned a non-null number. Use chosen tone class. |
| `widgets/vc-simulation/ui/cumulative-roas-chart.tsx` | Replace existing single-line `vc.insights.assumptions` with assumption-line + gap-chip row. Chip is muted gray when `status !== "active"`. |
| `widgets/dashboard/lib/use-live-af-data.ts` | If summary doesn't already expose `firstInstallAt` and per-cohort revenue/spend, extend the type — read from `cohort` snapshot rows already accumulated in Vercel Blob. **Investigate before changing.** |
| `shared/i18n/dictionary.ts` | Add `vc.gap.*` keys (8-10 new entries: 5 threshold tones × ko/en, plus disconnected fallback, narrative templates). |

No compute-layer changes. No simulator-input changes.

---

## 5. i18n additions (sketch)

```ts
"vc.gap.label":              { ko: "실측 vs 시뮬", en: "Actual vs simulated" },
"vc.gap.disconnected":       { ko: "실측 미연결 — 시뮬 가정만 사용", en: "Actuals not connected — simulation assumptions only" },
"vc.gap.window.d30":         { ko: "D30 코호트 기준", en: "Based on D30 cohort" },
"vc.gap.window.cumulative":  { ko: "출시 이후 누적 기준", en: "Based on cumulative since launch" },
"vc.gap.tone.match":         { ko: "거의 일치", en: "Closely matched" },
"vc.gap.tone.modestUp":      { ko: "실측 양호 — 시뮬은 보수적", en: "Actual outperforms — simulation is conservative" },
"vc.gap.tone.strongUp":      { ko: "시뮬이 너무 보수적", en: "Simulation is overly conservative" },
"vc.gap.tone.modestDown":    { ko: "실측 미달 — 시뮬이 낙관적", en: "Actual underperforms — simulation is optimistic" },
"vc.gap.tone.strongDown":    { ko: "시뮬이 너무 낙관적", en: "Simulation is overly optimistic" },
"vc.gap.narrative.suffix":   { ko: "실측은 시뮬보다 {sign}{pct}% — {tone}.", en: "Actuals are {sign}{pct}% vs simulation — {tone}." },
```

---

## 6. Acceptance criteria

- [ ] Pure `computeBenchmarkGap()` helper returns `{ selected: "d30" | "cumulative" | null, d30Gap, cumGap, days, status }`.
- [ ] Selection logic: `daysFromLaunch < 90 && d30Gap available` → `"d30"`, else `"cumulative"` if available, else `null`.
- [ ] Threshold tone resolver returns one of `match | modestUp | strongUp | modestDown | strongDown` per the table in §2.4.
- [ ] Decision sentence appends "실측은 시뮬보다 +X% — {tone}." when status is active; omits clause otherwise.
- [ ] Chart-card chip renders both d30 + cumulative values when both available; bold/highlight the auto-selected one.
- [ ] Disconnected fallback renders gray chip "실측 미연결 — 시뮬 가정만 사용".
- [ ] Vitest covers: gap math, threshold buckets, both-windows-available, only-cumulative, only-d30, no-data fallback.
- [ ] tsc clean, vitest passes (≥ +5 new tests for benchmark-gap.ts).

---

## 7. Out of scope (deliberately deferred)

- Bayesian posterior shift — Mike explicitly said "베이지나는 아니지만". The disclosure is a static snapshot, not a model update. Future spec could add "rerun simulation with actual values" CTA.
- Exposing CPI / ARPDAU / retention as input sliders.
- Per-game LSTM retention curve from actual retention (uses generic LSTM snapshot only).
- Tornado chart impact recalculation under "actual values" assumption.
- Multi-window comparison (D7, D60, D90 simultaneous).

---

## 8. Interview transcript (collapsed)

<details>
<summary>5 rounds — ambiguity 100% → 14%</summary>

**R1 — Goal Clarity (comparison unit)**
Q: 시뮬 가정 vs 실측 격차를 어떤 단위로 표시할까요?
A: 한 종합 숫자 (option A — LTV/CPI ratio recommended)
→ 100% → 59%

**R2 — Location & form**
Q: 이 종합 ratio 숫자를 페이지 어디에 어떻게?
A: 1+2 조합 (Decision narrative + ROAS chart chip)
→ 59% → 45%

**R3 — Time window**
Q: 어느 시점 데이터로 비교?
A: 1+3 종합 (D30 cohort + cumulative-since-launch)
→ 45% → 40%

**R4 — Combine method**
Q: D30 + 누적 두 신호를 어떻게 종합?
A: 출시 성숙도에 따른 자동 선택 (option A — 90 day threshold)
→ 40% → 27%

**R5 — Color + fallback**
Q: 격차 색 + AppsFlyer 미연결 fallback?
A: 임계값 기반 색 단계 (option A — 5-tier threshold tones, muted disconnected fallback)
→ 27% → 14%. Threshold met.

</details>

---

## 9. Implementation note

Implementation order:
1. First: typography hierarchy spec (companion file). Touches Decision sentence card sizing — the gap clause we append needs the new narrative size to look natural.
2. Then: this gap-disclosure spec. Adds `benchmark-gap.ts` helper + chip + narrative suffix.

Both can land in the same commit if Mike prefers, but two atomic commits are easier to review and rollback. Recommended: commits 9 (typography) and 10 (gap) of PR #19.
