# VC Simulator Pivot — Phase 5 Implementation Plan (Channel Drawer)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 좌측 INPUT 컬럼 하단에 "Channel Mix" 트리거 버튼 추가. 클릭 시 우측에서 480px slide-in drawer가 등장해 CpiBenchmarkTable + CpiQuadrant를 보여줌. drawer 헤더에 "전체 화면 ↗" 링크로 `/dashboard/mmm` 진입 가능. ESC + 백드롭 클릭으로 닫힘.

**Architecture:** 새 위젯 `ChannelDrawer` 생성 — fixed-position overlay + framer-motion `translateX`. `mmmChannels` constant를 직접 import해 컴포넌트에 prop으로 전달. 페이지 레벨 `useState`로 open/close 상태 관리. backdrop은 `bg-black/50` + click handler.

**Stacking:** Phase 4 (PR #34) 위. base 브랜치 `refactor/vc-pivot-phase-4`.

**Spec:** `docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md` §6 Channel drawer.

**Scope discipline:** drawer + 트리거 버튼 + 두 컴포넌트 (`CpiBenchmarkTable`, `CpiQuadrant`) 만. ContributionDonut은 phase 5.1 fast-follow.

---

## File Structure

| 변경 | 경로 | 책임 |
|---|---|---|
| Create | `src/widgets/vc-simulation/ui/channel-drawer.tsx` | slide-in drawer + 두 차트 + 헤더 |
| Modify | `src/widgets/vc-simulation/index.ts` | re-export |
| Modify | `src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx` | 트리거 버튼 + drawer state |
| Modify | `src/shared/i18n/dictionary.ts` | 3 키 (`vc.channel.title`, `vc.channel.trigger`, `vc.channel.fullscreen`) |

---

## Task 1: worktree

- [ ] **Step 1:**
```bash
cd "/Users/mike/Downloads/Project Compass"
git worktree add ../compass-worktrees/refactor-vc-pivot-phase-5 -b refactor/vc-pivot-phase-5 refactor/vc-pivot-phase-4
```

- [ ] **Step 2:**
```bash
cd ../compass-worktrees/refactor-vc-pivot-phase-5
npm install --legacy-peer-deps
```

- [ ] **Step 3:** `git log --oneline -3` — HEAD = `bf3ff4a` (Phase 4 fix).

---

## Task 2: ChannelDrawer 컴포넌트

**File: `src/widgets/vc-simulation/ui/channel-drawer.tsx`**

```typescript
"use client"

import { useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowUpRight } from "lucide-react"
import { useLocale } from "@/shared/i18n"
import { mmmChannels } from "@/shared/api/mmm-data"
import { CpiBenchmarkTable } from "@/widgets/charts/ui/cpi-benchmark-table"
import { CpiQuadrant } from "@/widgets/charts/ui/cpi-quadrant"

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * 우측 slide-in drawer. open=true 시 480px 폭으로 등장.
 * 내부에 채널 분해 차트 (CpiBenchmarkTable + CpiQuadrant) 노출.
 * 헤더의 "전체 화면 ↗" 링크로 /dashboard/mmm 진입 가능.
 */
export function ChannelDrawer({ open, onClose }: Props) {
  const { t } = useLocale()

  // ESC key 핸들러
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] overflow-y-auto bg-card border-l border-border shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={t("vc.channel.title")}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">{t("vc.channel.title")}</h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/mmm"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("vc.channel.fullscreen")}
                  <ArrowUpRight className="size-3" />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div className="p-5 space-y-6">
              <CpiQuadrant channels={mmmChannels} />
              <CpiBenchmarkTable channels={mmmChannels} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
```

---

## Task 3: index.ts re-export

```typescript
export { ChannelDrawer } from "./ui/channel-drawer"
```

---

## Task 4: 트리거 버튼 in page-content

`vc-simulation-page-content.tsx` 안에:

1. **State:**
```typescript
const [channelOpen, setChannelOpen] = useState(false)
```

2. **Imports:**
```typescript
import { ChannelDrawer } from "./channel-drawer"
```

3. **트리거 버튼** — left column, AssumptionSourcePanel 위에 (또는 VcInputPanel과 AssumptionSourcePanel 사이):

```tsx
<button
  type="button"
  onClick={() => setChannelOpen(true)}
  className="mt-4 w-full inline-flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:border-primary transition-colors"
>
  <span>{t("vc.channel.trigger")}</span>
  <ArrowRight className="size-4 text-muted-foreground" />
</button>
```

`ArrowRight` import: `import { ArrowRight } from "lucide-react"`.

4. **Drawer 마운트** — `</PageTransition>` 바로 위 (fixed positioned이므로 위치 무관, 단 PageTransition 내부에 두는 게 자연스러움):

```tsx
<ChannelDrawer open={channelOpen} onClose={() => setChannelOpen(false)} />
```

---

## Task 5: dictionary 3 키 추가

`vc.compare.*` 옆에:

```typescript
"vc.channel.title": { ko: "채널 분해", en: "Channel breakdown" },
"vc.channel.trigger": { ko: "채널 분해 보기", en: "View channels" },
"vc.channel.fullscreen": { ko: "전체 화면", en: "Full view" },
```

---

## Task 6: tsc + tests + commit

```bash
cd /Users/mike/Downloads/compass-worktrees/refactor-vc-pivot-phase-5
npx tsc --noEmit
npm test
```

```bash
git add src/widgets/vc-simulation/ui/channel-drawer.tsx \
        src/widgets/vc-simulation/index.ts \
        src/widgets/vc-simulation/ui/vc-simulation-page-content.tsx \
        src/shared/i18n/dictionary.ts
git commit -m "$(cat <<'EOF'
feat(vc-sim): add Channel drawer (Phase 5 — channel breakdown)

Phase 5 of VC simulator pivot:
- ChannelDrawer widget — 480px right slide-in with CpiQuadrant + CpiBenchmarkTable
- Trigger button in left input column ("채널 분해 보기")
- Header has "전체 화면 ↗" link to /dashboard/mmm for the full MMM view
- ESC key + backdrop click close drawer
- 3 i18n keys added (vc.channel.title/trigger/fullscreen)

기존 CpiQuadrant / CpiBenchmarkTable / mmm-data 모두 그대로 재사용.

Spec: docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md §6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: build + push + PR

```bash
npm run build
git push -u origin refactor/vc-pivot-phase-5
gh pr create --base refactor/vc-pivot-phase-4 \
  --title "feat(vc-sim): VC simulator pivot — Phase 5 channel drawer" \
  --body "$(cat <<'EOF'
## Summary

좌측 INPUT 컬럼에 **"채널 분해 보기" 트리거** + 우측 480px **slide-in drawer** 추가.

- Drawer 안: CpiQuadrant + CpiBenchmarkTable (기존 \`mmmChannels\` 재사용)
- 헤더: "전체 화면 ↗" → \`/dashboard/mmm\` (URL은 보존된 hidden 라우트)
- ESC 키 + 백드롭 클릭으로 닫힘
- 3 i18n 키 추가

**Stacking:** PR #31 → #32 → #33 → #34 → 본 PR.

**Spec:** \`docs/superpowers/specs/2026-04-29-vc-simulator-product-pivot-design.md\` §6
**Plan:** \`docs/superpowers/plans/2026-04-30-vc-simulator-pivot-phase-5.md\`

## Test plan

- [ ] 좌측 컬럼 하단에 "채널 분해 보기" 버튼 (AssumptionSourcePanel 위)
- [ ] 클릭 → 우측에서 drawer slide-in (240ms)
- [ ] drawer 안에 CpiQuadrant + CpiBenchmarkTable 정상 렌더
- [ ] "전체 화면 ↗" 클릭 → \`/dashboard/mmm\` 진입
- [ ] ESC 키 → drawer 닫힘
- [ ] 백드롭 클릭 → drawer 닫힘
- [ ] 닫기 X 버튼 → drawer 닫힘
- [ ] \`npm run build\` + \`npm test\` 통과

## Known follow-ups

- Phase 5.1: ContributionDonut 추가 / 트리거 위치 미세 조정
- Phase 6 정리: \`/dashboard/mmm\` 페이지를 drawer로만 진입 가능하게 link 정리

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

- spec §6 Channel drawer ✓ — 480px / inline overlay
- ESC + backdrop close ✓
- 전체 화면 링크 보존 ✓
- ContributionDonut deferred 명시 ✓
- 새 위젯 1개 + 3 file modify, 합리적 scope ✓
