# VC Simulator Pivot — Phase 4 Implementation Plan ("시장과 비교" 토글 + 분포 오버레이)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** `/dashboard` 페이지에 "시장과 비교" 토글을 추가. ON 시 가정값 출처의 retention strip 옆에 시장 분포 (장르 prior p10/p50/p90)를 옅은 보조 라인으로 노출. 사용자가 "이 게임 D7 retention이 시장 대비 어디쯤인지" 한 시야에서 확인 가능.

**Architecture:** TopBar 영역(hero 위)에 inline 토글 추가. 페이지 레벨 `useState` 로 토글 상태 보유. 토글 ON 시 `getPrior({ genre, region })`에서 장르 prior 추출, `AssumptionSourcePanel`에 prop으로 전달. RetentionStrip이 ON 상태에서 시장 p50 + (p10-p90) 범위 표시.

**Scope discipline:** 본 phase는 **retention strip overlay에 한정**. CumulativeRoasChart / RunwayChart 차트 오버레이는 Phase 4.1 fast-follow. 이유: priorByGenre의 retention 데이터가 직접 비교 가능 / 차트 오버레이는 단위 변환 (USD revenue → genre-relative ROAS) 필요해 별도 작업.

**Stacking:** Phase 3 (PR #33) 위. base 브랜치 `refactor/vc-pivot-phase-3`.

**Spec:** `docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md` §6 "시장과 비교" 토글.

---

## File Structure

| 변경 | 경로 | 책임 |
|---|---|---|
| Modify | `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx` | 토글 UI + state + prop 전달 |
| Modify | `src/widgets/vc-simulation/ui/assumption-source-panel.tsx` | `compareMarket` prop 추가, RetentionStrip에 시장 row |
| Modify | `src/shared/i18n/dictionary.ts` | 3 라벨 키 (`vc.compare.title`, `vc.compare.market`, `vc.compare.you`) |

---

## Task 1: worktree (Phase 3 위)

- [ ] **Step 1:**
```bash
cd "/Users/mike/Downloads/Project Compass"
git worktree add ../compass-worktrees/refactor-vc-pivot-phase-4 -b refactor/vc-pivot-phase-4 refactor/vc-pivot-phase-3
```

- [ ] **Step 2:**
```bash
cd ../compass-worktrees/refactor-vc-pivot-phase-4
npm install --legacy-peer-deps
```

- [ ] **Step 3:**
```bash
git log --oneline -3
```
Expected: HEAD = `38e3ca7` (Phase 3 fix).

---

## Task 2: 토글 UI + state in page-content

**Files:** `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx`

- [ ] **Step 1: state 추가**

`VcSimulationPageContent` 함수 내부, 다른 useState 옆에:

```typescript
const [compareMarket, setCompareMarket] = useState(false)
```

- [ ] **Step 2: 토글 UI를 Hero 영역 위에 추가**

Hero `<DecisionSentence />` 위 (PageHeader 바로 아래) 에 작은 inline toggle 추가:

```tsx
<FadeInUp className="mt-4 flex justify-end">
  <button
    type="button"
    onClick={() => setCompareMarket((v) => !v)}
    aria-pressed={compareMarket}
    className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
  >
    <span
      className={`size-2 rounded-full transition-colors ${
        compareMarket ? "bg-primary" : "bg-muted-foreground/40"
      }`}
      aria-hidden="true"
    />
    {t("vc.compare.title")}
  </button>
</FadeInUp>
```

위 코드는 `t` 가 필요 — 만약 `useLocale()`이 함수 본문에 이미 있으면 그대로, 없으면:
```typescript
import { useLocale } from "@/shared/i18n"
// ...
const { t } = useLocale()
```

- [ ] **Step 3: AssumptionSourcePanel에 prop 전달**

```tsx
<AssumptionSourcePanel compareMarket={compareMarket} />
```

- [ ] **Step 4: tsc 확인**

```bash
npx tsc --noEmit
```

(아직 AssumptionSourcePanel이 prop 안 받아 에러 — Task 3 완료 후 통과.)

---

## Task 3: AssumptionSourcePanel — compareMarket prop + market overlay

**Files:** `src/widgets/vc-simulation/ui/assumption-source-panel.tsx`

- [ ] **Step 1: prop 시그니처 추가**

```typescript
type Props = { compareMarket?: boolean }

export function AssumptionSourcePanel({ compareMarket = false }: Props = {}) {
  // ...
}
```

- [ ] **Step 2: RetentionStrip에 prop 전달**

```tsx
<RetentionStrip compareMarket={compareMarket} />
```

- [ ] **Step 3: RetentionStrip에 market 비교 row 추가**

`getPrior` 사용 — `Merge:JP` 가 현재 prior bundle (CLAUDE.md §9 / spec):

```typescript
import { getPrior } from "@/shared/api/prior-data"

function RetentionStrip({ compareMarket }: { compareMarket: boolean }) {
  // 기존 per-game RETENTION_BASELINE 로직 그대로
  const ours = RETENTION_BASELINE[gameId] ?? null

  // 시장 prior — 현재 단일 장르(Merge:JP)
  const prior = compareMarket ? getPrior({ genre: "Merge", region: "JP" }) : null
  const marketP50 = prior
    ? {
        d1: prior.genrePrior.retention.d1.p50,
        d7: prior.genrePrior.retention.d7.p50,
        d30: prior.genrePrior.retention.d30.p50,
      }
    : null

  return (
    <div className="space-y-2">
      {/* 기존 우리 row */}
      <div className="grid grid-cols-3 gap-2">
        <RetentionCell label="D1" value={ours?.d1} />
        <RetentionCell label="D7" value={ours?.d7} />
        <RetentionCell label="D30" value={ours?.d30} />
      </div>

      {/* 시장 비교 row — 토글 ON 시만 */}
      {marketP50 && (
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
          <RetentionCell label={t("vc.compare.market")} value={marketP50.d1 * 100} muted />
          <RetentionCell label="" value={marketP50.d7 * 100} muted />
          <RetentionCell label="" value={marketP50.d30 * 100} muted />
        </div>
      )}
    </div>
  )
}
```

`RetentionCell` 시그니처는 implementer가 현재 RetentionStrip 코드를 보고 맞춤. 핵심:
- 라벨에 우리 row는 D1/D7/D30, 시장 row는 t("vc.compare.market") + 빈 칸
- 시장 값은 `muted` (text-muted-foreground) 로 옅게
- 단위: `prior.genrePrior.retention.d1.p50` 는 0-1 fraction 이므로 ×100 후 `%` 또는 그냥 그대로

**중요:** prior bundle의 retention 단위를 implementer가 코드로 확인 (snapshot 의 raw 값이 0-1 인지 0-100 인지). `RETENTION_BASELINE` 의 형식과 통일.

- [ ] **Step 4: 사전 키 추가**

`src/shared/i18n/dictionary.ts` 에 추가 (vc.assumption.* 옆):

```typescript
"vc.compare.title": { ko: "시장과 비교", en: "Compare with market" },
"vc.compare.market": { ko: "시장 p50", en: "Market p50" },
"vc.compare.you": { ko: "우리", en: "Us" },
```

- [ ] **Step 5: tsc + 테스트**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 6: 통합 commit**

```bash
git add src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx \
        src/widgets/vc-simulation/ui/assumption-source-panel.tsx \
        src/shared/i18n/dictionary.ts
git commit -m "$(cat <<'EOF'
feat(vc-sim): add 시장과 비교 toggle (Phase 4 — retention overlay)

Phase 4 of VC simulator pivot:
- 시장과 비교 토글 added to page header area (above hero)
- AssumptionSourcePanel.RetentionStrip displays market p50 (D1/D7/D30)
  from prior-data when toggle ON
- 3 i18n keys added (vc.compare.title/market/you)

Scoped to retention strip overlay only. Chart-level overlays
(CumulativeRoasChart, RunwayChart) deferred to Phase 4.1 fast-follow.

Spec: docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md §6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 빌드 + push + PR

- [ ] **Step 1:** `npm run build` 통과
- [ ] **Step 2:**
```bash
git push -u origin refactor/vc-pivot-phase-4
gh pr create --base refactor/vc-pivot-phase-3 \
  --title "feat(vc-sim): VC simulator pivot — Phase 4 시장과 비교 toggle" \
  --body "$(cat <<'EOF'
## Summary

VC simulator에 **"시장과 비교" 토글** 추가 — pivot의 비교 narrative 핵심.

- Hero 영역 우측에 inline 토글 (점 + 라벨)
- ON 시 가정값 출처 펼침의 retention strip 아래에 **시장 p50 row** 노출 (D1/D7/D30)
- Genre prior `Merge:JP` 에서 추출 (장르별 percentile)
- OFF 시 기본 per-game retention 만 보임 (Phase 3 그대로)

**Scope:** retention strip overlay에 한정. 차트 오버레이 (ROAS, runway)는 Phase 4.1 fast-follow.

**Stacking:** PR #31 → #32 → #33 → 본 PR.

**Spec:** \`docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md\` §6
**Plan:** \`docs/superpowers/plans/2026-04-30-vc-simulator-pivot-phase-4.md\`

## Test plan

- [ ] hero 위 우측 "시장과 비교" 토글 노출
- [ ] OFF 상태: 가정값 출처 retention strip = per-game D1/D7/D30 만
- [ ] 클릭 → ON: retention strip 아래 시장 p50 row 추가
- [ ] 토글 점이 primary 색으로
- [ ] aria-pressed 정확
- [ ] \`npm run build\` + \`npm test\` 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

- spec §6 toggle UI ✓ (page-level 인라인 — TopBar 통합은 Phase 6 정리에서)
- 분포 overlay (p10/p50/p90 중 p50)만 ✓ — 단순화. p10/p90 밴드는 fast-follow.
- placeholder 없음 ✓
- prior data 단위 확인 implementer 책임 ✓
- 차트 오버레이 deferred 명시 ✓
