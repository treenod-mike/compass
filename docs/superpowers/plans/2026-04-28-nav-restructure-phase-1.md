# Navigation Restructure Phase 1 — Header Simplification + Sidebar Brand Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compass 헤더의 브랜드(CompassMark + COMPASS 워드마크)와 GameSelector를 사이드바 상단으로 이동시켜, gameboard 와 동일한 1행 헤더 + 풀 패널 사이드바 구조를 만든다. 헤더는 `[≡ 토글 | CategoryTabs | DateRangePicker + StaleChip]` 단일 행만 남는다.

**Architecture:** 사이드바를 `top: 0 / height: 100vh` 풀 패널로 전환하고, 상단에 BrandAndProduct(refactored: collapsed/expanded mode)를 새로 배치. AppTopBar는 BrandAndProduct·DateRangePicker 직접 렌더링을 제거하고 `<CategoryTabs rightSlot={...}>` 단일 자식만 갖는다. 모든 변경은 사이드바 width(76/220)와 메인 margin-left 로직 그대로 두기 때문에 이미 작동하는 `mainMarginLeft` 계산은 무변경. 헤더 높이는 ResizeObserver 가 동적 측정 (CSS 변수 `--app-top-bar-height` 자동 갱신).

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind v4 · Framer Motion · Iconify Solar · Radix UI tooltip · Zustand (selected-game store)

---

## File Structure

### 수정 대상

| 파일 | 책임 | 변경 성격 |
|---|---|---|
| `src/widgets/navigation/ui/brand-and-product.tsx` | 브랜드 + GameSelector | **Refactor** — props (`isCollapsed`, `showExpandedContent`) 추가, 사이드바 호환 layout 으로 전환 |
| `src/widgets/navigation/ui/category-sidebar.tsx` | 좌측 사이드바 | **Add top section** (BrandAndProduct + divider), **change positioning** (`top: 0`, `height: 100vh`) |
| `src/widgets/navigation/ui/app-top-bar.tsx` | 상단 헤더 | **Simplify** — 2-row → 1-row, BrandAndProduct 제거, DateRangePicker + StaleChip → CategoryTabs `rightSlot` 으로 이전 |
| `src/widgets/navigation/ui/category-tabs.tsx` | 카테고리 탭 스트립 | **Add `rightSlot` prop** (기존 props 유지) |

### 변경 없음 (Phase 1 범위 밖)

- `src/widgets/navigation/ui/layout-wrapper.tsx` — 메인 margin-left 로직, ResizeObserver 모두 그대로
- `src/widgets/navigation/ui/sidebar-footer.tsx`
- `src/widgets/navigation/model/constants.ts` — `TOP_BAR_HEIGHT` 상수는 더 이상 사이드바 top offset 으로 사용 안 함 (deprecated 주석은 후속 plan)
- `src/styles/globals.css` — `--app-top-bar-height` 동적 측정 그대로
- `src/widgets/dashboard/ui/game-selector.tsx`, `date-range-picker.tsx` — 호출 위치만 변경, 컴포넌트 자체 무변경
- `src/shared/api/prior-data.ts` — `isPriorStale`/`priorAgeDays` 그대로 사용
- `src/shared/ui/page-header.tsx` (44줄, gameboard 측은 디렉토리화 + 테스트 — Phase 후속)
- `category-tabs.tsx` 의 mega-menu per-tab 구조 (현재 단일 wide 드롭다운 그대로 유지) — Phase 2

### 보존되는 Compass 정체성 (절대 변경 금지)

- **CompassMark SVG** (custom 16x16 viewBox 나침반 바늘)
- **"COMPASS" Rocko Ultra 워드마크** (font-family, fontSize 30px, textShadow 그대로)
- **GameSelector** 그대로 import + render (Zustand `useSelectedGame` 의존)
- **`isPriorStale()` chip** (signal-caution 토큰)
- **DateRangePicker** 그대로
- **`UtilityTab`** in CategoryTabs — Compass 의 "관리/connections" 직접 링크 (gameboard 는 사이드바 footer 로 보냄. Compass 는 단일 페이지라 직접 링크가 합리적)
- **i18n (`useLocale`/`t`)** — CategoryTabs/MegaSection 안 라벨 모두 i18n 통과
- **Iconify Solar** 아이콘셋

---

## Task 0: Worktree 셋업

### Task 0.1: 새 worktree 생성

**Files:** N/A (git operation)

- [ ] **Step 1: main 워크트리에서 worktree 생성 + 의존성 설치**

```bash
cd "/Users/mike/Downloads/Project Compass"
git worktree add ../compass-worktrees/refactor-nav-phase-1 -b refactor/nav-restructure-phase-1
cd ../compass-worktrees/refactor-nav-phase-1
npm install --legacy-peer-deps
```

Expected: `../compass-worktrees/refactor-nav-phase-1/` 생성, `refactor/nav-restructure-phase-1` 브랜치 main 에서 분기, 의존성 설치 완료.

- [ ] **Step 2: dev server 백그라운드 실행 (시각 회귀 검증용)**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/dashboard` light/dark 모두 정상 렌더 baseline 확인.

- [ ] **Step 3: 이후 모든 task 는 새 worktree 안에서 실행**

---

## Phase A: BrandAndProduct refactor (사이드바 호환)

### Task 1: BrandAndProduct 에 collapsed/expanded mode 추가

**Files:**
- Modify: `src/widgets/navigation/ui/brand-and-product.tsx`

**컨텍스트**: 현재 `BrandAndProduct` 는 헤더 좌측에서 `<CompassMark /> + COMPASS wordmark + divider + <GameSelector w-[200px]>` 한 줄 layout. Phase 1 후엔 사이드바 상단에서:
- collapsed 시: `<CompassMark />` 만 (사이드바 폭 76px 의 가운데에 정렬, 28×28 아이콘)
- expanded 시: `<CompassMark /> + COMPASS wordmark + GameSelector` 세로 layout

#### Step 1: props 인터페이스 추가

기존 (파일 상단):
```ts
export function BrandAndProduct() {
```

변경:
```ts
interface BrandAndProductProps {
  /** 사이드바 collapsed 상태 */
  isCollapsed?: boolean
  /** width 애니메이션 완료 후 텍스트/세컨더리 콘텐츠 fade-in 트리거 */
  showExpandedContent?: boolean
}

export function BrandAndProduct({
  isCollapsed = false,
  showExpandedContent = true,
}: BrandAndProductProps = {}) {
```

#### Step 2: 컨테이너를 세로 layout 으로 + 패딩 일관성

기존:
```tsx
return (
  <div className="flex items-center gap-3 min-w-0 ml-2">
    ...
  </div>
)
```

변경:
```tsx
return (
  <div
    className={cn(
      'flex flex-col items-stretch min-w-0 transition-[padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
      isCollapsed ? 'items-center px-2 pt-3 pb-2' : 'px-4 pt-3 pb-3 gap-3',
    )}
  >
    ...
  </div>
)
```

`cn` 은 `@/shared/lib/utils` 에서 import. 파일 상단 import 추가:
```ts
import { cn } from '@/shared/lib/utils'
```

#### Step 3: 로고 + 워드마크 영역을 collapsed/expanded 분기

기존 `<TooltipProvider>` 래핑 `<Link>` 안의 `<div>` (CompassMark + COMPASS span):

```tsx
<Link
  href="/dashboard"
  className="flex items-center gap-2.5 shrink-0 text-primary"
  aria-label="대시보드로 돌아가기"
>
  <CompassMark />
  <span style={{...}}>COMPASS</span>
</Link>
```

변경 (워드마크에 fade 추가, collapsed 시 숨김):

```tsx
<Link
  href="/dashboard"
  className={cn(
    'flex items-center shrink-0 text-primary',
    isCollapsed ? 'justify-center' : 'gap-2.5',
  )}
  aria-label="대시보드로 돌아가기"
>
  <CompassMark />
  <span
    className="leading-none whitespace-nowrap overflow-hidden inline-block"
    style={{
      fontFamily: "'Rocko Ultra', 'Pretendard Variable', sans-serif",
      fontSize: "30px",
      fontWeight: 900,
      letterSpacing: "-0.015em",
      textShadow: "0 1px 0 rgba(145,40,180,0.15)",
      maxWidth: showExpandedContent ? '200px' : '0px',
      opacity: showExpandedContent ? 1 : 0,
      transition: 'max-width 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s cubic-bezier(0.4,0,0.2,1)',
      pointerEvents: showExpandedContent ? 'auto' : 'none',
    }}
  >
    COMPASS
  </span>
</Link>
```

#### Step 4: divider 제거 + GameSelector 분기 처리

기존 (Link 다음):
```tsx
<div className="h-6 w-px bg-border shrink-0" aria-hidden />

<div className="w-[200px] shrink-0">
  <GameSelector />
</div>
```

변경 (collapsed 시 GameSelector 숨김 — 사이드바 폭 76px 에 200px GameSelector 들어가지 않음):

```tsx
{!isCollapsed && (
  <div
    className="overflow-hidden"
    style={{
      maxHeight: showExpandedContent ? '60px' : '0px',
      opacity: showExpandedContent ? 1 : 0,
      transition: 'max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s cubic-bezier(0.4,0,0.2,1)',
      pointerEvents: showExpandedContent ? 'auto' : 'none',
    }}
  >
    <GameSelector />
  </div>
)}
```

#### Step 5: tsc 통과 확인

```bash
npx tsc --noEmit
```

Expected: 0 error.

#### Step 6: 커밋

```bash
git add src/widgets/navigation/ui/brand-and-product.tsx
git commit -m "refactor(brand-and-product): add collapsed/expanded modes for sidebar embedding"
```

---

## Phase B: 사이드바에 BrandAndProduct 삽입 + top:0 풀 패널

### Task 2: CategorySidebar 상단에 BrandAndProduct 삽입

**Files:**
- Modify: `src/widgets/navigation/ui/category-sidebar.tsx`

#### Step 1: import 추가

기존 import 그룹 끝 (line ~33 근처, `import { SidebarFooter } from './sidebar-footer'` 직전):

```ts
import { BrandAndProduct } from './brand-and-product'
```

#### Step 2: `<motion.aside>` 의 `top` / `height` style 변경

기존 (line ~108 부근):
```tsx
style={{
  overflow: 'hidden',
  willChange: 'transform, width',
  ...(isMobileOpen
    ? {}
    : {
        top: 'var(--app-top-bar-height, 113px)',
        height: 'calc(100vh - var(--app-top-bar-height, 113px))',
      }),
}}
```

변경:
```tsx
style={{
  overflow: 'hidden',
  willChange: 'transform, width',
  ...(isMobileOpen ? {} : { top: 0, height: '100vh' }),
}}
```

#### Step 3: `<motion.aside>` 의 `<nav>` 요소 직전에 BrandAndProduct + divider 삽입

기존 (line ~118 부근):
```tsx
<motion.aside ...>
  <nav
    className="flex-1 pt-4 pb-4 overflow-y-auto overflow-x-hidden"
    ...
  >
```

변경:
```tsx
<motion.aside ...>
  <div className="shrink-0">
    <BrandAndProduct
      isCollapsed={isCollapsed}
      showExpandedContent={showExpandedContent}
    />
  </div>

  <div
    className="shrink-0 h-px bg-border transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
    style={{
      marginLeft: isCollapsed ? PADDING_COLLAPSED : PADDING_EXPANDED,
      marginRight: isCollapsed ? PADDING_COLLAPSED : PADDING_EXPANDED,
    }}
  />

  <nav
    className="flex-1 pt-4 pb-4 overflow-y-auto overflow-x-hidden"
    ...
  >
```

#### Step 4: tsc 통과

```bash
npx tsc --noEmit
```

Expected: 0 error.

#### Step 5: dev server 시각 확인

브라우저에서 `http://localhost:3000/dashboard` :
- 사이드바 expanded: 상단 CompassMark + COMPASS + GameSelector + divider + 메뉴
- 사이드바 collapsed: 상단 CompassMark 만 + divider + 메뉴 아이콘들
- collapse/expand toggle 시 워드마크/GameSelector 자연스럽게 fade

이 시점에선 헤더가 아직 옛 layout (BrandAndProduct 가 헤더에도 있음 — **중복 표시**가 정상). 다음 task 에서 헤더 BrandAndProduct 제거.

#### Step 6: 커밋

```bash
git add src/widgets/navigation/ui/category-sidebar.tsx
git commit -m "feat(category-sidebar): embed BrandAndProduct + top:0 full-panel layout"
```

---

## Phase C: 헤더 단순화 + rightSlot 도입

### Task 3: CategoryTabs 에 `rightSlot` prop 추가

**Files:**
- Modify: `src/widgets/navigation/ui/category-tabs.tsx`

#### Step 1: 인터페이스에 `rightSlot` 추가

기존 (line ~22):
```ts
interface CategoryTabsProps {
  items: NavigationItem[]
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
}
```

변경:
```ts
interface CategoryTabsProps {
  items: NavigationItem[]
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
  /** 헤더 우측 영역에 추가할 컨트롤 (DateRangePicker, StaleChip 등) */
  rightSlot?: React.ReactNode
}
```

#### Step 2: 함수 시그니처에 `rightSlot` destructure

기존:
```tsx
export function CategoryTabs({ items, onToggleSidebar, isSidebarCollapsed }: CategoryTabsProps) {
```

변경:
```tsx
export function CategoryTabs({
  items,
  onToggleSidebar,
  isSidebarCollapsed,
  rightSlot,
}: CategoryTabsProps) {
```

#### Step 3: utility 탭 자리 뒤에 `rightSlot` 렌더 (현재 utility 탭 그대로 유지 — Compass 정체성)

기존 (파일 끝부분 `</div>` 직전):
```tsx
        <div className="flex-1" />
        <div className="flex items-stretch">
          {utilityTabs.map((meta) => (
            <UtilityTab ... />
          ))}
        </div>
      </div>
    </div>
  )
}
```

변경:
```tsx
        <div className="flex-1" />
        <div className="flex items-stretch">
          {utilityTabs.map((meta) => (
            <UtilityTab ... />
          ))}
        </div>
        {rightSlot && (
          <div className="flex items-center gap-3 shrink-0 pl-3 pr-2">
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  )
}
```

#### Step 4: tsc

```bash
npx tsc --noEmit
```

Expected: 0 error.

#### Step 5: 커밋

```bash
git add src/widgets/navigation/ui/category-tabs.tsx
git commit -m "feat(category-tabs): add rightSlot prop for header controls"
```

### Task 4: AppTopBar 1행 단순화 + DateRangePicker/StaleChip 을 rightSlot 으로 이전

**Files:**
- Modify: `src/widgets/navigation/ui/app-top-bar.tsx`

#### Step 1: 전체 컴포넌트 본문 교체

기존 (전체 파일):
```tsx
'use client'

import { navigationItems } from '@/shared/config/navigation'
import { DateRangePicker } from '@/widgets/dashboard/ui/date-range-picker'
import { BrandAndProduct } from './brand-and-product'
import { CategoryTabs } from './category-tabs'
import { isPriorStale, priorAgeDays } from '@/shared/api/prior-data'

interface AppTopBarProps {
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
}

/**
 * AppTopBar — 2행 레이아웃:
 *   Row 1: [BrandAndProduct (로고 + Game selector)] ← 좌 | 우 → [DateRangePicker]
 *   Row 2: [CategoryTabs (투자 판정 / 시장 포지셔닝)]
 */
export function AppTopBar({ onToggleSidebar, isSidebarCollapsed }: AppTopBarProps = {}) {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-2">
        <BrandAndProduct />
        <div className="flex items-center gap-3 shrink-0 pr-2">
          {isPriorStale() && (
            <div className="bg-signal-caution/10 text-signal-caution rounded-inline px-2 py-1 text-xs">
              Prior 데이터 {priorAgeDays()}일 경과 — npm run crawl:st 권장
            </div>
          )}
          <DateRangePicker />
        </div>
      </div>
      <CategoryTabs
        items={navigationItems}
        onToggleSidebar={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
      />
    </header>
  )
}
```

변경 (전체 파일):
```tsx
'use client'

import { navigationItems } from '@/shared/config/navigation'
import { DateRangePicker } from '@/widgets/dashboard/ui/date-range-picker'
import { CategoryTabs } from './category-tabs'
import { isPriorStale, priorAgeDays } from '@/shared/api/prior-data'

interface AppTopBarProps {
  onToggleSidebar?: () => void
  isSidebarCollapsed?: boolean
}

/**
 * AppTopBar — 1행 레이아웃 (gameboard 와 동일 구조):
 *   [≡ 사이드바 토글 | CategoryTabs (primary/utility) | rightSlot (StaleChip + DateRangePicker)]
 *
 * 브랜드(CompassMark + COMPASS 워드마크) 와 GameSelector 는 사이드바 상단으로 이동됨.
 */
export function AppTopBar({ onToggleSidebar, isSidebarCollapsed }: AppTopBarProps = {}) {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <CategoryTabs
        items={navigationItems}
        onToggleSidebar={onToggleSidebar}
        isSidebarCollapsed={isSidebarCollapsed}
        rightSlot={
          <>
            {isPriorStale() && (
              <div className="bg-signal-caution/10 text-signal-caution rounded-inline px-2 py-1 text-xs">
                Prior 데이터 {priorAgeDays()}일 경과 — npm run crawl:st 권장
              </div>
            )}
            <DateRangePicker />
          </>
        }
      />
    </header>
  )
}
```

`BrandAndProduct` import 는 제거 (사이드바에서만 사용).

#### Step 2: tsc 통과

```bash
npx tsc --noEmit
```

Expected: 0 error.

#### Step 3: dev server 시각 확인 (이 단계에서 헤더 1행 단순화 완료)

`http://localhost:3000/dashboard` :
- 헤더 = `[≡ 토글 | 종합/시장/MMM/VC sim 탭 | 관리 탭 | StaleChip + DateRangePicker]` 1행
- 헤더 높이: 자동 측정 (ResizeObserver) → ~48-56px (기존 113px 의 절반 미만)
- 사이드바 = 풀 패널 (top:0~100vh), 상단 CompassMark + COMPASS + GameSelector + divider + 메뉴
- 메인 콘텐츠 영역 = 헤더 아래 자동으로 끌어올려짐 (`--app-top-bar-height` 동적 갱신)
- light/dark 모두 시각 회귀 0

#### Step 4: 커밋

```bash
git add src/widgets/navigation/ui/app-top-bar.tsx
git commit -m "refactor(app-top-bar): single-row layout, brand+selector moved to sidebar"
```

---

## Phase D: 검증 + PR

### Task 5: 풀 회귀 검증

#### Step 1: tsc

```bash
npx tsc --noEmit
```

Expected: 0 error.

#### Step 2: 전체 테스트

```bash
npm test
```

Expected: 전체 PASS, 회귀 0. 본 plan 은 layout 변경이라 unit test 영향 매우 낮음 — 실패 시 무관한 회귀 가능성 높으니 우선 메시지 확인.

#### Step 3: dev server 수동 시각 회귀 (Mike 가 수행)

각 페이지 light/dark 양쪽:

| 페이지 | 확인 포인트 |
|---|---|
| `/dashboard` (Overview) | KPI cards / Verdict / Heatmap / RevenueForecast 모두 정상, 사이드바 expand/collapse 시 메인 영역 자연 이동 |
| `/dashboard/market-gap` | Bayesian PriorPosterior 차트 가로폭 정상 |
| `/dashboard/mmm` | CPI 벤치 테이블 + Quadrant 정상 |
| `/dashboard/vc-simulation` | ROAS chart / KPI tiles 정상 |
| `/dashboard/connections` | UtilityTab "관리" 클릭 → 정상 진입 |
| `/dashboard/prism` | 전체 layout 정상 |

추가 확인:
- 사이드바 collapse/expand 토글 → 텍스트 fade + width 애니 자연
- `--app-top-bar-height` CSS 변수 (DevTools): 기존 113px → 단일 행 높이로 변경됨 확인
- `isPriorStale()` true 일 때 chip 이 헤더 우측에 표시 (DateRangePicker 옆)
- GameSelector 드롭다운: 사이드바 안에서 클릭 → 게임 변경 시 모든 차트가 새 게임 데이터로 갱신 (Zustand store)

### Task 6: PR 생성

#### Step 1: push

```bash
git push -u origin refactor/nav-restructure-phase-1
```

#### Step 2: gh pr create

```bash
gh pr create --title "refactor(nav): Phase 1 — header simplification + sidebar brand integration" --body "$(cat <<'EOF'
## Summary
gameboard 의 1행 헤더 + 풀 패널 사이드바 구조를 Compass 에 이식. 브랜드(CompassMark + COMPASS 워드마크) 와 GameSelector 가 사이드바 상단으로 이동, 헤더는 `[≡ 토글 | 탭 | StaleChip + DateRangePicker]` 단일 행만 남음.

### 변경
- `brand-and-product.tsx` — `isCollapsed` / `showExpandedContent` props 추가, 사이드바 호환 layout
- `category-sidebar.tsx` — 상단에 BrandAndProduct + divider, `top: 0 / height: 100vh` 풀 패널 전환
- `category-tabs.tsx` — `rightSlot` prop 추가
- `app-top-bar.tsx` — 2-row → 1-row 단순화, DateRangePicker / StaleChip 을 CategoryTabs `rightSlot` 으로 이전

### 보존
- CompassMark, "COMPASS" Rocko Ultra 워드마크, GameSelector, DateRangePicker, StaleChip 모두 그대로
- UtilityTab (관리/connections 직접 링크) 헤더 위치 유지
- i18n / Iconify Solar 그대로

관련 spec: \`docs/superpowers/specs/2026-04-27-gameboard-design-system-alignment-design.md\` §3.3 (drift sync) + 본 plan
관련 plan: \`docs/superpowers/plans/2026-04-28-nav-restructure-phase-1.md\`

## Test plan
- [ ] \`npm test\` 전체 PASS
- [ ] \`npx tsc --noEmit\` 0 error
- [ ] dev server 에서 모든 페이지 (Overview / Market Gap / MMM / VC sim / Connections / PRISM) light/dark 시각 회귀 0
- [ ] 사이드바 collapse/expand 토글 시 워드마크 + GameSelector fade 자연
- [ ] GameSelector 변경 → 모든 차트 갱신 (Zustand store 정상)

## Phase 후속 (별도 plan)
- Phase 2: 탭별 1:1 드롭다운 (per-tab mega menu)
- Phase 3: z-index 시맨틱 토큰 적용 (z-app-top-bar / z-sidebar / z-mega-menu / z-modal)
- Phase 4: 사이드바 Section 라벨 + collapsed 1px 구분선 + rounded-full 통일 + 로고 crossfade 폴리시
EOF
)"
```

Expected: PR URL 출력. 하네스가 자동으로 `@coderabbitai review` + Vercel preview URL 코멘트 추가.

---

## Risks & Rollback

| 위험 | 완화 |
|---|---|
| 사이드바 풀 패널 전환으로 메인 콘텐츠가 헤더 아래에서 잘리거나 겹침 | `layout-wrapper.tsx` 의 `--app-top-bar-height` ResizeObserver + main `marginLeft` 로직이 그대로라 자동 보정. dev server 에서 즉시 확인. 회귀 시 Task 2 Step 2 의 `top` style 만 되돌리면 복구 |
| GameSelector (200px 폭) 가 collapsed 사이드바 (76px) 에 들어가지 않음 | Task 1 Step 4 에서 `{!isCollapsed && (...)}` 조건부 렌더로 collapsed 시 hide. 옵션으로 표시도 가능하나 Phase 1 범위 밖 |
| BrandAndProduct 이중 렌더 (헤더 + 사이드바) 시 일시적 중복 | Task 2 머지 후 Task 4 머지 전까지 중복. Phase A→B→C 순차 커밋이라 단일 PR 안에서만 발생, 외부 가시 노출 없음 |
| 사이드바 height 100vh 로 인한 mobile/sticky 상호작용 변화 | Mobile (`isMobileOpen`) 분기는 그대로 — 영향 없음. Desktop 만 변경. light/dark mobile responsive 도 시각 확인 |
| Rocko Ultra 워드마크가 collapsed 사이드바 가운데 정렬 시 잘림 | Task 1 Step 3 의 `maxWidth: 0px` opacity 0 처리로 collapsed 시 완전 숨김. fade 애니메이션도 자연 |

### Rollback 전략
- Task 별 단일 커밋 → 문제 발견 시 `git revert <commit>` 단위 복구
- 가장 안전한 head 위치: Task 1 (BrandAndProduct refactor) 까지만 머지 + Task 2~4 revert → 헤더 옛 layout + BrandAndProduct 새 props 만 있는 상태 (props 미사용이라 무해)

---

## Self-Review

### Spec coverage
- [x] gameboard 1행 헤더 구조 이식 — Task 4
- [x] 사이드바 풀 패널 + 브랜드 통합 — Task 2
- [x] CompassMark / COMPASS 워드마크 / GameSelector 보존 — Task 1
- [x] DateRangePicker / StaleChip 보존 (위치만 rightSlot) — Task 4
- [x] UtilityTab 헤더 위치 유지 (Compass 도메인) — Task 3 (utilityTabs map 그대로)
- [x] i18n / Iconify Solar 그대로 — 어느 task 도 dictionary 미수정
- [x] Phase 2 / 3 / 4 모두 Future Work 로 분리

### Placeholder scan
- 없음. 모든 코드 블록은 실제 변경 코드.

### Type consistency
- `BrandAndProductProps` 의 `isCollapsed`, `showExpandedContent` → Task 2 에서 동일 시그니처로 호출
- `CategoryTabsProps` 의 `rightSlot: React.ReactNode` → Task 4 에서 `<>...</>` Fragment 로 전달 (호환)
- `CategorySidebar` 의 기존 `showExpandedContent` 로컬 변수 그대로 사용 — 새 prop 추가 없음

---

## Future Work (별도 plan)

| Phase | 범위 | 우선순위 |
|---|---|---|
| Phase 2: 탭별 1:1 드롭다운 (mega per-tab) | category-tabs 큰 수술 (단일 wide → 탭당 240px 드롭다운) | 본 PR 머지 후 |
| Phase 3: z-index 시맨틱 토큰 사이드바·헤더·드롭다운 적용 | hardcoded `z-[70]` / `z-50` / `z-[9999]` → `z-sidebar` / `z-app-top-bar` / `z-mega-menu` / `z-modal` 등 | Phase 2 머지 후 |
| Phase 4: 사이드바 폴리시 (Section 라벨 + collapsed 1px 구분선, rounded-full 통일, max-width 애니, 로고 icon↔full crossfade) | 사이드바 디테일 마감 | Phase 3 머지 후 |
| (옵션) 모바일 드로어 + 포커스 트랩 | gameboard `category-tabs` 의 `createPortal` + AnimatePresence 모바일 시트 차용. Compass 가 mobile 진지하게 지원하면 | 후순위 |
| (옵션) 즐겨찾기 (TopbarFavoriteButton + FloatingFavorites) | gameboard 의 즐겨찾기 시스템. Compass 페이지 6~7개라 가치 낮음 | 보류 권장 |

---

## References

- gameboard repo (treenod/gameboard) — `src/widgets/navigation/ui/{category-sidebar, app-top-bar, brand-and-product, category-tabs}.tsx` (main = `cb215a4`)
- 정렬 spec: `docs/superpowers/specs/2026-04-27-gameboard-design-system-alignment-design.md`
- 정렬 foundation PR: `89bc488 refactor(design-system): foundation — token sync + nav drift (#24)` (Phase 1+2 = 토큰 sync + nav drift 작은 변경. 본 plan = Phase 3 = 큰 구조 재배치)
