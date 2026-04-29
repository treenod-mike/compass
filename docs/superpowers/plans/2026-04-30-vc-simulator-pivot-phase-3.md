# VC Simulator Pivot — Phase 3 Implementation Plan (가정값 출처 펼침)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 좌측 INPUT 컬럼 하단에 "가정값 출처 ▸" 디스클로저를 추가. 펼치면 RevenueForecast / CohortHeatmap / KPI baseline 3개 미니 카드가 stack되어 노출. 시뮬레이터 사용자가 "이 시뮬이 어떤 데이터를 베이스라인으로 깔고 도는지" 한 화면 안에서 확인 가능.

**Architecture:** 새 위젯 `AssumptionSourcePanel` 하나만 생성. 안에는 기존 `RevenueForecast` / `CohortHeatmap` / `useGameData` 베이스라인 KPI를 *읽기 전용으로* 마운트. RevenueForecast/CohortHeatmap 컴포넌트 자체 props 변경 X — 단지 더 작은 컨테이너 안에 렌더. `useGameData`로 baseline 데이터 직접 호출.

**Tech Stack:** Next.js 15 · React 19 · framer-motion (`AnimatePresence`) · Tailwind v4. Recharts SVG 차트 (chart-colors.ts hex 직접 사용).

**Spec reference:** `docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md` §6 (Drawer 구조 — INPUT 좌측 인라인 펼침).

**Stacking:** Phase 2 (PR #32) 위에 stacking. base 브랜치 = `refactor/vc-pivot-phase-2`.

**중요한 발견:** spec §9 Phase 3 에 "RevenueForecast props 변경 — useGameData() 직접 호출 제거, baseline prop 받음" 항목이 있었으나, 실제 코드 점검 결과 RevenueForecast 컴포넌트는 이미 pure-prop driven (`data` + `meta` props). `useGameData()` 호출은 caller (`/dashboard/page.tsx:47`) 측이고, 그 caller는 Phase 1에서 이미 교체됨. → Phase 3에서 **props refactor 불필요**, 마운트 위치만 추가.

---

## File Structure

| 변경 | 경로 | 책임 |
|---|---|---|
| Create | `src/widgets/vc-simulation/ui/assumption-source-panel.tsx` | 디스클로저 + 3개 미니 카드 컨테이너 |
| Modify | `src/widgets/vc-simulation/index.ts` | `AssumptionSourcePanel` re-export |
| Modify | `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx` | 좌측 컬럼 하단에 `<AssumptionSourcePanel />` 마운트 |
| Modify | `src/shared/i18n/dictionary.ts` | 4개 라벨 키 추가 (`vc.assumption.title`, `vc.assumption.revenue`, `vc.assumption.cohort`, `vc.assumption.kpi`) |

**기존 컴포넌트 변경 X** — `RevenueForecast`, `CohortHeatmap` props/내부 그대로 사용. KPICards는 사용 안 함 (값 표시는 단순 grid 직접).

---

## Task 1: worktree (Phase 2 위 stacking)

- [ ] **Step 1: worktree 생성**

```bash
cd "/Users/mike/Downloads/Project Compass"
git worktree add ../compass-worktrees/refactor-vc-pivot-phase-3 -b refactor/vc-pivot-phase-3 refactor/vc-pivot-phase-2
```

Expected: `Preparing worktree (new branch 'refactor/vc-pivot-phase-3')` + HEAD = Phase 2 last commit (`c9bf723`).

- [ ] **Step 2: deps 설치**

```bash
cd ../compass-worktrees/refactor-vc-pivot-phase-3
npm install --legacy-peer-deps
```

- [ ] **Step 3: 브랜치 확인**

```bash
git status
git branch --show-current
git log --oneline -3
```

Expected: branch `refactor/vc-pivot-phase-3`, latest 3 commits = `c9bf723` (mobile fix), `7d91bf1` (Phase 2 hoist), `f2b05da` (Phase 1 fix).

---

## Task 2: AssumptionSourcePanel 위젯 생성

**Files:**
- Create: `src/widgets/vc-simulation/ui/assumption-source-panel.tsx`
- Modify: `src/widgets/vc-simulation/index.ts`

- [ ] **Step 1: 컴포넌트 파일 생성**

`src/widgets/vc-simulation/ui/assumption-source-panel.tsx`:

```typescript
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { useLocale } from "@/shared/i18n"
import { useGameData } from "@/shared/api/use-game-data"
import { useRevenueForecast } from "@/shared/api/lstm/use-revenue-forecast"
import { useSelectedGame } from "@/shared/store/selected-game"
import { RevenueForecast } from "@/widgets/charts/ui/revenue-forecast"
import { CohortHeatmap } from "@/widgets/charts/ui/cohort-heatmap"

/**
 * 시뮬 베이스라인의 출처를 보여주는 좌측 컬럼 디스클로저.
 * 3개 미니 카드 (RevenueForecast / CohortHeatmap / KPI baseline) 를 stack.
 * 모든 데이터는 *읽기 전용* — 사용자가 조작할 수 없다.
 */
export function AssumptionSourcePanel() {
  const { t } = useLocale()
  const [expanded, setExpanded] = useState(false)
  const { gameId } = useSelectedGame()
  const gameData = useGameData()
  const revenueForecast = useRevenueForecast(gameId, gameData?.charts?.revenueForecast)

  return (
    <div className="border-t border-border pt-4 mt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{t("vc.assumption.title")}</span>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="inline-flex"
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-3">
              {/* Mini card 1 — Revenue forecast baseline */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t("vc.assumption.revenue")}
                </div>
                <div className="h-32">
                  <RevenueForecast
                    data={revenueForecast.data}
                    meta={revenueForecast.meta}
                  />
                </div>
              </div>

              {/* Mini card 2 — Cohort retention baseline */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t("vc.assumption.cohort")}
                </div>
                <div className="h-32">
                  {gameData?.charts?.cohortHeatmap ? (
                    <CohortHeatmap data={gameData.charts.cohortHeatmap} />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      —
                    </div>
                  )}
                </div>
              </div>

              {/* Mini card 3 — KPI baseline (read-only) */}
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2">
                  {t("vc.assumption.kpi")}
                </div>
                <KpiBaselineGrid />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function KpiBaselineGrid() {
  const gameData = useGameData()
  const kpis = gameData?.kpis
  if (!kpis) {
    return <div className="text-xs text-muted-foreground">—</div>
  }
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      {kpis.slice(0, 4).map((k) => (
        <div key={k.label} className="flex flex-col">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wider">{k.label}</span>
          <span className="font-mono tabular-nums text-foreground font-semibold">{k.value}</span>
        </div>
      ))}
    </div>
  )
}
```

**컴포넌트 노트:**
- `useGameData()` 가 `null` 가능 — `?.charts?.cohortHeatmap` / `?.kpis` 패턴으로 방어.
- `useRevenueForecast(gameId, fallback)` 는 `revenue-forecast-vm` VM을 만들어 줌 (LSTM snapshot fresh이면 LSTM, 아니면 mock fallback).
- 미니 카드 높이 `h-32` (= 128px) — RevenueForecast / CohortHeatmap이 이 높이에 자연스럽게 들어가는지 시각 확인 후 조정.
- `KpiBaselineGrid`는 `kpis[0..3]` 4개 카드 grid 2×2로 단순 노출.

- [ ] **Step 2: index.ts re-export 추가**

`src/widgets/vc-simulation/index.ts` 마지막 줄 다음에 추가:

```typescript
export { AssumptionSourcePanel } from "./ui/assumption-source-panel"
```

- [ ] **Step 3: 사전(dictionary) 4개 라벨 추가**

`src/shared/i18n/dictionary.ts` 의 `vc.*` 섹션에 다음 4개 키 추가 (구조 같게):

```typescript
"vc.assumption.title": { ko: "가정값 출처", en: "Assumption sources" },
"vc.assumption.revenue": { ko: "매출 베이스라인", en: "Revenue baseline" },
"vc.assumption.cohort": { ko: "코호트 리텐션", en: "Cohort retention" },
"vc.assumption.kpi": { ko: "KPI 베이스라인", en: "KPI baseline" },
```

(dictionary 구조가 `{ key: { ko, en } }` 또는 분리된 ko/en object — 기존 `vc.tabs.insights` 같은 키 옆에 같은 형태로 넣음.)

- [ ] **Step 4: tsc 검증**

```bash
npx tsc --noEmit
```

Expected: 0 errors. (만약 RevenueForecast / CohortHeatmap props 가 다르면 에러 — *대응*: 기존 사용처(`/dashboard/page.tsx`의 main 버전 또는 `dashboard/market-gap/page.tsx`)에서 호출 형태 확인 후 동일하게 맞추기.)

---

## Task 3: VcSimulationPageContent에 마운트

**Files:**
- Modify: `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx`

- [ ] **Step 1: 좌측 컬럼 하단에 AssumptionSourcePanel 추가**

`vc-simulation-page-content.tsx` 의 좌측 컬럼 (`<VcInputPanel />` 직후):

```typescript
{/* Left column — input panel scrolls independently. */}
<div className="overflow-y-auto pr-2 -mr-2 min-h-0">
  <VcInputPanel onChange={setOffer} />
  <AssumptionSourcePanel />
</div>
```

- [ ] **Step 2: import 추가**

```typescript
import { AssumptionSourcePanel } from "./assumption-source-panel"
```

(같은 widget 폴더 내부라 barrel 안 거치고 직접 import OK — 다른 widget 폴더 import 시에만 barrel 사용.)

- [ ] **Step 3: tsc 검증**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: 테스트 통과**

```bash
npm test
```

Expected: 254/254 PASS.

- [ ] **Step 5: 통합 commit**

```bash
git add src/widgets/vc-simulation/ui/assumption-source-panel.tsx \
        src/widgets/vc-simulation/index.ts \
        src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx \
        src/shared/i18n/dictionary.ts
git commit -m "$(cat <<'EOF'
feat(vc-sim): add 가정값 출처 disclosure (Phase 3)

Phase 3 of VC simulator pivot:
- AssumptionSourcePanel widget — left-column collapsible disclosure
- 3 mini cards: RevenueForecast / CohortHeatmap / KPI baseline (read-only)
- Mounts below VcInputPanel; expanded state local to component
- 4 i18n keys added (vc.assumption.title/revenue/cohort/kpi)

기존 RevenueForecast / CohortHeatmap props 변경 없음 — 마운트 위치만
새로 잡아 "예측 결과 → 시뮬 입력 가정" 의미 재정의.

Spec: docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md §6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit hook 통과 + commit 생성.

---

## Task 4: 빌드 + 시각 회귀 + PR

- [ ] **Step 1: 풀 빌드**

```bash
npm run build
```

Expected: `Compiled successfully`. 6개 dashboard 라우트 모두 정적 생성.

- [ ] **Step 2: dev server 시각 확인**

```bash
npm run dev
```

`/dashboard` 진입 후:
1. 좌측 컬럼 하단에 "가정값 출처 ▾" 또는 "▸" 칩 노출
2. 클릭 → 펼침 애니메이션 (240ms ease-out) → 3개 미니 카드 stack
3. RevenueForecast 미니: 차트가 작은 높이(128px)에서도 깨지지 않음
4. CohortHeatmap 미니: 동일
5. KPI baseline grid 2×2 — 4개 KPI 라벨 + 값
6. 다시 클릭 → 접힘 애니메이션
7. 모바일(<768px)에서도 stacking 안에서 정상 동작

- [ ] **Step 3: push + PR**

```bash
git push -u origin refactor/vc-pivot-phase-3
gh pr create \
  --base refactor/vc-pivot-phase-2 \
  --title "feat(vc-sim): VC simulator pivot — Phase 3 가정값 출처 disclosure" \
  --body "$(cat <<'EOF'
## Summary

VC simulator의 좌측 INPUT 컬럼 하단에 "가정값 출처" 디스클로저 추가.

- 펼치면 3개 미니 카드 stack — RevenueForecast / CohortHeatmap / KPI baseline
- 모두 *읽기 전용* — 시뮬 베이스라인의 출처만 보여줌
- 기존 RevenueForecast / CohortHeatmap 컴포넌트 props 변경 X (이미 pure-prop)
- 의미 재정의: "예측 결과" → "시뮬 입력 가정"

**Stacking:** PR #31 (Phase 1) → PR #32 (Phase 2) → 본 PR.

**Spec:** \`docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md\` §6
**Plan:** \`docs/superpowers/plans/2026-04-30-vc-simulator-pivot-phase-3.md\`

## Test plan

- [ ] \`/dashboard\` 좌측 컬럼 하단 "가정값 출처 ▸" 노출
- [ ] 클릭 시 부드럽게 펼침 (240ms)
- [ ] 펼친 상태: RevenueForecast 미니 / CohortHeatmap 미니 / KPI 2×2 그리드
- [ ] 다시 클릭 시 접힘
- [ ] 펼친 상태에서 슬라이더 만져도 가정값 카드 변하지 않음 (read-only 의미)
- [ ] 모바일에서도 정상 동작
- [ ] \`npm run build\` + \`npm test\` 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL.

---

## Self-Review

**1. Spec coverage:**
- spec §6 INPUT 좌측 "가정값 출처 ▸" 디스클로저 ✓
- spec §6 3개 미니 카드 (RevenueForecast / CohortHeatmap / KPI baseline) ✓
- spec §6 "조작 불가, 출처만" 읽기 전용 ✓
- spec §9 Phase 3 의 "RevenueForecast props 변경" 항목 — 실제 코드 점검 결과 props가 이미 pure이므로 *불필요*. plan에서 명시.

**2. Placeholder scan:** 모든 step 코드/명령어 포함. TBD 없음.

**3. Type consistency:**
- `RevenueForecast({ data, meta })` — 기존 props 그대로 사용
- `CohortHeatmap({ data })` — 기존 props 그대로 사용 (Step 4에서 호출 형태 확인 필요 — 만약 다르면 implementer 수정)
- `useRevenueForecast(gameId, fallback)` — 기존 hook 시그니처 그대로

**4. 위험:**
- RevenueForecast / CohortHeatmap이 컨테이너 너비/높이 기반 ResponsiveContainer 라면 `h-32` 작은 높이에서 차트 라벨이 겹칠 수 있음. *대응*: implementer가 시각 확인 후 `h-40` (160px) 또는 `h-48` (192px)로 조정 가능. 코드 변경은 한 줄.
- `kpis` 배열 구조가 추측이므로 (`{ label, value }`) — 실제 타입과 다르면 `KpiBaselineGrid` 수정 필요. implementer가 `useGameData` 결과 타입 확인.
- "가정값" 디스클로저가 펼쳐졌을 때 좌측 컬럼이 길어져 스크롤 발생 — `overflow-y-auto` 가 이미 적용돼 있으니 정상 동작 예상.
