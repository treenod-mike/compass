# Gameboard Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compass 의 brand-purple 정체성을 보존한 채로 cohort5 톤 분리 + 6개 navigation 컴포넌트 + page-header + globals.css 의 gameboard drift 를 정렬한다 (spec 의 Phase 1 + Phase 2 = "Foundation"). 후속 plan(chart-container · metric-card · 24차트 마이그레이션) 의 기반.

**Architecture:** Foundation 작업 전체를 단일 worktree + 단일 PR 로 묶는다. 두 phase 모두 작은 변경이고 시각 검증 의존이라 PR 분리 비용이 회귀 보호 이득보다 크기 때문. 흐름: 토큰 변경 → navigation drift sync → light/dark 양쪽 회귀 검증 → PR.

**Tech Stack:** Next.js 15 (App Router) · Tailwind v4 · TDS tokens · TypeScript · Vitest · Framer Motion

---

## File Structure

### 수정 대상

| 파일 | 책임 | 변경 성격 |
|---|---|---|
| `src/shared/config/chart-colors.ts` | 차트 hex 팔레트 (TDS mirror) | `PALETTE.cohort5` 한 줄 |
| `src/styles/globals.css` | TDS 토큰 (light/dark) | drift sync, brand 7개 토큰 절대 보존 |
| `src/widgets/navigation/ui/app-top-bar.tsx` | 상단바 (brand + tabs) | 작은 drift (40→58라인) |
| `src/widgets/navigation/ui/brand-and-product.tsx` | 로고 + 제품 셀렉터 | Compass 도메인 보존 (82>52라인) |
| `src/widgets/navigation/ui/category-tabs.tsx` | 카테고리 탭 row | **큰 drift** (269→478라인) |
| `src/widgets/navigation/ui/sidebar-footer.tsx` | 사이드바 footer | Compass 도메인 보존 (78>22라인) |
| `src/widgets/navigation/ui/category-sidebar.tsx` | 좌측 사이드바 | 작은 drift (259≈261라인) |
| `src/shared/ui/page-header.tsx` | 페이지 헤더 (sticky) | **큰 drift** (27→181라인) — 호출처 5+ 페이지 마이그레이션 |

### 변경 없음 (Compass 고유 — 보존)

- `src/widgets/navigation/ui/layout-wrapper.tsx` (gameboard 에 동명 파일 없음)
- 모든 페이지 (`src/app/(dashboard)/dashboard/**/page.tsx`)
- 차트 위젯 (`src/widgets/charts/ui/*.tsx`)
- 도메인 로직 (`src/shared/lib/**`, `src/shared/api/**`)
- 결정 OS 시그니처 (`decision-surface.tsx` · `methodology-modal.tsx` · `compass-logo.tsx`)

---

## Task 0: Worktree 셋업

### Task 0.1: 새 worktree 생성

**Files:** N/A (git operation)

- [ ] **Step 1: 사용자가 main 워크트리에서 다음 명령 실행 (또는 동등한 manual 명령)**

```bash
# 권장: 자동화 커맨드
/compass-start refactor design-system-foundation

# 또는 manual:
cd /Users/mike/Downloads/Project\ Compass
git worktree add ../compass-worktrees/refactor-design-system-foundation -b refactor/design-system-foundation
cd ../compass-worktrees/refactor-design-system-foundation
npm install --legacy-peer-deps
```

Expected: 새 워크트리 `../compass-worktrees/refactor-design-system-foundation` 가 생성되고 의존성 설치 완료. 브랜치 `refactor/design-system-foundation` 이 main 에서 분기.

- [ ] **Step 2: dev server 백그라운드 실행 (Foundation 검증용 — 모든 후속 task 가 의존)**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000/dashboard` 가 정상 렌더되는지 확인.

- [ ] **Step 3: 이후 task 는 모두 새 worktree (`../compass-worktrees/refactor-design-system-foundation`) 안에서 실행**

---

## Phase 1: Token Sync + Cohort5 Tone Separation

### Task 1.1: cohort5 톤 분리

**Files:**
- Modify: `src/shared/config/chart-colors.ts:28`

영향 위젯: `retention-curve` · `cohort-heatmap` · `prior-posterior-chart` · `revenue-forecast` 등 cohort5 사용 차트.

- [ ] **Step 1: chart-colors.ts:28 의 cohort5 hex 변경**

변경 전:
```ts
cohort5:       "#9128b4",  // --chart-5 purple (brand)
```

변경 후:
```ts
cohort5:       "#b44bd7",  // --purple-400 (톤 분리: brand=600, cohort=400)
```

- [ ] **Step 2: tsc 통과 확인**

```bash
npx tsc --noEmit
```
Expected: 0 error.

- [ ] **Step 3: dev server 에서 cohort5 사용 차트 시각 확인**

브라우저에서 다음 페이지 열기:
- `http://localhost:3000/dashboard` — RetentionCurve, CohortHeatmap
- `http://localhost:3000/dashboard/market-gap` — PriorPosteriorChart

확인:
- 코호트5 라인/영역이 brand 보라(#9128b4)로 그려지는 P50 라인과 시각적으로 분리되어 보이는가
- 다크 모드(theme toggle)에서도 동일한가

- [ ] **Step 4: commit**

```bash
git add src/shared/config/chart-colors.ts
git commit -m "$(cat <<'EOF'
refactor(design-tokens): split cohort5 tone from brand purple

cohort5(#9128b4) was sharing the same hex as the brand primary, causing
visual collisions on charts where the Bayesian P50 line and cohort 5
series overlap. Promote cohort5 to purple-400 (#b44bd7) so brand=600 and
cohort=400 form a clear tone hierarchy.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: globals.css drift sync

**Files:**
- Modify: `src/styles/globals.css`

브랜드 7개 토큰은 절대 보존:
- `:30 --primary: #9128b4` · `:56 --ring: #9128b4` · `:65 --brand-line: #9128b4` · `:70 --sidebar-primary: #9128b4` · `:75 --sidebar-ring: #9128b4` · `:155 --theme-btn-color: #9128b4` · `:157 --theme-tooltip-bg: #9128b4` · `:160 --abtest-color-0: #9128b4`
- 다크 측: `:211 --primary: #f9fafb` · `:213 --ring: #f9fafb` · `:245 --brand-line: #f9fafb` · `:250 --sidebar-primary: #f9fafb`

- [ ] **Step 1: gameboard 측 globals.css 가져오기**

```bash
gh api repos/treenod/gameboard/contents/app/globals.css --jq '.content' | base64 -d > /tmp/gameboard-globals.css
```

- [ ] **Step 2: diff 비교**

```bash
diff /tmp/gameboard-globals.css src/styles/globals.css | head -200
```

- [ ] **Step 3: 의미 있는 drift 만 흡수**

규칙:
- gameboard 에 새로 추가된 TDS 토큰 (예: 새로운 chart 토큰, 새로운 status 토큰, 새 typography scale 항목) 이 있다면 가져온다.
- light/dark 양쪽 토큰 정의를 정렬한다.
- **brand 7개 토큰 (위 목록) 의 hex 값은 절대 변경하지 않는다.**
- legacy alias 블록 (`--bg-0` ~ `--signal-pending`) 은 그대로 유지 (Compass 고유).
- `Rocko Ultra` 폰트 정의 (Compass 고유) 는 보존.

- [ ] **Step 4: tsc 통과 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: dev server 에서 모든 페이지 light/dark 양쪽 시각 검증**

페이지 목록:
- `/dashboard` · `/dashboard/market-gap` · `/dashboard/mmm` · `/dashboard/vc-simulation` · `/dashboard/connections` · `/dashboard/connections/appsflyer` · `/dashboard/prism`

확인 항목:
- primary 버튼 / sidebar active / ring focus 가 보라(#9128b4) 그대로
- bg / fg / border 토큰이 모드별로 의도대로 적용
- chart-1~20 색이 의도대로

- [ ] **Step 6: commit**

```bash
git add src/styles/globals.css
git commit -m "$(cat <<'EOF'
refactor(design-tokens): align globals.css drift with gameboard

Pull non-brand TDS token additions from gameboard (color/typography/chart
scale extensions) while preserving Compass identity:
- brand purple 7 tokens (primary, ring, brand-line, sidebar-primary,
  sidebar-ring, theme-btn-color, theme-tooltip-bg, abtest-color-0)
- legacy alias block (bg-0..bg-3, fg-0..fg-3, signal-*, etc.)
- Rocko Ultra font face (COMPASS wordmark)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Navigation Drift Sync

각 컴포넌트별 sub-commit. 모두 같은 worktree/브랜치에 누적되어 단일 PR 로 머지.

### Task 2.1: layout-wrapper.tsx — sync 불필요 확인

**Files:**
- Reference only: `src/widgets/navigation/ui/layout-wrapper.tsx`

- [ ] **Step 1: gameboard 에 동명 파일 부재 확인**

```bash
gh api repos/treenod/gameboard/contents/src/widgets/navigation/ui/layout-wrapper.tsx 2>&1 | grep -q '"Not Found"' && echo "GAMEBOARD HAS NO layout-wrapper — Compass is unique" || echo "EXISTS — needs diff"
```

Expected: `GAMEBOARD HAS NO layout-wrapper — Compass is unique`

이 결과면 layout-wrapper 는 Compass 고유 = 변경 없이 다음 task 로.

만약 `EXISTS` 가 나오면 Task 2.2 ~ 2.7 의 패턴(diff → 의미 있는 drift 흡수)을 적용.

### Task 2.2: app-top-bar.tsx drift sync (40 → 58 라인)

**Files:**
- Modify: `src/widgets/navigation/ui/app-top-bar.tsx`

- [ ] **Step 1: gameboard 측 코드 가져오기**

```bash
gh api repos/treenod/gameboard/contents/src/widgets/navigation/ui/app-top-bar.tsx --jq '.content' | base64 -d > /tmp/gb-app-top-bar.tsx
diff /tmp/gb-app-top-bar.tsx src/widgets/navigation/ui/app-top-bar.tsx | head -120
```

- [ ] **Step 2: 흡수 후보 식별**

gameboard 측에만 있는 패턴 후보 (실제는 diff 결과로 확정):
- `rightSlot` ReactNode prop (이미 Compass 측 interface 에 있음 — 사용처 다를 수 있음)
- backdrop blur 스타일 강도 차이
- supports-[backdrop-filter] 분기 차이
- BrandAndProduct 호출 시 추가 props

- [ ] **Step 3: 의미 있는 drift 만 흡수**

규칙:
- 기능적 추가 (예: `rightSlot` 사용처 확장, backdrop 강도 조정) 는 흡수.
- Compass 측 props/이름 (`onToggleSidebar`, `isSidebarCollapsed`) 은 보존.
- 색상 hex 직접 사용 없음 (이미 TDS 토큰 사용 중) — 검증.

- [ ] **Step 4: tsc + 시각 점검**

```bash
npx tsc --noEmit
```
브라우저에서 모든 페이지 상단바 light/dark 양쪽 확인. backdrop, 가로 정렬, BrandAndProduct 위치, CategoryTabs row 정렬.

- [ ] **Step 5: commit**

```bash
git add src/widgets/navigation/ui/app-top-bar.tsx
git commit -m "$(cat <<'EOF'
refactor(navigation): sync app-top-bar drift from gameboard

Pull non-domain drift while preserving Compass-side props
(onToggleSidebar, isSidebarCollapsed). Brand purple tokens unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

만약 흡수할 의미 있는 drift 가 없다면 commit 생략하고 다음 task 로.

### Task 2.3: brand-and-product.tsx — Compass 도메인 보존 확인

**Files:**
- Reference: `src/widgets/navigation/ui/brand-and-product.tsx`

Compass 82 라인 vs gameboard 52 라인. Compass 가 더 큰 이유는 Rocko Ultra wordmark / CompassLogo / decision-OS 전용 마크업 의존.

- [ ] **Step 1: diff 확인**

```bash
gh api repos/treenod/gameboard/contents/src/widgets/navigation/ui/brand-and-product.tsx --jq '.content' | base64 -d > /tmp/gb-brand-and-product.tsx
diff /tmp/gb-brand-and-product.tsx src/widgets/navigation/ui/brand-and-product.tsx | head -120
```

- [ ] **Step 2: 흡수 후보 vs 보존 식별**

보존 (Compass 도메인 의존):
- `CompassLogo` 사용
- Rocko Ultra wordmark
- COMPASS 브랜드 마크업

흡수 후보 (gameboard 측에만):
- 제품 셀렉터의 추가 인터랙션 (있다면)
- 호버/포커스 스타일

- [ ] **Step 3: 의미 있는 drift 만 흡수, 도메인 의존 보존**

- [ ] **Step 4: tsc + 시각 점검 (light/dark)**

- [ ] **Step 5: commit (변경 없으면 skip)**

```bash
git add src/widgets/navigation/ui/brand-and-product.tsx
git commit -m "$(cat <<'EOF'
refactor(navigation): minor brand-and-product polish from gameboard

Adopt non-domain styling drift; CompassLogo + Rocko Ultra wordmark
preserved as Compass identity.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.4: category-tabs.tsx drift sync (269 → 478 라인) — 큰 작업

**Files:**
- Modify: `src/widgets/navigation/ui/category-tabs.tsx`

gameboard 측이 거의 2배. 흡수할 기능이 다수 있을 가능성.

- [ ] **Step 1: gameboard 측 카테고리 탭 가져오기**

```bash
gh api repos/treenod/gameboard/contents/src/widgets/navigation/ui/category-tabs.tsx --jq '.content' | base64 -d > /tmp/gb-category-tabs.tsx
diff /tmp/gb-category-tabs.tsx src/widgets/navigation/ui/category-tabs.tsx | head -300
```

- [ ] **Step 2: gameboard 측 추가 기능 분류**

흡수 후보 (사용자가 명시한 "헤더/좌측 메뉴 차용" 의도와 부합하면 흡수):
- mobile menu 토글 (햄버거 → drawer)
- favorite/즐겨찾기 버튼
- 카테고리 별 추가 메타 (배지, 카운트 등)
- 키보드 네비게이션 (arrow keys, escape)

보류 (Compass 사용 패턴과 다르면 보류):
- gameboard 도메인 의존 (예: 게임별 권한 분기, gameboard 전용 카테고리)

보존 (Compass 측):
- `useCurrentProduct` · `useUserRoles` · `inferCategoryFromPath` 등 Compass 도메인 훅
- 색상은 모두 CSS var 사용 (이미 그러함 — 검증)

- [ ] **Step 3: 흡수 항목 적용**

큰 변경이라 step 을 sub-step 으로 분리:

3a. mobile menu 패턴 흡수 (있다면)
- 햄버거 버튼 추가 (UI에는 이미 `onToggleSidebar` 존재 — props 연결만 확인)
- mobile drawer 컴포넌트 추가
- desktop/mobile 분기 로직

3b. favorite 버튼 흡수 (gameboard 측에 `topbar-favorite-button.tsx` 별도 파일 있음 — 이건 추가 task 로 분리 가능)
- 본 plan 범위에서는 보류 (Future Work)

3c. 키보드 네비게이션 (있다면)

- [ ] **Step 4: tsc 통과 + Vitest 통과 확인**

```bash
npx tsc --noEmit
npm test -- --run src/widgets/navigation
```

- [ ] **Step 5: 시각 + 동작 검증**

- desktop light/dark 양쪽: 카테고리 탭 active 표시, hover, focus
- mobile (브라우저 dev tools 모바일 뷰): 햄버거 토글, drawer 동작
- 키보드: tab navigation, arrow keys (적용 시)

- [ ] **Step 6: commit**

```bash
git add src/widgets/navigation/ui/category-tabs.tsx
git commit -m "$(cat <<'EOF'
refactor(navigation): adopt gameboard category-tabs patterns

Pull non-domain features (mobile menu toggle, optional keyboard nav,
extra meta slots) while preserving Compass routing/role hooks
(useCurrentProduct, useUserRoles, inferCategoryFromPath). Brand purple
tokens unchanged. Favorite button kept as Future Work.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.5: sidebar-footer.tsx — Compass 도메인 보존 확인

**Files:**
- Reference: `src/widgets/navigation/ui/sidebar-footer.tsx`

Compass 78 라인 vs gameboard 22 라인. Compass 가 더 큰 = Compass 도메인 의존 (정보 표시, 게임 셀렉터 메타 등).

- [ ] **Step 1: diff 확인**

```bash
gh api repos/treenod/gameboard/contents/src/widgets/navigation/ui/sidebar-footer.tsx --jq '.content' | base64 -d > /tmp/gb-sidebar-footer.tsx
diff /tmp/gb-sidebar-footer.tsx src/widgets/navigation/ui/sidebar-footer.tsx | head -100
```

- [ ] **Step 2: 보존 위주 정책**

Compass 측 코드는 도메인 정보 표시. gameboard 측의 단순한 footer 패턴은 흡수하지 않고 Compass 측 그대로 유지.

흡수 후보 (만약 있다면):
- collapsed 모드의 최소화 마크업 (gameboard 패턴이 더 정돈되어 있다면)

- [ ] **Step 3: 변경 없거나 미세 적용**

- [ ] **Step 4: visual check (light/dark)**

- [ ] **Step 5: commit (변경 없으면 skip)**

### Task 2.6: category-sidebar.tsx drift sync (259 vs 261 라인 — 거의 동일)

**Files:**
- Modify: `src/widgets/navigation/ui/category-sidebar.tsx`

- [ ] **Step 1: diff 확인**

```bash
gh api repos/treenod/gameboard/contents/src/widgets/navigation/ui/category-sidebar.tsx --jq '.content' | base64 -d > /tmp/gb-category-sidebar.tsx
diff /tmp/gb-category-sidebar.tsx src/widgets/navigation/ui/category-sidebar.tsx | head -100
```

- [ ] **Step 2: 2 라인 정도 차이 — 의미 분석**

후보:
- import 정렬
- 주석 변경
- 타이포 변경
- 미세 prop 추가

- [ ] **Step 3: 의미 있는 drift 흡수, brand 색 보존**

- [ ] **Step 4: visual check — 사이드바 collapse/expand 동작, mobile drawer, route loading toast**

- [ ] **Step 5: commit (변경 없으면 skip)**

```bash
git add src/widgets/navigation/ui/category-sidebar.tsx
git commit -m "refactor(navigation): minor category-sidebar drift sync

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.7: page-header.tsx — 큰 갭 (27 → 181 라인) — page-header 마이그레이션

**Files:**
- Modify: `src/shared/ui/page-header.tsx`
- Modify (호출처): `src/app/(dashboard)/dashboard/page.tsx` · `src/app/(dashboard)/dashboard/mmm/page.tsx` · `src/app/(dashboard)/dashboard/market-gap/page.tsx` · `src/app/(dashboard)/dashboard/vc-simulation/page.tsx` · 기타

**가장 큰 작업.** gameboard 의 page-header 가 6배 풍부 — 사용자 "헤더 차용" 의도와 직결.

- [ ] **Step 1: gameboard page-header 전체 가져오기**

```bash
gh api repos/treenod/gameboard/contents/src/shared/ui/page-header/index.tsx --jq '.content' | base64 -d > /tmp/gb-page-header.tsx
wc -l /tmp/gb-page-header.tsx src/shared/ui/page-header.tsx
```

- [ ] **Step 2: gameboard 측 풍부 기능 분류**

- props: title, subtitle, breadcrumb, actions (rightSlot), back-button, sticky offset 처리, info hint 등
- sticky 스크롤 분기, backdrop blur, separator
- 페이지 액션 슬롯 (CTA / 필터 / export 버튼 등이 들어가는 영역)

- [ ] **Step 3: Compass 측 현재 호출처 모두 식별**

```bash
grep -rn "PageHeader\|page-header" src/app --include="*.tsx" | head -30
```

호출처 (예상):
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/dashboard/mmm/page.tsx`
- `src/app/(dashboard)/dashboard/market-gap/page.tsx`
- `src/app/(dashboard)/dashboard/vc-simulation/page.tsx`
- 그 외

- [ ] **Step 4: gameboard 패턴으로 page-header 마이그레이션**

규칙:
- gameboard 측 props 인터페이스를 그대로 차용 (title / subtitle / breadcrumb / actions / sticky 등).
- Compass 측 기존 호출은 새 인터페이스의 일부만 사용 (예: title, subtitle 만). 호환성 위해 default 값 / optional props.
- 색상은 모두 CSS var (TDS) 로 통일.
- 디렉토리 구조: gameboard 는 `page-header/index.tsx` 형식. Compass 는 `page-header.tsx` 단일 파일. **새로 디렉토리 형식으로 마이그레이션** (`src/shared/ui/page-header/index.tsx`).

- [ ] **Step 5: 모든 호출처 마이그레이션 — 새 props 인터페이스에 맞게 호출 갱신**

각 페이지에서 PageHeader 호출이 새 interface 와 호환되는지 확인. 필요 시 page.tsx 측에서 props 전달 갱신.

- [ ] **Step 6: tsc + Vitest 통과**

```bash
npx tsc --noEmit
npm test
```

- [ ] **Step 7: 모든 페이지에서 page-header 시각 + 동작 검증**

각 페이지 (light/dark):
- title/subtitle/breadcrumb 정렬
- sticky offset (TOP_BAR_HEIGHT 113px 기준 정렬)
- actions slot (있는 페이지)
- backdrop blur

- [ ] **Step 8: commit**

```bash
git add src/shared/ui/page-header.tsx src/shared/ui/page-header/ src/app/(dashboard)/dashboard
git commit -m "$(cat <<'EOF'
refactor(navigation): adopt gameboard page-header pattern

Replace minimal Compass page-header (title+subtitle only) with the
richer gameboard pattern (breadcrumb, actions slot, sticky behaviour,
backdrop). Migrate call sites in dashboard pages to the new prop
interface. Brand purple tokens preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: Verification + PR

### Task 3.1: 전체 페이지 시각 회귀 (light + dark)

**Files:** N/A (manual visual verification)

- [ ] **Step 1: dev server 종합 점검**

브라우저에서 각 페이지를 light + dark 양쪽 (theme toggle 활용):

페이지 목록:
- `/dashboard`
- `/dashboard/market-gap`
- `/dashboard/mmm`
- `/dashboard/vc-simulation`
- `/dashboard/connections`
- `/dashboard/connections/appsflyer`
- `/dashboard/prism` (있는 경우)

확인 항목:
- brand 보라(#9128b4) 가 보존된 위치: primary 버튼, sidebar active, ring focus, theme button, abtest group 0
- cohort5 라인이 brand 라인과 시각적으로 분리
- chart-1 ~ chart-20 색이 의도대로
- 사이드바 collapse/expand 동작 (mobile/desktop)
- 상단바 backdrop, 가로 정렬
- page-header sticky offset (TOP_BAR_HEIGHT 정렬)
- 모든 카드 radius 1rem 일관

### Task 3.2: TypeScript + Vitest 통과 검증

**Files:** N/A

- [ ] **Step 1: tsc 통과**

```bash
npx tsc --noEmit
```
Expected: 0 error.

- [ ] **Step 2: Vitest 통과**

```bash
npm test
```
Expected: 모든 테스트 통과.

(harness 가 commit 시점에 자동 실행하므로 push 전에 직접 한 번 더 확인.)

### Task 3.3: Foundation PR 생성

**Files:** N/A (git/gh operations)

- [ ] **Step 1: 브랜치 origin 푸시**

```bash
git push -u origin refactor/design-system-foundation
```

- [ ] **Step 2: gh pr create**

```bash
gh pr create --title "refactor(design-system): foundation — token sync + nav drift" --body "$(cat <<'EOF'
## Summary

Compass 의 brand-purple 정체성을 보존한 채 gameboard 와의 디자인 시스템 drift 를 정리하는 Foundation 작업 (spec Phase 1 + 2).

- `cohort5` 톤 분리 (#9128b4 → #b44bd7) — brand 보라와 시각 충돌 해소
- `globals.css` 의 비-브랜드 TDS 토큰 drift 정렬 (brand 7 토큰 보존)
- 7개 navigation 컴포넌트 + page-header 의 의미 있는 drift 흡수
  - app-top-bar / brand-and-product / category-tabs / sidebar-footer / category-sidebar / page-header
  - Compass 도메인 의존 (CompassLogo · Rocko Ultra · 도메인 훅) 보존
- page-header 는 gameboard 의 풍부 패턴(breadcrumb, actions slot, sticky)으로 마이그레이션 + 호출처 갱신

후속(별도 spec/plan): chart-container · custom-chart-tooltip · metric-card 도입 + 24차트 마이그레이션.

## Test plan

- [ ] tsc, Vitest 통과
- [ ] light/dark 양쪽에서 모든 페이지(dashboard/market-gap/mmm/vc-simulation/connections/appsflyer/prism) 시각 회귀 0
- [ ] brand 보라 토큰 (primary/ring/brand-line/sidebar-primary/theme-btn/abtest-color-0 등) 보존 확인
- [ ] cohort5 라인이 P50 라인과 시각 분리되는지 확인
- [ ] page-header 호출처 모두 새 props 인터페이스 호환

## Spec / Plan

- spec: docs/superpowers/specs/2026-04-27-gameboard-design-system-alignment-design.md
- plan: docs/superpowers/plans/2026-04-27-gameboard-design-system-foundation.md
EOF
)"
```

- [ ] **Step 3: harness 자동 동작 확인**

PR 생성 후 자동으로 일어나는 일 (CLAUDE.md §10.4):
- `@coderabbitai review` 코멘트 자동 추가
- Vercel preview URL 자동 조회

PR URL 을 사용자에게 전달.

- [ ] **Step 4: PR Vercel preview URL 에서 모든 페이지 light/dark 양쪽 한 번 더 확인**

Local dev 와 Vercel preview 의 시각 차이 점검 (특히 폰트 로딩, image optimization).

- [ ] **Step 5: CodeRabbit review 응답 → 머지**

CodeRabbit 의견 검토 → 필요 시 추가 commit → 머지.

---

## References

- **Spec**: `docs/superpowers/specs/2026-04-27-gameboard-design-system-alignment-design.md`
- **Source repo (차용 대상)**: `treenod/gameboard`
- **Compass CLAUDE.md**: §6 Design System (현재 토큰·radius·signal 색 정의), §10.2 Worktree 규약, §10.4 하네스 자동 작동
- **후속 plan (별도 작성 예정)**: `chart-container` + `custom-chart-tooltip` + 24차트 마이그레이션 (spec Phase 3), `metric-card` + KPICards 마이그레이션 (spec Phase 4)
