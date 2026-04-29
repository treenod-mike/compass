# VC Simulator Pivot — Phase 2 Implementation Plan (Decision Hero + KPI 상시 노출 + 40/60 분할)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** `/dashboard` 홈에서 (1) Decision Sentence를 grid 위로 hoist해 full-width hero로, (2) VcKpiStrip을 VcResultTabs 안에서 꺼내 우측 컬럼 상단에 상시 노출, (3) 좌/우 grid 비율을 `360px_1fr` → 40%/60% 으로 조정. 결과 패널 정보 위계를 spec §5 와 일치시킴.

**Architecture:** 컴포넌트 *추가/삭제 없음*. 기존 `DecisionSentence` / `VcKpiStrip`을 마운트 위치만 옮긴다. `VcResultBoard`에서 `DecisionSentence` 제거, `VcResultTabs`에서 KPI 탭 제거 → 페이지 레벨에서 두 컴포넌트를 직접 렌더. 시각적 효과는 *항상 보이는 결정 + KPI*, 그 아래 차트/인사이트/런웨이만 차지.

**Tech Stack:** Next.js 15 App Router · React 19 · Tailwind v4. Pre-existing FSD 2.1 layering 유지.

**Spec reference:** `docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md` §5 (화면 골격), §9 Phase 2.

**Stacking:** 본 phase는 Phase 1 (PR #31) 위에 stacking. Phase 1 PR이 머지되기 전이라 base 브랜치는 `refactor/vc-pivot-phase-1`. Phase 1이 머지되면 본 PR도 main으로 자동 rebase.

---

## File Structure

| 변경 | 경로 | 책임 |
|---|---|---|
| Modify | `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx` | DecisionSentence + VcKpiStrip 직접 렌더, grid 비율 변경 |
| Modify | `src/widgets/vc-simulation/ui/vc-result-board.tsx` | DecisionSentence 마운트 제거 (page 레벨로 이동) |
| Modify | `src/widgets/vc-simulation/ui/vc-result-tabs.tsx` | "kpi" tab 제거 — Insights / Runway 2개만 (KPI는 page 레벨로 이동) |

**기존 컴포넌트는 변경 X** — `DecisionSentence`, `VcKpiStrip`, `VcInsightsPanel`, `DualBaselineRunwayChart`, `CumulativeRoasChart` 모두 props/내부 로직 그대로.

---

## Task 1: 새 worktree + 브랜치 (Phase 1 위 stacking)

- [ ] **Step 1: worktree 생성 (base = `refactor/vc-pivot-phase-1`)**

```bash
cd "/Users/mike/Downloads/Project Compass"
git worktree add ../compass-worktrees/refactor-vc-pivot-phase-2 -b refactor/vc-pivot-phase-2 refactor/vc-pivot-phase-1
```

Expected: `Preparing worktree (new branch 'refactor/vc-pivot-phase-2')` + HEAD가 `f2b05da` (Phase 1 마지막 commit).

- [ ] **Step 2: deps 설치**

```bash
cd ../compass-worktrees/refactor-vc-pivot-phase-2
npm install --legacy-peer-deps
```

- [ ] **Step 3: 브랜치/HEAD 확인**

```bash
git status
git branch --show-current
git log --oneline -5
```

Expected: branch `refactor/vc-pivot-phase-2`, latest 5 commits include Phase 1's 4 commits + plan commit.

---

## Task 2: VcResultBoard에서 DecisionSentence 제거

`VcResultBoard`가 `DecisionSentence`를 마운트하지 않도록 한다 (page 레벨에서 렌더할 예정).

**Files:**
- Modify: `src/widgets/vc-simulation/ui/vc-result-board.tsx`

- [ ] **Step 1: 현재 vc-result-board.tsx 읽기 (40줄)**

```bash
cat "src/widgets/vc-simulation/ui/vc-result-board.tsx"
```

Expected: import + Props + return 안에 `<DecisionSentence />`, `<CumulativeRoasChart />`, `<VcResultTabs />` 순서.

- [ ] **Step 2: DecisionSentence import + 마운트 제거**

`src/widgets/vc-simulation/ui/vc-result-board.tsx` 전체 내용 교체:

```typescript
"use client"

import type { VcSimResult } from "@/shared/api/vc-simulation"
import { CumulativeRoasChart } from "./cumulative-roas-chart"
import { VcResultTabs } from "./vc-result-tabs"

type Props = {
  result: VcSimResult
  gameId: string
  appsflyerInitialCash: number
  bayesianDeltaLtv: number | null
}

/**
 * Result panel: primary chart + tabbed secondary info. The decision sentence
 * is rendered at the page level (above the grid) per spec §5.
 */
export function VcResultBoard({
  result,
  gameId,
  appsflyerInitialCash,
  bayesianDeltaLtv,
}: Props) {
  return (
    <div className="space-y-4">
      <CumulativeRoasChart result={result} />
      <VcResultTabs
        result={result}
        gameId={gameId}
        appsflyerInitialCash={appsflyerInitialCash}
        bayesianDeltaLtv={bayesianDeltaLtv}
      />
    </div>
  )
}
```

- [ ] **Step 3: tsc 확인 (DecisionSentence import 제거 후)**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

(컴파일은 통과하지만 페이지에서 DecisionSentence가 사라진 상태가 됨 — Task 4에서 page 레벨에 다시 추가.)

---

## Task 3: VcResultTabs에서 "kpi" 탭 제거

`VcResultTabs`가 KPI 탭을 노출하지 않도록 한다 (Insights / Runway 2개만 남김).

**Files:**
- Modify: `src/widgets/vc-simulation/ui/vc-result-tabs.tsx`

- [ ] **Step 1: 현재 vc-result-tabs.tsx 전체 읽기 (80줄)**

```bash
cat "src/widgets/vc-simulation/ui/vc-result-tabs.tsx"
```

Expected: TabKey type `"insights" | "kpi" | "runway"`, tabs 배열 3개, switch/조건부 렌더 부분에 `<VcKpiStrip />` 호출.

- [ ] **Step 2: TabKey 타입에서 "kpi" 제거**

다음 세 곳 변경:

```typescript
// 1. type 좁힘
type TabKey = "insights" | "runway"

// 2. tabs 배열에서 "kpi" 항목 제거 (현재 두 번째 entry)
const tabs: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: "insights", labelKey: "vc.tabs.insights" },
  { key: "runway", labelKey: "vc.tabs.runway" },
]
```

- [ ] **Step 3: VcKpiStrip 호출/import 제거**

`vc-result-tabs.tsx` 안의 KPI 탭 렌더 분기를 제거하고 `import { VcKpiStrip }` 도 제거.

본 task는 *line-level edit* 이므로 implementer가 현재 파일을 읽고 다음 패턴을 식별해 제거:
- `import { VcKpiStrip } from "./vc-kpi-strip"`
- `tab === "kpi"` 조건부 렌더 블록 (있다면) 또는 switch case `"kpi"` 블록
- 만약 객체 매핑 구조라면 `kpi: <VcKpiStrip ... />` 항목

- [ ] **Step 4: tsc 확인**

```bash
npx tsc --noEmit
```

Expected: 0 errors. KPI 탭 라벨 키(`vc.tabs.kpi`)는 dictionary에 남겨둠 — Phase 6 정리에서 처리.

---

## Task 4: vc-simulation-page-content.tsx — Hero DecisionSentence + 상시 KPI + 40/60 grid

**Files:**
- Modify: `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx`

- [ ] **Step 1: 현재 page-content.tsx 읽기**

```bash
cat "src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx"
```

핵심 구간 (line 75–95 근처):

```typescript
return (
  <PageTransition>
    <div className="px-10 pt-6 pb-6 flex flex-col h-full min-h-0">
      <FadeInUp>
        <PageHeader titleKey="vc.page.title" subtitleKey="vc.page.subtitle" />
      </FadeInUp>
      <FadeInUp className="flex-1 min-h-0 mt-6">
        <div className="grid grid-cols-[360px_1fr] gap-6 h-full min-h-0">
          {/* Left: VcInputPanel */}
          {/* Right: badges + VcResultBoard */}
        </div>
      </FadeInUp>
    </div>
  </PageTransition>
)
```

- [ ] **Step 2: Decision Sentence Hero를 PageHeader 바로 아래 (grid 위)에 추가**

`DecisionSentence` import 추가 + grid 위에 hero 영역 추가:

```typescript
import { DecisionSentence } from "./decision-sentence"
```

return 구조:

```typescript
return (
  <PageTransition>
    <div className="px-10 pt-6 pb-6 flex flex-col h-full min-h-0">
      <FadeInUp>
        <PageHeader titleKey="vc.page.title" subtitleKey="vc.page.subtitle" />
      </FadeInUp>

      {/* Hero — 항상 보이는 결정 sentence (full-width). */}
      <FadeInUp className="mt-4">
        <DecisionSentence result={result} />
      </FadeInUp>

      <FadeInUp className="flex-1 min-h-0 mt-4">
        <div className="grid grid-cols-[2fr_3fr] gap-6 h-full min-h-0">
          {/* Left 40% — input panel */}
          <div className="overflow-y-auto pr-2 -mr-2 min-h-0">
            <VcInputPanel onChange={setOffer} />
          </div>
          {/* Right 60% — KPI strip 상시 + result board */}
          <div className="overflow-y-auto pr-2 -mr-2 space-y-3 min-h-0">
            <DataSourceBadge badge={mounted ? result.dataSourceBadge : "real"} />
            {mounted && stale && <StaleBadge />}
            {/* KPI 상시 노출 (Phase 2: 결과 탭에서 hoist). */}
            <VcKpiStrip result={result} />
            <CalcBoundary>
              <VcResultBoard
                result={result}
                gameId={gameId}
                appsflyerInitialCash={initialCash}
                bayesianDeltaLtv={bayesianDeltaLtv}
              />
            </CalcBoundary>
          </div>
        </div>
      </FadeInUp>
    </div>
  </PageTransition>
)
```

- [ ] **Step 3: VcKpiStrip import 추가**

```typescript
import { VcKpiStrip } from "./vc-kpi-strip"
```

- [ ] **Step 4: tsc 확인**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test
```

Expected: 254/254 PASS. (위치만 옮긴 변경이라 회귀 위험 낮음.)

- [ ] **Step 6: 통합 commit (3 file 한 번에)**

```bash
git add src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx \
        src/widgets/vc-simulation/ui/vc-result-board.tsx \
        src/widgets/vc-simulation/ui/vc-result-tabs.tsx
git commit -m "$(cat <<'EOF'
refactor(vc-sim): hoist DecisionSentence + KPI strip; 40/60 grid

Phase 2 of VC simulator pivot:
- DecisionSentence promoted to full-width hero above the grid
- VcKpiStrip moved out of result tabs into always-visible top of right column
- Result tabs now: Insights | Runway (KPI no longer tab-gated)
- Grid ratio 360px_1fr → 2fr_3fr (40%/60%) per spec §5

Spec: docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md §5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit hook (tsc + npm test) 통과 후 commit 생성.

---

## Task 5: 빌드 + 시각 회귀 검증

**Files:** 없음 (검증)

- [ ] **Step 1: 풀 빌드**

```bash
npm run build
```

Expected: `Compiled successfully`. 라우트 목록에 `/dashboard`, `/dashboard/vc-simulation` 등 6개 정적 페이지 모두 포함.

- [ ] **Step 2: 254 tests PASS**

```bash
npm test
```

- [ ] **Step 3: dev server 실행 + 시각 확인**

```bash
npm run dev
```

브라우저 `http://localhost:3000/dashboard` 진입 후 다음 확인:

1. **Hero Decision Sentence** — 페이지 헤더 바로 아래, 좌우 풀폭. 슬라이더 만지면 즉시 업데이트.
2. **40/60 분할** — 좌측 input panel이 우측 결과보다 좁음. 데스크톱(>1024px)에서.
3. **KPI 4개** — 우측 컬럼 상단에 IRR / MOIC / Payback / J-Curve 4개 카드 항상 보임 (탭 없이).
4. **결과 탭** — KPI 탭 사라짐. Insights / Runway 2개만.
5. **CumulativeRoasChart** — KPI 아래 차트가 그대로 보임.
6. **`/dashboard/vc-simulation`** 도 동일하게 새 레이아웃.

---

## Task 6: PR 생성 (Phase 1 위 stacked)

- [ ] **Step 1: push**

```bash
git push -u origin refactor/vc-pivot-phase-2
```

- [ ] **Step 2: PR 생성 — base 는 Phase 1 브랜치**

```bash
gh pr create \
  --base refactor/vc-pivot-phase-1 \
  --title "refactor(vc-sim): VC simulator pivot — Phase 2 hero/KPI/40-60 split" \
  --body "$(cat <<'EOF'
## Summary

VC simulator 시각 골격을 spec §5 와 일치시키는 Phase 2.

- **Decision Sentence Hero** — grid 위 풀폭으로 hoist
- **KPI 4개 상시 노출** — VcResultTabs 안에서 꺼내 우측 컬럼 상단으로
- **40/60 분할** — `grid-cols-[360px_1fr]` → `grid-cols-[2fr_3fr]`
- 결과 탭 단순화: Insights / Runway (KPI 탭 제거)

**Stacking:** PR #31 (Phase 1) 위에 올라가 있음. base 브랜치 = `refactor/vc-pivot-phase-1`. Phase 1 머지 후 자동으로 main 위로 rebase.

**Spec:** \`docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md\` §5
**Plan:** \`docs/superpowers/plans/2026-04-30-vc-simulator-pivot-phase-2.md\`

## Test plan

- [ ] \`/dashboard\` 진입 — Hero decision sentence가 페이지 헤더 아래 풀폭
- [ ] 좌측 input panel 40%, 우측 result 60% 비율
- [ ] 우측 컬럼 상단에 KPI 4개 (IRR/MOIC/Payback/J-Curve) 상시 보임
- [ ] 결과 탭이 Insights / Runway 2개로 줄어듬
- [ ] 슬라이더 조작 시 Hero, KPI, 차트 모두 즉시 반응
- [ ] \`npm run build\` + \`npm test\` 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL. CodeRabbit 자동 리뷰 코멘트 + Vercel preview URL 자동 추가 (CLAUDE.md §10.4 hook).

---

## Self-Review

**1. Spec coverage:**
- spec §5 desktop 골격: Hero ✓, 40/60 ✓, KPI strip 상단 ✓
- spec §9 Phase 2 항목: DecisionSentence hoist ✓, KPIDeltaStrip ✓, 골격 분할 ✓ (KPIDeltaStrip은 spec에서 "신규 컴포넌트" 라 했지만 기존 VcKpiStrip이 같은 기능 — 신규 작성 회피 / YAGNI)
- spec §5 mobile stacking: 본 phase에서 폭 trigger 없으면 grid가 자동 반응하는지 검증 필요. 현재 `grid-cols-[2fr_3fr]`은 모든 width에 적용 → 모바일에서도 좌우 분할. *Phase 2.1 fast-follow*: `lg:grid-cols-[2fr_3fr]` + 모바일은 1col 으로 stacking. 본 PR에서 처리하면 더 좋지만 임시로 desktop만 검증하고 모바일은 follow-up.

**2. Placeholder scan:** 모든 step 코드/명령어 포함. TBD/TODO 없음.

**3. Type consistency:**
- `TabKey = "insights" | "runway"` 좁힘. 이전 `"kpi"` 참조처(switch/match) 모두 제거 필요 — implementer가 확인.
- `DecisionSentence`, `VcKpiStrip` props 인터페이스 변경 없음.

**4. 위험:**
- DecisionSentence는 props로 `result`만 받음 — page 레벨에서도 동일 prop 전달 가능 ✓.
- `useLiveAfData()` 가 DecisionSentence 안에서 호출됨 — page 레벨 마운트 위치에서도 동일하게 작동 (client component).
- `mounted` gate가 result 사용 차트들 위에만 적용되어 있음. Hero DecisionSentence는 mounted gate 없이 result를 직접 사용하는데, `useVcSimulation` 훅이 deterministic이면 SSR 안전. 만약 hydration mismatch 발생하면 Hero도 mounted 뒤에 렌더로 변경 (fast-follow).
