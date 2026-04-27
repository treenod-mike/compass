# VC Simulator — Typography Hierarchy & Visual Flow

**Date**: 2026-04-27
**Status**: Spec — pending implementation (next commit on PR #19)
**Source**: deep-interview session (6 rounds, ambiguity 100% → 20%)
**Branch**: `fix/vc-sim-design-align`

---

## 1. Why this spec exists

After PR #19 commits 1-8 landed (token migration → ROAS chart → compute realism → insights panel → tabs), Mike flagged that the result panel still felt visually unmoored:

- "큰 텍스트가 너무 많음" — 5-6 spots use 28-32px font-extrabold (Decision sentence, ROAS chart header, 4 KPI values, 3 If/Then card BEP values), so nothing reads as "the answer."
- "영역 사이 관계가 안 보임" — Decision sentence, ROAS chart, and tab content sit as three separate cards with no narrative thread connecting verdict → evidence → prescription → data.

Six-round deep interview converged on a "single dominant number" hierarchy with the chart as the page's center of gravity, and re-framed Decision sentence away from a redundant headline into a narrative one-liner.

---

## 2. Decisions (locked from interview)

### 2.1 Single dominant number
- **The only 32-36px element on the page is the BEP number** ("11" + "개월" unit) inside the ROAS chart header.
- All other numeric values step down to 22-24px (next tier), 14-16px (body), 10-11px (labels).
- This makes "when does ROAS hit 100%" the single answer the page is built around.

### 2.2 Decision sentence becomes narrative
- The Decision sentence card is **kept** but reframed: it now carries a one-line *story* — e.g. "이 조건은 1년 안 회수 가능. UA 비중 늘리면 더 빠름." — rendered at 16-18px, not the 28-32px verdict-as-headline pattern from PR #19 commit 6.
- The numeric verdict ("11개월차") moves out of the Decision card and becomes the dominant chart-header number.

### 2.3 Hidden levers stay hidden
- CPI ($2.5–3.5), ARPDAU ($0.30–0.50), retention (LSTM) remain compute-internal. Decision-maker does **not** input them.
- The existing `vc.insights.assumptions` line below the chart continues to disclose the gameplay-efficiency assumption frame.
- Future work (separate PR) could expose ARPDAU as an input slider, but explicitly out of scope here.

### 2.4 Chart shape unchanged
- ROAS chart's line + p10/p90 fan + BEP reference + zone shading **stays as-is**. Only the chart header typography (BEP number) grows.
- Runway fan chart and tornado bar chart geometries unchanged.

### 2.5 Narrative flow within tabs
- "인사이트" tab content (If/Then + Tornado) keeps the same structure; only typography scales down to fit the 1-dominant-number hierarchy.
- "주요 지표" tab KPI cards: value drops 28-32px → 22-24px.
- "현금흐름" tab unchanged (RunwayFanChart owns its own typography).

---

## 3. Typography specification

| Element | Current | Target | Note |
|---|---|---|---|
| ROAS chart header BEP value | 28-32px font-extrabold | **32-36px font-extrabold** | The only 32+ element on the page |
| Decision sentence headline | 28-32px font-extrabold | **16-18px font-medium** | Reframed as narrative one-liner |
| KPI Strip value (4 cards) | 28-32px font-extrabold | **22-24px font-extrabold** | Step-down tier |
| If/Then card BEP value (3 cards) | 24-28px font-extrabold | **18-22px font-extrabold** | Step-down tier |
| Tornado bar magnitude label | 12px | unchanged | already small |
| All sub-labels (uppercase chips) | 10-11px | unchanged | already small |
| Tab strip labels | 14px | unchanged | OK |
| Body text / sub-text | 14px | unchanged | OK |
| Assumptions disclosure | 11px | unchanged | OK |

**Net effect**: only one element (chart header BEP) reads at 32+px. Visual hierarchy: BEP > KPI value tier > body > labels.

---

## 4. Files affected

| File | Change |
|---|---|
| `widgets/vc-simulation/ui/cumulative-roas-chart.tsx` | Header BEP from `text-[28px] md:text-[32px]` → `text-[32px] md:text-[36px]`. Sub-text "본전 회수까지" stays muted small. |
| `widgets/vc-simulation/ui/decision-sentence.tsx` | Headline from `text-[24px] md:text-[28px] font-extrabold` → `text-[16px] md:text-[18px] font-medium`. Drop `letterSpacing -0.02em`. Restructure copy to be a single narrative sentence ("이 조건은…"). |
| `widgets/vc-simulation/ui/vc-kpi-strip.tsx` | KPI value `text-[28px] md:text-[32px]` → `text-[22px] md:text-[24px]`. |
| `widgets/vc-simulation/ui/if-then-card.tsx` | Card BEP value `text-[24px] md:text-[28px]` → `text-[18px] md:text-[22px]`. |
| `shared/i18n/dictionary.ts` | `vc.insights.headline.hit` and `headline.miss` rewritten as narrative ko/en sentences. Drop `{n}` placeholder substitution and let chart own the number. |

No new files. No compute changes. No chart-shape changes.

---

## 5. i18n updates

```ts
// vc.insights.headline.* — restructured from "ROAS 100% 도달은 {n}개월차" to narrative
"vc.insights.headline.hit":  {
  ko: "이 조건은 평가 기간 안에 본전 회수가 가능합니다.",
  en: "These inputs reach payback within the evaluation horizon.",
},
"vc.insights.headline.miss": {
  ko: "이 조건은 평가 기간 안에 본전 회수가 어렵습니다. UA 비중을 늘리거나 기간을 길게 잡아야 합니다.",
  en: "These inputs do not reach payback within the horizon. Raise UA share or extend the horizon.",
},
```

The numeric BEP ("11개월차") moves entirely to the ROAS chart header. The Decision sentence no longer references a specific month.

---

## 6. Acceptance criteria

- [ ] Only the ROAS chart header BEP value renders at 32+px font-extrabold.
- [ ] Decision sentence renders at 16-18px font-medium and reads as a single narrative sentence (no embedded large numbers).
- [ ] KPI Strip values render at 22-24px font-extrabold.
- [ ] If/Then card BEP values render at 18-22px font-extrabold.
- [ ] Chart shapes / colors / data unchanged.
- [ ] Visual hierarchy: BEP number > KPI/If-Then values > body > labels.
- [ ] Korean copy reads naturally on both BEP-hit and BEP-miss states.
- [ ] tsc clean, vitest 23/154 still pass.

---

## 7. Out of scope (deliberately deferred)

- ARPDAU / CPI / retention input sliders (separate PR — Mike's choice was "자동 그대로").
- Decision sentence card removal entirely (interview considered and rejected; narrative card adds story value).
- Chart shape changes (no signal that current geometry is wrong).
- Tab restructure (already shipped commit 8).
- Color token revisions.

---

## 8. Interview transcript (collapsed)

<details>
<summary>6 rounds — ambiguity 100% → 20%</summary>

**R1 — Goal Clarity (which areas)**
Q: vc-simulation 페이지에서 텍스트 크기나 차트 형태가 어색한 영역은 어디인가요? (multi-select)
A: Decision sentence, ROAS 차트, 탭 컨텐츠 (KPI / 인사이트 / 현금흐름)
→ Ambiguity 100% → 73%. Input panel safe; 3 result-side areas suspect.

**R2 — Goal Clarity (what pattern)**
Q: 세 영역에서 공통적으로 가장 거슬리는 패턴은? (multi-select)
A: 큰 텍스트가 너무 많음, 영역 사이 관계가 안 보임
→ 73% → 54%. Hierarchy + narrative connection are root cause; chart shape itself is OK.

**R3 — Direction**
Q: 위계 정리 + 영역 연결을 어떤 방향으로 다듬고 싶으세요?
A: "일아에 시행" (option D — combine all three: narrative flow + chart-centric + step hierarchy, full redesign accepted)
→ 54% → 42%.

**R4 — Contrarian Mode**
Q: Decision sentence 헤드라인과 ROAS 차트 헤더가 같은 정보를 두 번 표시 중. 어떻게 해결?
A: Decision은 narrative, 차트는 숫자
→ 42% → 33%. Resolved the dual-headline collision.

**R5 — Success Criteria (hierarchy levels)**
Q: 큰 텍스트 위계를 어떻게 잡을까요? (single-select with mock previews)
A: 강한 위계 — 메인 1개만 (option A)
→ 33% → 27%.

**R6 — Simplifier Mode (which 1 number)**
Q: 페이지 맨 위에 32-36px로 크게 표시될 '메인 1개'는?
A: BEP 숫자 (option A)
→ 27% → 20%. Threshold met.

**R7 (mid-flow clarification) — ARPDAU**
Q: ARPDAU / CPI / retention을 시뮬 키머링에 노출할까요?
A: 자동 그대로
→ Hidden levers confirmed out of scope.

</details>

---

## 9. Implementation note

Implementation is straightforward — five surgical typography edits across four widget files plus two dictionary keys. No structural changes, no test changes expected. Recommended path: a single follow-up commit on PR #19 (commit 9 of the branch) rather than a new PR.
