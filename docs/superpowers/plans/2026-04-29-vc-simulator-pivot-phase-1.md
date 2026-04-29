# VC Simulator Pivot — Phase 1 Implementation Plan (사이드바 + 라우팅 정리)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project Compass 사이드바를 "투자 판정 / 시장 / 채널 / PRISM / VC Sim / Connections" 6개에서 "Dashboard / Connections" 2개로 단순화하고, `/dashboard` 홈에 기존 vc-simulation 페이지 콘텐츠를 노출. 기존 라우트(`/dashboard/market-gap`, `/dashboard/mmm`, `/dashboard/prism`, `/dashboard/vc-simulation`) URL과 코드는 보존.

**Architecture:** 새 페이지·컴포넌트를 만들지 않는다. (1) 기존 `vc-simulation/page.tsx`의 본문을 재사용 가능한 컴포넌트(`VcSimulationPageContent`)로 추출하고, (2) `/dashboard/page.tsx`를 그 컴포넌트를 렌더하는 thin wrapper로 교체하며, (3) `navigation.ts`의 `navigationItems` 배열을 4개 항목 제거해 사이드바 노출만 줄인다. 모든 기존 라우트 파일은 그대로.

**Tech Stack:** Next.js 15 App Router · TypeScript · React 19 · Zustand · Iconify (Solar). Tailwind v4. 기존 FSD 2.1 레이어링 유지.

**Spec reference:** `docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md` §3 (IA), §9 (Phase 1).

---

## File Structure

| 변경 형태 | 경로 | 책임 |
|---|---|---|
| Create | `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx` | 기존 `vc-simulation/page.tsx`의 default-export 본체를 옮긴 재사용 컴포넌트. props 없음. |
| Modify | `src/widgets/vc-simulation/index.ts` | `VcSimulationPageContent` re-export 추가. |
| Modify | `src/app/(dashboard)/dashboard/vc-simulation/page.tsx` | 218줄 → `<VcSimulationPageContent />` 한 줄 wrapper. |
| Modify | `src/app/(dashboard)/dashboard/page.tsx` | 218줄(Executive Overview) → `<VcSimulationPageContent />` 한 줄 wrapper. |
| Modify | `src/shared/config/navigation.ts` | `navigationItems` 4개 제거 + Dashboard 라벨/i18n 정리. |
| Modify | `src/shared/i18n/dictionary.ts` | 새 라벨 키(`nav.item.dashboard`) 추가, 사용 안 하는 키는 미터치. |

**기존 코드 보존 (수정 X):**
- `src/app/(dashboard)/dashboard/market-gap/page.tsx`
- `src/app/(dashboard)/dashboard/mmm/page.tsx`
- `src/app/(dashboard)/dashboard/prism/page.tsx`
- `src/widgets/vc-simulation/ui/*` (page-content 추출 외)
- `src/widgets/dashboard/*` — 기존 Executive Overview 위젯들 (Phase 3에서 props 변경 예정, 이번엔 제거 X)

---

## Task 1: 새 worktree + 브랜치 생성

**Files:** 없음 (git/shell 작업)

- [ ] **Step 1: worktree 디렉토리 생성**

```bash
cd "/Users/mike/Downloads/Project Compass"
git worktree add ../compass-worktrees/refactor-vc-pivot-phase-1 -b refactor/vc-pivot-phase-1
```

Expected: `Preparing worktree (new branch 'refactor/vc-pivot-phase-1')` + `HEAD is now at <commit>`.

- [ ] **Step 2: worktree 진입 + deps 설치**

```bash
cd ../compass-worktrees/refactor-vc-pivot-phase-1
npm install --legacy-peer-deps
```

Expected: `added <N> packages` 또는 `up to date`.

- [ ] **Step 3: 브랜치/HEAD 확인**

```bash
git status
git branch --show-current
```

Expected: `On branch refactor/vc-pivot-phase-1` + clean working tree.

---

## Task 2: VcSimulationPageContent 컴포넌트 추출

기존 `src/app/(dashboard)/dashboard/vc-simulation/page.tsx`의 본문을 `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx`로 옮긴다.

**Files:**
- Create: `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx`
- Modify: `src/widgets/vc-simulation/index.ts`
- Modify: `src/app/(dashboard)/dashboard/vc-simulation/page.tsx`

- [ ] **Step 1: 현재 vc-simulation/page.tsx 전체 내용 확인**

```bash
cat "src/app/(dashboard)/dashboard/vc-simulation/page.tsx"
```

Expected: `"use client"` 시작, `export default function VcSimulationPage()` 정의됨.

- [ ] **Step 2: 새 컴포넌트 파일 생성 — 기존 내용을 옮기고 함수명만 변경**

`src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx`:

기존 `vc-simulation/page.tsx`의 *전체 본문을 그대로 복사*하되, 다음 두 줄만 변경:

```typescript
// 기존:
export default function VcSimulationPage() {

// 새:
export function VcSimulationPageContent() {
```

(default export → named export, 함수명 변경. 그 외 import / class CalcBoundary / 모든 로직 동일.)

- [ ] **Step 3: index.ts에 re-export 추가**

`src/widgets/vc-simulation/index.ts` 파일을 열어 마지막 줄 다음에 추가:

```typescript
export { VcSimulationPageContent } from "./ui/vc-simulation-page-content"
```

- [ ] **Step 4: 기존 vc-simulation/page.tsx를 thin wrapper로 교체**

`src/app/(dashboard)/dashboard/vc-simulation/page.tsx` 전체 내용 삭제 후:

```typescript
"use client"

import { VcSimulationPageContent } from "@/widgets/vc-simulation"

export default function VcSimulationPage() {
  return <VcSimulationPageContent />
}
```

- [ ] **Step 5: tsc + 빌드 검증 (구조 그대로 작동 확인)**

```bash
npx tsc --noEmit
```

Expected: 에러 0건. import 경로/타입 모두 정상.

- [ ] **Step 6: 로컬 dev server에서 /dashboard/vc-simulation 동작 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/dashboard/vc-simulation` 진입 → 기존과 동일한 화면(슬라이더 + 결과 보드) 노출 확인. dev server는 켜둔 채 다음 task 진행.

- [ ] **Step 7: 커밋**

```bash
git add src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx \
        src/widgets/vc-simulation/index.ts \
        src/app/\(dashboard\)/dashboard/vc-simulation/page.tsx
git commit -m "$(cat <<'EOF'
refactor(vc-sim): extract VcSimulationPageContent for /dashboard reuse

Phase 1 of VC simulator product pivot. /dashboard/vc-simulation page
becomes a thin wrapper so /dashboard can render the same content.

Spec: docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: pre-commit hook (tsc + npm test) 통과 후 commit 생성.

---

## Task 3: /dashboard 홈에 VcSimulationPageContent 마운트

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: 현재 dashboard/page.tsx 전체 내용 확인 (백업 목적)**

```bash
cat "src/app/(dashboard)/dashboard/page.tsx" > /tmp/dashboard-page-backup.tsx
wc -l "src/app/(dashboard)/dashboard/page.tsx"
```

Expected: 218줄 출력. 백업은 git history에서도 복원 가능 — 안전 망 차원.

- [ ] **Step 2: dashboard/page.tsx 전체 교체**

`src/app/(dashboard)/dashboard/page.tsx` 전체 내용 삭제 후:

```typescript
"use client"

import { VcSimulationPageContent } from "@/widgets/vc-simulation"

export default function DashboardPage() {
  return <VcSimulationPageContent />
}
```

- [ ] **Step 3: tsc 검증**

```bash
npx tsc --noEmit
```

Expected: 에러 0건. 기존 dashboard/page.tsx에서 사용하던 위젯들(`DecisionStoryCard`, `KPICards`, `TitleHeatmap`, `RevenueForecast` 등)은 다른 파일에서 여전히 import되므로 unused export 에러 없음.

- [ ] **Step 4: dev server에서 /dashboard 진입 확인**

브라우저에서 `http://localhost:3000/dashboard` 진입 → vc-simulation의 슬라이더 + 결과 보드가 노출되는지 확인. URL `/dashboard/vc-simulation`도 여전히 같은 화면이어야 함.

- [ ] **Step 5: 커밋**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): mount VcSimulationPageContent at /dashboard root

VC simulator promoted to product home. Executive Overview content
remains accessible via git history (Phase 3+ will absorb its widgets).

Spec: docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md §3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: hook 통과 + commit 생성.

---

## Task 4: 사이드바 navigation 항목 정리

**Files:**
- Modify: `src/shared/config/navigation.ts`
- Modify: `src/shared/i18n/dictionary.ts` (필요 시)

- [ ] **Step 1: navigation.ts의 navigationItems 4개 제거**

`src/shared/config/navigation.ts` 파일에서 다음 4개 객체를 `navigationItems` 배열에서 제거:

```typescript
// 제거:
{
  title: '시장 포지셔닝',
  url: '/dashboard/market-gap',
  icon: graphUpBold,
  category: 'market',
},
// 제거:
{
  title: '투자 시뮬레이션',
  url: '/dashboard/vc-simulation',
  icon: calculatorBold,
  category: 'overview',
},
// 제거:
{
  title: '채널 포화도',
  url: '/dashboard/mmm',
  icon: widget5Bold,
  category: 'channel',
},
// 제거:
{
  title: 'PRISM 연동',
  url: '/dashboard/prism',
  icon: flaskBold,
  category: 'experiments',
  badge: '개발 예정',
},
```

남는 navigationItems (총 2개):

```typescript
export const navigationItems: NavigationItem[] = [
  {
    title: '투자 판정',
    url: '/dashboard',
    icon: chart2Bold,
    category: 'overview',
  },
  {
    title: '데이터 연결',
    url: '/dashboard/connections',
    icon: plugCircleBold,
    category: 'settings',
  },
]
```

- [ ] **Step 2: '투자 판정' 라벨을 'Dashboard' 의미로 변경 (한글 라벨도 단순화)**

`navigation.ts`의 `'투자 판정'` 항목을 다음으로 교체:

```typescript
{
  title: 'Dashboard',
  url: '/dashboard',
  icon: chart2Bold,
  category: 'overview',
},
```

`CATEGORIES` 배열의 `'overview'` 항목도 라벨만 정리:

```typescript
// 기존:
{ id: 'overview', label: '투자 판정', groupKey: 'nav.group.investment', position: 'primary', icon: chart2Bold },

// 새:
{ id: 'overview', label: 'Dashboard', groupKey: 'nav.group.investment', position: 'primary', icon: chart2Bold },
```

(`groupKey`는 그대로 — i18n 키 변경 시 기존 ko/en 사전 함께 수정 필요하므로 본 phase에선 라벨만 손봄.)

- [ ] **Step 3: 사용하지 않는 import 제거**

`navigation.ts` 파일 상단의 import 중 사용 안 하는 것 정리. 제거 대상:

```typescript
// 제거 (사용 안 됨):
import calculatorBold from '@iconify-icons/solar/calculator-bold'
import graphUpBold from '@iconify-icons/solar/graph-up-bold'
import widget5Bold from '@iconify-icons/solar/widget-5-bold'
import { flaskBold } from './custom-icons'
```

남는 import (실제 사용):

```typescript
import type { IconifyIcon } from '@iconify/types'
import chart2Bold from '@iconify-icons/solar/chart-2-bold'
import plugCircleBold from '@iconify-icons/solar/plug-circle-bold'
import type { TranslationKey } from '@/shared/i18n/dictionary'
```

`CATEGORIES` 배열에서 `market` / `channel` / `experiments` 카테고리의 icon import도 사용 중이므로 — 다음 step에서 카테고리 정리.

- [ ] **Step 4: 빈 카테고리 제거 — CATEGORIES도 정리**

`CategoryId` 타입을 다음으로 변경:

```typescript
// 기존:
export type CategoryId = 'overview' | 'market' | 'channel' | 'experiments' | 'settings'

// 새:
export type CategoryId = 'overview' | 'settings'
```

`CATEGORIES` 배열도 다음 2개만 남김:

```typescript
export const CATEGORIES: CategoryMeta[] = [
  { id: 'overview', label: 'Dashboard', groupKey: 'nav.group.investment', position: 'primary', icon: chart2Bold },
  { id: 'settings', label: '데이터 연결', groupKey: 'nav.group.settings', position: 'utility', icon: plugCircleBold },
]
```

(이제 사용 안 하는 icon import 제거 가능 — Step 3와 일치 확인.)

- [ ] **Step 5: tsc 검증 (CategoryId 타입 변경 영향 확인)**

```bash
npx tsc --noEmit
```

Expected: 에러 0건. 만약 다른 파일이 `'market' | 'channel' | 'experiments'` 카테고리 ID를 직접 참조하고 있다면 에러 발생 — 그 파일을 함께 수정.

**가능한 영향 파일** (검색해서 확인):
```bash
grep -rn "'market'\|'channel'\|'experiments'" src/widgets/navigation/ src/shared/config/
```

찾은 결과가 있으면 해당 파일에서 dead branch / unreachable case로 처리. 없으면 다음 step.

- [ ] **Step 6: dev server에서 사이드바 시각 확인**

브라우저에서 `http://localhost:3000/dashboard` 새로고침 → 사이드바에 Dashboard + 데이터 연결만 노출 확인. 좌측 collapsed/expanded 토글 모두 정상 동작.

- [ ] **Step 7: 커밋**

```bash
git add src/shared/config/navigation.ts
git commit -m "$(cat <<'EOF'
refactor(nav): collapse sidebar to Dashboard + Connections only

Phase 1 of VC simulator pivot. Hidden routes (/dashboard/market-gap,
/dashboard/mmm, /dashboard/prism, /dashboard/vc-simulation) remain
accessible by URL but no longer appear in sidebar.

Spec: docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md §3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: hook 통과 + commit 생성.

---

## Task 5: 빌드 + 전체 회귀 검증

**Files:** 없음 (검증)

- [ ] **Step 1: 풀 빌드**

```bash
npm run build
```

Expected: `Compiled successfully`. 빌드 출력에서 라우트 목록 확인 — `/dashboard`, `/dashboard/vc-simulation`, `/dashboard/market-gap`, `/dashboard/mmm`, `/dashboard/prism`, `/dashboard/connections` 모두 정적 빌드되어야 함.

- [ ] **Step 2: 테스트 스위트**

```bash
npm test
```

Expected: 254개 테스트 모두 PASS (`memory: Project Compass Has 254 Tests Across 34 Test Files — All Passing`). 새 테스트는 없지만 회귀 없는지 확인.

- [ ] **Step 3: 직접 URL 진입 회귀 확인**

dev server 실행 상태에서 다음 URL을 차례로 브라우저에 입력 → 모두 정상 렌더 확인:

- `http://localhost:3000/dashboard` → VC sim 콘텐츠
- `http://localhost:3000/dashboard/vc-simulation` → VC sim 콘텐츠 (동일)
- `http://localhost:3000/dashboard/connections` → connections 페이지
- `http://localhost:3000/dashboard/market-gap` → 기존 market-gap 페이지 (URL 보존 확인)
- `http://localhost:3000/dashboard/mmm` → 기존 mmm 페이지 (URL 보존 확인)
- `http://localhost:3000/dashboard/prism` → 기존 prism 페이지 (URL 보존 확인)

Expected: 6 URL 모두 200 OK + 정상 렌더.

---

## Task 6: PR 생성

**Files:** 없음 (PR)

- [ ] **Step 1: push**

```bash
git push -u origin refactor/vc-pivot-phase-1
```

Expected: branch가 GitHub에 push됨.

- [ ] **Step 2: PR 생성**

```bash
gh pr create --title "refactor(nav): VC simulator pivot — Phase 1 sidebar + routing" --body "$(cat <<'EOF'
## Summary

- VC simulator를 `/dashboard` 홈으로 승격
- 사이드바를 6개 → 2개 (Dashboard + Connections) 로 단순화
- 기존 라우트 (`/dashboard/market-gap`, `/mmm`, `/prism`, `/vc-simulation`) URL과 코드 모두 보존

Spec: `docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md`

## Test plan

- [ ] `/dashboard` 진입 시 VC sim 콘텐츠 노출
- [ ] `/dashboard/vc-simulation` 직접 진입도 동일 콘텐츠
- [ ] 사이드바에 Dashboard + 데이터 연결만 노출
- [ ] 기존 4개 hidden 라우트 직접 URL 진입 시 200 OK + 정상 렌더
- [ ] `npm run build` 통과
- [ ] `npm test` 254개 PASS

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL 출력. `@coderabbitai review` 코멘트 자동 추가 (CLAUDE.md §10.4 hook).

- [ ] **Step 3: PR URL을 사용자에게 보고**

Mike에게 PR URL 전달. Vercel preview URL이 hook으로 자동 추가되면 함께 전달.

---

## Self-Review (작성자 점검 완료)

**1. Spec coverage:**
- Spec §3 IA → Task 4 (사이드바 정리) + Task 2/3 (`/dashboard` 승격) 커버.
- Spec §9 Phase 1 항목 5개 (사이드바 항목 제거 / Connections 위치 / `/dashboard` thin wrapper / `/dashboard/vc-simulation` 보존 / 라우트 보존) 모두 커버.
- Spec §9 Phase 1 "301 리다이렉트" 항목은 본 plan에서 *연기* — Mike와 합의된 IA 표가 "URL 보존 + 사이드바만 정리" 라 redirect는 Phase 6 정리에서 다룸. 본 phase에서 동일 콘텐츠가 두 URL에 노출되는 건 의도된 임시 상태.

**2. Placeholder scan:** TBD/TODO/구체성 부족 표현 없음. 모든 step에 실제 코드/명령어 포함.

**3. Type consistency:**
- `VcSimulationPageContent` — Task 2에서 정의, Task 3에서 동일 이름으로 사용. ✅
- `CategoryId` — Task 4 Step 4에서 `'overview' | 'settings'` 로 좁힘. 기존 `'market' | 'channel' | 'experiments'` 참조가 있을 경우 Step 5에서 grep으로 잡아 수정. ✅

**4. 위험 요소:**
- `useVcSimulation` / `useGameData` 훅이 `useSelectedGame`의 portfolio vs 단일 게임 분기를 다르게 다룰 수 있음 → vc-simulation 페이지가 portfolio 모드에서 어떻게 동작했는지 사전 확인 권장. 만약 portfolio 모드에서 깨졌었다면 `/dashboard` 홈에서도 동일하게 깨짐. *Phase 1 완료 후 Mike의 시각 검증에서 발견 시 fast-follow.*
