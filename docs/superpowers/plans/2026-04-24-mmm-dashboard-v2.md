# MMM Dashboard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `/dashboard/mmm` from Response Curve 2×2 (v1) into a 6-section decision-focused dashboard: Verdict → Saturation Meter → Base/Incremental Donut → Channel Cards (+ MMP/MMM label) → CPI Quadrant + Table → Reallocation.

**Architecture:** Schema-first evolution — extend `mmm-data.ts` Zod schema (portfolio + contribution + mmpComparison + recommendation + reallocation fields), update mock snapshot with a single coherent story (Meta/Apple saturated → Google underutilized), then build 7 new components that consume the schema. Existing `ResponseCurveCard` is preserved and repurposed as drill-down modal content.

**Tech Stack:** Next.js 15 · Zod · Recharts (ComposedChart, PieChart, ScatterChart, BarChart) · Framer Motion · Tailwind v4 · node:test · Vitest (excluded glob for mmm-data.test.ts)

**Spec:** `docs/superpowers/specs/2026-04-24-mmm-dashboard-v2-decision-focused.md`

---

## File Structure Map

### Created
| File | Responsibility |
|------|----------------|
| `src/widgets/charts/ui/saturation-meter.tsx` | §② Portfolio saturation gauge bar (0-100%) |
| `src/widgets/charts/ui/contribution-donut.tsx` | §③ Organic + paid(4) PieChart donut |
| `src/widgets/charts/ui/channel-status-card.tsx` | §④ Simplified channel card (badge, mCPI, saturation bar, MMP/MMM label, action) |
| `src/widgets/charts/ui/channel-detail-modal.tsx` | §④ Click-through modal wrapping existing ResponseCurveCard |
| `src/widgets/charts/ui/cpi-benchmark-table.tsx` | §⑤-R Our vs market CPI table with verdict badges |
| `src/widgets/charts/ui/cpi-quadrant.tsx` | §⑤-L 2×2 scatter (saturation × CPI deviation) |
| `src/widgets/charts/ui/reallocation-summary.tsx` | §⑥ Before/After stacked bar + move list + expected lift |

### Modified
| File | Change |
|------|--------|
| `src/shared/api/mmm-data.ts` | Add schemas for portfolio / contribution / recommendation / mmpComparison / reallocation; bump `$schemaVersion` literal to 2 |
| `src/shared/api/data/mmm/mock-snapshot.json` | Add new fields; update values for story coherence |
| `src/shared/api/__tests__/mmm-data.test.ts` | Add tests for new schema fields + integrity invariants |
| `src/shared/i18n/dictionary.ts` | Add ~30 new keys for sections, badges, labels, interpretations |
| `src/widgets/charts/index.ts` | Export 7 new components; remove ResponseCurveGrid export |
| `src/app/(dashboard)/dashboard/mmm/page.tsx` | Rewrite page as 6-section compose |

### Deleted
| File | Reason |
|------|--------|
| `src/widgets/charts/ui/response-curve-grid.tsx` | Page-level 2×2 grid no longer used; replaced by ChannelStatusCard array + detail modal |

---

## Task 1: Extend Zod schema with v2 fields

**Files:**
- Modify: `src/shared/api/mmm-data.ts`

- [ ] **Step 1: Read current schema to understand insertion points**

Run: `sed -n '70,95p' src/shared/api/mmm-data.ts`
Expected output: current `ChannelSchema` and `SnapshotSchema` definitions.

- [ ] **Step 2: Add new field schemas above ChannelSchema (keep existing fields)**

Add to `src/shared/api/mmm-data.ts` (after `const LocalizedTextSchema`, before `ChannelSchema`):

```typescript
const RecommendationSchema = z.object({
  action: z.enum(["increase", "decrease", "hold"]),
  deltaSpend: z.number(),  // USD, negative = decrease
  rationale: LocalizedTextSchema,
})

const MmpComparisonSchema = z.object({
  mmpInstalls: z.number().int().nonnegative(),
  mmmInstalls: z.number().int().nonnegative(),
  biasDeltaPct: z.number(),  // (mmm - mmp) / mmp * 100
})
```

Extend `ChannelSchema` to include:
```typescript
  recommendation: RecommendationSchema,
  mmpComparison: MmpComparisonSchema,
```

- [ ] **Step 3: Add portfolio / contribution / reallocation top-level schemas**

Add before `export const SnapshotSchema`:

```typescript
const PortfolioSchema = z.object({
  saturationWeighted: z.number().min(0).max(1),
  saturationInterpretation: LocalizedTextSchema,
})

const ContributionSchema = z.object({
  totalInstalls: z.number().int().nonnegative(),
  organic: z.number().int().nonnegative(),
  paid: z.record(ChannelKeySchema, z.number().int().nonnegative()),
  interpretation: LocalizedTextSchema,
})

const ReallocationMoveSchema = z.object({
  from: ChannelKeySchema,
  to: ChannelKeySchema,
  amount: z.number().positive(),
})

const ReallocationSchema = z.object({
  totalMoved: z.number().nonnegative(),
  expectedRevenueLift: z.number(),
  expectedRevenueLiftPct: z.number(),
  confidence: z.number().min(0).max(1),
  moves: z.array(ReallocationMoveSchema).max(6),
})
```

Update `SnapshotSchema`:
```typescript
export const SnapshotSchema = z.object({
  $schemaVersion: z.literal(2),
  metadata: MetadataSchema,
  verdict: VerdictSchema,
  portfolio: PortfolioSchema,
  contribution: ContributionSchema,
  channels: z.array(ChannelSchema).length(4),
  reallocation: ReallocationSchema,
})
```

- [ ] **Step 4: Add type exports and accessor helpers**

Add after the `mmmChannels` export:

```typescript
export type MmmPortfolio = z.infer<typeof PortfolioSchema>
export type MmmContribution = z.infer<typeof ContributionSchema>
export type MmmReallocation = z.infer<typeof ReallocationSchema>
export type MmmRecommendation = z.infer<typeof RecommendationSchema>
export type MmpComparison = z.infer<typeof MmpComparisonSchema>

export const mmmPortfolio: MmmPortfolio = snapshot.portfolio
export const mmmContribution: MmmContribution = snapshot.contribution
export const mmmReallocation: MmmReallocation = snapshot.reallocation
```

- [ ] **Step 5: Commit (mock JSON will fail to parse — expected, fix in Task 2)**

Don't commit yet — Task 2 updates mock JSON, then we commit together for atomic state.

---

## Task 2: Update mock snapshot with v2 fields and coherent story

**Files:**
- Modify: `src/shared/api/data/mmm/mock-snapshot.json`

- [ ] **Step 1: Add `portfolio` top-level field (after `verdict`, before `channels`)**

Insert into `mock-snapshot.json`:
```json
  "portfolio": {
    "saturationWeighted": 0.66,
    "saturationInterpretation": {
      "ko": "Meta/Apple이 한계에 근접 — 전체 포트폴리오도 주의 구간",
      "en": "Meta/Apple near ceiling — portfolio enters cautious zone"
    }
  },
```

- [ ] **Step 2: Add `contribution` top-level field (after `portfolio`)**

```json
  "contribution": {
    "totalInstalls": 10000,
    "organic": 3500,
    "paid": {
      "meta": 2500,
      "google": 1800,
      "tiktok": 1500,
      "apple-search": 700
    },
    "interpretation": {
      "ko": "광고 없어도 35%는 자연히 유입 — baseline이 탄탄한 증거",
      "en": "35% arrives organically — signals strong baseline product strength"
    }
  },
```

- [ ] **Step 3: Add `recommendation` + `mmpComparison` inside each channel**

For Meta (`channels[0]`), add after `benchmark`:
```json
      "recommendation": {
        "action": "decrease",
        "deltaSpend": -30000,
        "rationale": {
          "ko": "포화 78% + 단가 시장 대비 +31% — 축소 권고",
          "en": "78% saturated + 31% above market — recommend decrease"
        }
      },
      "mmpComparison": {
        "mmpInstalls": 2500,
        "mmmInstalls": 1420,
        "biasDeltaPct": -43.2
      }
```

For Google (`channels[1]`):
```json
      "recommendation": {
        "action": "increase",
        "deltaSpend": 45000,
        "rationale": {
          "ko": "포화 21%로 여유 + 단가 시장 대비 -18% — 증액 권고",
          "en": "Low saturation + 18% below market — recommend increase"
        }
      },
      "mmpComparison": {
        "mmpInstalls": 1800,
        "mmmInstalls": 2100,
        "biasDeltaPct": 16.7
      }
```

For TikTok (`channels[2]`):
```json
      "recommendation": {
        "action": "hold",
        "deltaSpend": 0,
        "rationale": {
          "ko": "포화 52% + 단가 근접 — 현 수준 유지",
          "en": "Mid saturation + close to market — hold current level"
        }
      },
      "mmpComparison": {
        "mmpInstalls": 1500,
        "mmmInstalls": 1400,
        "biasDeltaPct": -6.7
      }
```

For Apple Search (`channels[3]`):
```json
      "recommendation": {
        "action": "decrease",
        "deltaSpend": -15000,
        "rationale": {
          "ko": "포화 98% + 단가 +31% — 축소 권고",
          "en": "98% saturated + 31% above market — recommend decrease"
        }
      },
      "mmpComparison": {
        "mmpInstalls": 700,
        "mmmInstalls": 580,
        "biasDeltaPct": -17.1
      }
```

- [ ] **Step 4: Add `reallocation` top-level field (after `channels`)**

```json
  "reallocation": {
    "totalMoved": 45000,
    "expectedRevenueLift": 28000,
    "expectedRevenueLiftPct": 5.4,
    "confidence": 0.78,
    "moves": [
      { "from": "meta",         "to": "google", "amount": 30000 },
      { "from": "apple-search", "to": "google", "amount": 15000 }
    ]
  }
```

- [ ] **Step 5: Update `$schemaVersion` from `1` to `2`**

Change top-level `"$schemaVersion": 1` → `"$schemaVersion": 2`.

- [ ] **Step 6: Verify JSON syntactically valid**

Run: `node -e "require('./src/shared/api/data/mmm/mock-snapshot.json')"`
Expected: no output (success).

- [ ] **Step 7: Commit schema + mock together**

```bash
git add src/shared/api/mmm-data.ts src/shared/api/data/mmm/mock-snapshot.json
git commit -m "feat(mmm): v2 schema — portfolio/contribution/reallocation/mmp-comparison"
```

---

## Task 3: Update mmm-data tests for v2 schema

**Files:**
- Modify: `src/shared/api/__tests__/mmm-data.test.ts`

- [ ] **Step 1: Add test for new top-level exports**

Append to `mmm-data.test.ts`:

```typescript
import {
  mmmPortfolio,
  mmmContribution,
  mmmReallocation,
} from "../mmm-data"

test("mmm-data: portfolio.saturationWeighted is in [0, 1]", () => {
  assert.ok(mmmPortfolio.saturationWeighted >= 0 && mmmPortfolio.saturationWeighted <= 1)
  assert.ok(mmmPortfolio.saturationInterpretation.ko.length > 0)
})

test("mmm-data: contribution totals add up", () => {
  const paidSum = Object.values(mmmContribution.paid).reduce((a, b) => a + b, 0)
  assert.equal(mmmContribution.organic + paidSum, mmmContribution.totalInstalls)
})

test("mmm-data: reallocation moves all source ≠ target", () => {
  for (const m of mmmReallocation.moves) {
    assert.notEqual(m.from, m.to, `move ${m.from}→${m.to}: same channel`)
    assert.ok(m.amount > 0)
  }
})

test("mmm-data: reallocation totalMoved matches sum of moves", () => {
  const sum = mmmReallocation.moves.reduce((acc, m) => acc + m.amount, 0)
  assert.equal(sum, mmmReallocation.totalMoved)
})

test("mmm-data: each channel has recommendation + mmpComparison", () => {
  for (const c of mmmChannels) {
    assert.ok(["increase", "decrease", "hold"].includes(c.recommendation.action))
    assert.equal(typeof c.mmpComparison.mmpInstalls, "number")
    assert.equal(typeof c.mmpComparison.mmmInstalls, "number")
  }
})
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx tsx --test src/shared/api/__tests__/mmm-data.test.ts`
Expected: `# pass 16` (original 11 + 5 new).

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/__tests__/mmm-data.test.ts
git commit -m "test(mmm): v2 schema — portfolio/contribution/reallocation invariants"
```

---

## Task 4: SaturationMeter component (§②)

**Files:**
- Create: `src/widgets/charts/ui/saturation-meter.tsx`

- [ ] **Step 1: Write component file**

```tsx
"use client"

import { motion } from "framer-motion"
import { MMM_COLORS } from "@/shared/config/chart-colors"
import { useLocale } from "@/shared/i18n"
import type { MmmPortfolio } from "@/shared/api/mmm-data"

type SaturationMeterProps = {
  portfolio: MmmPortfolio
}

function tierColor(pct: number): string {
  if (pct < 33) return MMM_COLORS.channels.google.line  // green
  if (pct < 66) return MMM_COLORS.saturationPoint       // caution
  return "#d22030"                                       // risk red
}

function tierLabelKey(pct: number): "mmm.saturation.tier.low" | "mmm.saturation.tier.medium" | "mmm.saturation.tier.high" {
  if (pct < 33) return "mmm.saturation.tier.low"
  if (pct < 66) return "mmm.saturation.tier.medium"
  return "mmm.saturation.tier.high"
}

export function SaturationMeter({ portfolio }: SaturationMeterProps) {
  const { t, locale } = useLocale()
  const pct = Math.round(portfolio.saturationWeighted * 100)
  const fill = tierColor(pct)
  const tierLabel = t(tierLabelKey(pct))

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-6">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--fg-2)] uppercase tracking-wide">
            {t("mmm.saturation.meter.label")}
          </h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="text-3xl font-extrabold text-[var(--fg-0)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {pct}%
          </span>
          <span className="text-sm font-semibold" style={{ color: fill }}>
            · {tierLabel}
          </span>
        </div>
      </div>

      <div className="relative h-6 rounded-full bg-[var(--bg-2)] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: fill }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <div className="absolute inset-0 flex text-[10px] font-semibold text-[var(--fg-2)] pointer-events-none">
          <span className="ml-[33%] -translate-x-1/2 translate-y-7 absolute">33%</span>
          <span className="ml-[66%] -translate-x-1/2 translate-y-7 absolute">66%</span>
        </div>
      </div>

      <p className="mt-6 text-sm text-[var(--fg-1)] leading-relaxed break-keep">
        {portfolio.saturationInterpretation[locale]}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "saturation-meter" | head`
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/widgets/charts/ui/saturation-meter.tsx
git commit -m "feat(mmm): SaturationMeter — portfolio-level saturation gauge (§②)"
```

---

## Task 5: ContributionDonut component (§③)

**Files:**
- Create: `src/widgets/charts/ui/contribution-donut.tsx`

- [ ] **Step 1: Write component file**

```tsx
"use client"

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { ChartHeader } from "@/shared/ui/chart-header"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { PALETTE, MMM_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { useLocale } from "@/shared/i18n"
import type { MmmContribution, ChannelKey } from "@/shared/api/mmm-data"

type ContributionDonutProps = {
  contribution: MmmContribution
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

export function ContributionDonut({ contribution }: ContributionDonutProps) {
  const { t, locale } = useLocale()
  const total = contribution.totalInstalls
  const organicPct = Math.round((contribution.organic / total) * 100)

  const slices = [
    {
      name: t("mmm.contribution.organic.label"),
      value: contribution.organic,
      color: PALETTE.benchmark,
    },
    ...(Object.entries(contribution.paid) as Array<[ChannelKey, number]>).map(
      ([key, value]) => ({
        name: t(CHANNEL_LABEL_KEY[key]),
        value,
        color: MMM_COLORS.channels[key].line,
      }),
    ),
  ]

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-6">
      <ChartHeader
        title={t("mmm.contribution.title")}
        subtitle={`${t("mmm.contribution.center.pct").replace("{{pct}}", String(organicPct))}`}
      />

      <div className="grid grid-cols-[1fr_1fr] gap-6 items-center">
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {slices.map((s, i) => (
                  <Cell key={i} fill={s.color} />
                ))}
              </Pie>
              <Tooltip
                content={
                  <ChartTooltip
                    render={({ payload }) => (
                      <div>
                        {payload.map((p, i) => {
                          const v = typeof p.value === "number" ? p.value : 0
                          const pct = Math.round((v / total) * 100)
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, ...CHART_TYPO.tooltipLabel, lineHeight: 1.6 }}>
                              <TooltipDot color={p.color ?? PALETTE.fg2} />
                              <span style={{ color: PALETTE.fg2 }}>{p.name}</span>
                              <span style={{ marginLeft: "auto", paddingLeft: 12, ...CHART_TYPO.tooltipValue, color: PALETTE.fg0 }}>
                                {v.toLocaleString()} ({pct}%)
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-2">
          {slices.map((s) => {
            const pct = Math.round((s.value / total) * 100)
            return (
              <div key={s.name} className="flex items-center gap-2 text-sm">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="font-medium text-[var(--fg-1)] flex-1">{s.name}</span>
                <span className="text-[var(--fg-2)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {s.value.toLocaleString()}
                </span>
                <span
                  className="text-xs text-[var(--fg-2)] w-10 text-right"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {pct}%
                </span>
              </div>
            )
          })}
          <div className="mt-2 pt-2 border-t border-[var(--border-default)] flex items-center gap-2 text-sm font-bold">
            <span className="flex-1 text-[var(--fg-0)]">Total</span>
            <span className="text-[var(--fg-0)]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm text-[var(--fg-1)] leading-relaxed break-keep">
        {contribution.interpretation[locale]}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "contribution-donut" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/widgets/charts/ui/contribution-donut.tsx
git commit -m "feat(mmm): ContributionDonut — organic vs paid breakdown (§③)"
```

---

## Task 6: ChannelStatusCard component (§④)

**Files:**
- Create: `src/widgets/charts/ui/channel-status-card.tsx`

- [ ] **Step 1: Write component file**

```tsx
"use client"

import { motion } from "framer-motion"
import { MMM_COLORS, PALETTE } from "@/shared/config/chart-colors"
import { useLocale } from "@/shared/i18n"
import { cn } from "@/shared/lib/utils"
import type { MmmChannel, ChannelKey } from "@/shared/api/mmm-data"

type ChannelStatusCardProps = {
  channel: MmmChannel
  onClick: () => void
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

function saturationTier(pct: number): "low" | "medium" | "high" {
  if (pct < 33) return "low"
  if (pct < 66) return "medium"
  return "high"
}

const TIER_BADGE: Record<"low" | "medium" | "high", { dot: string; bg: string; fg: string }> = {
  low:    { dot: "🟢", bg: "bg-[color-mix(in_srgb,#02a262_14%,transparent)]", fg: "text-[#02a262]" },
  medium: { dot: "🟡", bg: "bg-[color-mix(in_srgb,#fb8800_14%,transparent)]", fg: "text-[#fb8800]" },
  high:   { dot: "🔴", bg: "bg-[color-mix(in_srgb,#d22030_14%,transparent)]", fg: "text-[#d22030]" },
}

function fmtSignedMoney(usd: number, locale: "ko" | "en"): string {
  const abs = Math.abs(usd)
  const k = abs >= 1000 ? `${Math.round(abs / 1000)}K` : String(abs)
  if (usd === 0) return locale === "ko" ? "유지" : "Hold"
  const sign = usd > 0 ? "+" : "-"
  const verb = locale === "ko" ? (usd > 0 ? "증액" : "축소") : (usd > 0 ? "Increase" : "Decrease")
  return `${sign}$${k} ${verb}`
}

export function ChannelStatusCard({ channel, onClick }: ChannelStatusCardProps) {
  const { t, locale } = useLocale()
  const saturationPct = Math.min(
    100,
    Math.round((channel.currentSpend / (channel.saturation.halfSaturation * 2)) * 100),
  )
  const tier = saturationTier(saturationPct)
  const badge = TIER_BADGE[tier]
  const channelColor = MMM_COLORS.channels[channel.key].line

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className="text-left rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-4 h-full flex flex-col gap-3 transition-colors hover:border-[var(--brand)]"
    >
      {/* Header — channel label + tier badge */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-[var(--fg-0)]">
          {t(CHANNEL_LABEL_KEY[channel.key])}
        </h4>
        <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold", badge.bg, badge.fg)}>
          {badge.dot} {t(`mmm.channel.badge.${tier}`)}
        </span>
      </div>

      {/* mCPI — large */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-2)]">
          {t("mmm.metric.mCPI")}
        </div>
        <div
          className="text-2xl font-extrabold text-[var(--fg-0)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          ${channel.marginal.cpi.toFixed(2)}
        </div>
      </div>

      {/* Saturation mini bar */}
      <div>
        <div className="flex justify-between items-center text-[10px] text-[var(--fg-2)] mb-1">
          <span>{t("mmm.metric.saturation")}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{saturationPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--bg-2)] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${saturationPct}%`, backgroundColor: channelColor }}
          />
        </div>
      </div>

      {/* MMP vs MMM bias label */}
      <div className="text-[10px] text-[var(--fg-2)] leading-relaxed">
        <div className="flex justify-between">
          <span>{t("mmm.channel.mmp.label")}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {channel.mmpComparison.mmpInstalls.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>{t("mmm.channel.mmm.label")}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {channel.mmpComparison.mmmInstalls.toLocaleString()}{" "}
            <span className={channel.mmpComparison.biasDeltaPct < -10 ? "text-[var(--signal-caution)]" : ""}>
              ({channel.mmpComparison.biasDeltaPct > 0 ? "+" : ""}
              {channel.mmpComparison.biasDeltaPct.toFixed(0)}%)
            </span>
          </span>
        </div>
      </div>

      {/* Recommendation action */}
      <div
        className="mt-auto pt-2 border-t border-[var(--border-default)] text-sm font-bold"
        style={{
          color:
            channel.recommendation.action === "increase"
              ? PALETTE.positive
              : channel.recommendation.action === "decrease"
              ? PALETTE.risk
              : PALETTE.fg2,
        }}
      >
        {fmtSignedMoney(channel.recommendation.deltaSpend, locale)}
      </div>
    </motion.button>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "channel-status-card" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/widgets/charts/ui/channel-status-card.tsx
git commit -m "feat(mmm): ChannelStatusCard — simplified card with MMP/MMM bias label (§④)"
```

---

## Task 7: ChannelDetailModal component (§④ drill-down)

**Files:**
- Create: `src/widgets/charts/ui/channel-detail-modal.tsx`

- [ ] **Step 1: Write component file — wraps existing ResponseCurveCard in Dialog**

```tsx
"use client"

import { Dialog } from "@base-ui/react/dialog"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { ResponseCurveCard } from "./response-curve-card"
import type { MmmChannel } from "@/shared/api/mmm-data"

type ChannelDetailModalProps = {
  channel: MmmChannel | null
  onClose: () => void
}

const transition = { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }

export function ChannelDetailModal({ channel, onClose }: ChannelDetailModalProps) {
  const open = channel !== null
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal>
            <Dialog.Backdrop
              render={
                <motion.div
                  className="fixed inset-0 z-50 bg-black/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                />
              }
            />
            <Dialog.Popup
              render={
                <motion.div
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={transition}
                >
                  <motion.div
                    className={cn(
                      "relative w-full max-w-5xl",
                      "rounded-[var(--radius-card)] border border-[var(--border-default)]",
                      "bg-[var(--bg-1)] shadow-[0_16px_64px_rgba(0,0,0,0.12)]",
                    )}
                    initial={{ opacity: 0, scale: 0.96, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 8 }}
                    transition={transition}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end p-2">
                      <Dialog.Close
                        className="rounded-[var(--radius-inline)] p-1.5 text-[var(--fg-3)] hover:bg-[var(--bg-3)] hover:text-[var(--fg-1)] transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </Dialog.Close>
                    </div>
                    <div className="px-6 pb-6">
                      {channel && (
                        <ResponseCurveCard
                          channel={channel}
                          expanded={true}
                          onToggle={onClose}
                        />
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              }
            />
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "channel-detail-modal" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/widgets/charts/ui/channel-detail-modal.tsx
git commit -m "feat(mmm): ChannelDetailModal — drill-down wrapping ResponseCurveCard (§④)"
```

---

## Task 8: CpiBenchmarkTable component (§⑤-R)

**Files:**
- Create: `src/widgets/charts/ui/cpi-benchmark-table.tsx`

- [ ] **Step 1: Write component file**

```tsx
"use client"

import { cn } from "@/shared/lib/utils"
import { useLocale } from "@/shared/i18n"
import type { MmmChannel, ChannelKey } from "@/shared/api/mmm-data"

type CpiBenchmarkTableProps = {
  channels: readonly MmmChannel[]
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

function deviationPct(c: MmmChannel): number {
  return ((c.marginal.cpi - c.benchmark.marketMedianCpi) / c.benchmark.marketMedianCpi) * 100
}

type Verdict = "expensive" | "close" | "cheap"
function verdictFor(dev: number): Verdict {
  if (dev >= 15) return "expensive"
  if (dev <= -15) return "cheap"
  return "close"
}

const VERDICT_STYLE: Record<Verdict, { dot: string; bg: string; fg: string }> = {
  expensive: { dot: "🔴", bg: "bg-[color-mix(in_srgb,#d22030_14%,transparent)]", fg: "text-[#d22030]" },
  close:     { dot: "🟡", bg: "bg-[color-mix(in_srgb,#fb8800_14%,transparent)]", fg: "text-[#fb8800]" },
  cheap:     { dot: "🟢", bg: "bg-[color-mix(in_srgb,#02a262_14%,transparent)]", fg: "text-[#02a262]" },
}

export function CpiBenchmarkTable({ channels }: CpiBenchmarkTableProps) {
  const { t } = useLocale()
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-4 h-full flex flex-col">
      <div className="overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-bold text-[var(--fg-2)] border-b border-[var(--border-default)]">
              <th className="text-left px-2 py-2">{t("mmm.benchmark.table.headers.channel")}</th>
              <th className="text-right px-2 py-2">{t("mmm.benchmark.table.headers.us")}</th>
              <th className="text-right px-2 py-2">{t("mmm.benchmark.table.headers.market")}</th>
              <th className="text-right px-2 py-2">{t("mmm.benchmark.table.headers.deviation")}</th>
              <th className="text-right px-2 py-2">{t("mmm.benchmark.table.headers.verdict")}</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => {
              const dev = deviationPct(c)
              const v = verdictFor(dev)
              const style = VERDICT_STYLE[v]
              return (
                <tr key={c.key} className="border-b border-[var(--border-default)]/40">
                  <td className="px-2 py-2 text-[var(--fg-0)] font-medium">
                    {t(CHANNEL_LABEL_KEY[c.key as ChannelKey])}
                  </td>
                  <td className="px-2 py-2 text-right text-[var(--fg-1)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${c.marginal.cpi.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right text-[var(--fg-2)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${c.benchmark.marketMedianCpi.toFixed(2)}
                  </td>
                  <td className="px-2 py-2 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <span className={dev > 0 ? "text-[var(--signal-caution)]" : dev < 0 ? "text-[var(--signal-positive,#02a262)]" : "text-[var(--fg-2)]"}>
                      {dev > 0 ? "+" : ""}{dev.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold", style.bg, style.fg)}>
                      {style.dot} {t(`mmm.benchmark.verdict.${v}`)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[var(--fg-3)] mt-3 italic">
        {t("mmm.benchmark.source")}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "cpi-benchmark-table" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/widgets/charts/ui/cpi-benchmark-table.tsx
git commit -m "feat(mmm): CpiBenchmarkTable — our vs market with verdict badges (§⑤-R)"
```

---

## Task 9: CpiQuadrant component (§⑤-L)

**Files:**
- Create: `src/widgets/charts/ui/cpi-quadrant.tsx`

- [ ] **Step 1: Write component file — 2×2 scatter with quadrant labels**

```tsx
"use client"

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import { ChartHeader } from "@/shared/ui/chart-header"
import { ChartTooltip, TooltipDot } from "@/shared/ui/chart-tooltip"
import { MMM_COLORS, PALETTE } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { useLocale } from "@/shared/i18n"
import type { MmmChannel, ChannelKey } from "@/shared/api/mmm-data"

type CpiQuadrantProps = {
  channels: readonly MmmChannel[]
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

function toPoint(c: MmmChannel) {
  const satPct = Math.min(100, (c.currentSpend / (c.saturation.halfSaturation * 2)) * 100)
  const devPct = ((c.marginal.cpi - c.benchmark.marketMedianCpi) / c.benchmark.marketMedianCpi) * 100
  const spendLog = Math.log10(c.currentSpend + 1) * 80   // dot size scale
  return {
    key: c.key,
    saturation: satPct,
    deviation: devPct,
    spendSize: spendLog,
    spend: c.currentSpend,
    cpi: c.marginal.cpi,
  }
}

export function CpiQuadrant({ channels }: CpiQuadrantProps) {
  const { t } = useLocale()
  const data = channels.map((c) => ({
    ...toPoint(c),
    name: t(CHANNEL_LABEL_KEY[c.key as ChannelKey]),
    color: MMM_COLORS.channels[c.key].line,
  }))

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-4 h-full flex flex-col">
      <ChartHeader
        title={t("mmm.benchmark.quadrant.title")}
        subtitle={t("mmm.benchmark.quadrant.subtitle")}
      />
      <div className="flex-1 relative" style={{ minHeight: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="4 4" stroke={MMM_COLORS.grid} />
            <XAxis
              type="number"
              dataKey="saturation"
              domain={[0, 100]}
              tick={{ ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis }}
              axisLine={{ stroke: MMM_COLORS.border }}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              label={{ value: t("mmm.metric.saturation"), position: "bottom", offset: 0, fontSize: 11, fill: MMM_COLORS.fg2 }}
            />
            <YAxis
              type="number"
              dataKey="deviation"
              domain={[-60, 60]}
              tick={{ ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis }}
              axisLine={{ stroke: MMM_COLORS.border }}
              tickLine={false}
              tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
              label={{ value: t("mmm.benchmark.quadrant.yLabel"), angle: -90, position: "insideLeft", fontSize: 11, fill: MMM_COLORS.fg2 }}
            />
            <ZAxis type="number" dataKey="spendSize" range={[100, 500]} />
            <ReferenceLine x={50} stroke={MMM_COLORS.border} strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke={MMM_COLORS.border} strokeDasharray="3 3" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltip
                  render={({ payload }) => {
                    const p = payload?.[0]?.payload as typeof data[number] | undefined
                    if (!p) return null
                    return (
                      <div>
                        <div style={{ ...CHART_TYPO.tooltipTitle, color: PALETTE.fg0, marginBottom: 4 }}>
                          {p.name}
                        </div>
                        <div style={{ ...CHART_TYPO.tooltipLabel, lineHeight: 1.6 }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <TooltipDot color={p.color} />
                            <span style={{ color: PALETTE.fg2 }}>Spend</span>
                            <span style={{ marginLeft: "auto", ...CHART_TYPO.tooltipValue, color: PALETTE.fg0 }}>
                              ${p.spend.toLocaleString()}
                            </span>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <span style={{ width: 8 }} />
                            <span style={{ color: PALETTE.fg2 }}>Sat / Dev</span>
                            <span style={{ marginLeft: "auto", ...CHART_TYPO.tooltipValue, color: PALETTE.fg0 }}>
                              {p.saturation.toFixed(0)}% / {p.deviation > 0 ? "+" : ""}{p.deviation.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
              }
            />
            <Scatter data={data} fill={PALETTE.fg0}>
              {data.map((d, i) => (
                <circle key={i} cx={0} cy={0} r={0} fill={d.color} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>

        {/* Quadrant corner labels */}
        <div className="absolute inset-0 pointer-events-none text-[10px] font-semibold text-[var(--fg-3)]">
          <span className="absolute top-6 right-8 text-right">{t("mmm.benchmark.quadrant.q.oversaturated")}</span>
          <span className="absolute top-6 left-12">{t("mmm.benchmark.quadrant.q.creative")}</span>
          <span className="absolute bottom-12 left-12">{t("mmm.benchmark.quadrant.q.optimal")}</span>
          <span className="absolute bottom-12 right-8 text-right">{t("mmm.benchmark.quadrant.q.unicorn")}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "cpi-quadrant" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/widgets/charts/ui/cpi-quadrant.tsx
git commit -m "feat(mmm): CpiQuadrant — 2×2 saturation × CPI deviation scatter (§⑤-L)"
```

---

## Task 10: ReallocationSummary component (§⑥)

**Files:**
- Create: `src/widgets/charts/ui/reallocation-summary.tsx`

- [ ] **Step 1: Write component file**

```tsx
"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts"
import { ChartHeader } from "@/shared/ui/chart-header"
import { ChartTooltip } from "@/shared/ui/chart-tooltip"
import { MMM_COLORS, PALETTE } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { useLocale } from "@/shared/i18n"
import type { MmmChannel, MmmReallocation, ChannelKey } from "@/shared/api/mmm-data"

type ReallocationSummaryProps = {
  channels: readonly MmmChannel[]
  reallocation: MmmReallocation
}

const CHANNEL_LABEL_KEY = {
  "meta": "mmm.channel.meta",
  "google": "mmm.channel.google",
  "tiktok": "mmm.channel.tiktok",
  "apple-search": "mmm.channel.appleSearch",
} as const

function computeAfter(channels: readonly MmmChannel[], reallocation: MmmReallocation): Record<ChannelKey, number> {
  const after = Object.fromEntries(channels.map((c) => [c.key, c.currentSpend])) as Record<ChannelKey, number>
  for (const m of reallocation.moves) {
    after[m.from] -= m.amount
    after[m.to] += m.amount
  }
  return after
}

function fmtK(v: number): string {
  return `$${Math.round(v / 1000)}K`
}

export function ReallocationSummary({ channels, reallocation }: ReallocationSummaryProps) {
  const { t, locale } = useLocale()
  const after = computeAfter(channels, reallocation)
  const data = channels.map((c) => ({
    key: c.key,
    label: t(CHANNEL_LABEL_KEY[c.key as ChannelKey]),
    Before: c.currentSpend,
    After: after[c.key],
    delta: after[c.key] - c.currentSpend,
    color: MMM_COLORS.channels[c.key].line,
  }))

  const totalBefore = data.reduce((s, d) => s + d.Before, 0)
  const totalAfter = data.reduce((s, d) => s + d.After, 0)

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-1)] p-6">
      <ChartHeader
        title={t("mmm.reallocation.title")}
        subtitle={
          locale === "ko"
            ? `${fmtK(reallocation.totalMoved)} 재배분 시 월 매출 ${fmtK(reallocation.expectedRevenueLift)} (+${reallocation.expectedRevenueLiftPct.toFixed(1)}%) 예상`
            : `${fmtK(reallocation.totalMoved)} reallocation → +${fmtK(reallocation.expectedRevenueLift)}/mo (+${reallocation.expectedRevenueLiftPct.toFixed(1)}%)`
        }
      />

      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 40, left: 10, bottom: 10 }}>
            <XAxis
              type="number"
              tick={{ ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis }}
              axisLine={{ stroke: MMM_COLORS.border }}
              tickLine={false}
              tickFormatter={(v: number) => fmtK(v)}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ ...CHART_TYPO.axisTick, fill: MMM_COLORS.axis }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip
              content={
                <ChartTooltip
                  render={({ payload, label }) => (
                    <div>
                      <div style={{ ...CHART_TYPO.tooltipTitle, color: PALETTE.fg0, marginBottom: 4 }}>{label}</div>
                      {payload.map((p, i) => (
                        <div key={i} style={{ ...CHART_TYPO.tooltipLabel, display: "flex", gap: 12 }}>
                          <span style={{ color: PALETTE.fg2 }}>{p.name}</span>
                          <span style={{ marginLeft: "auto", ...CHART_TYPO.tooltipValue, color: PALETTE.fg0 }}>
                            {typeof p.value === "number" ? fmtK(p.value) : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey="Before" fill={PALETTE.benchmark} name={t("mmm.reallocation.before")}>
              <LabelList dataKey="Before" position="right" formatter={(v: unknown) => typeof v === "number" ? fmtK(v) : ""} style={{ ...CHART_TYPO.axisTick, fill: PALETTE.fg2 }} />
            </Bar>
            <Bar dataKey="After" fill={PALETTE.p50} name={t("mmm.reallocation.after")}>
              <LabelList dataKey="After" position="right" formatter={(v: unknown) => typeof v === "number" ? fmtK(v) : ""} style={{ ...CHART_TYPO.axisTick, fill: PALETTE.fg0, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--fg-2)]">
        <span>{t("mmm.reallocation.totalMoved")}: <span className="font-bold text-[var(--fg-0)]" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtK(reallocation.totalMoved)}</span></span>
        <span>{t("signal.confidence")}: <span className="font-bold text-[var(--fg-0)]" style={{ fontVariantNumeric: "tabular-nums" }}>{Math.round(reallocation.confidence * 100)}%</span></span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>Total: {fmtK(totalBefore)} → {fmtK(totalAfter)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "reallocation-summary" | head`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/widgets/charts/ui/reallocation-summary.tsx
git commit -m "feat(mmm): ReallocationSummary — before/after bars + expected lift (§⑥)"
```

---

## Task 11: Add i18n keys for v2

**Files:**
- Modify: `src/shared/i18n/dictionary.ts`

- [ ] **Step 1: Locate insertion point**

Run: `grep -n "mmm.methodology.limitations.body" src/shared/i18n/dictionary.ts`
Expected: single line number showing last MMM key.

- [ ] **Step 2: Append new keys after the last MMM key**

Add these 30 entries after `"mmm.methodology.limitations.body"`:

```typescript
  "mmm.saturation.meter.label":     { ko: "채널 포화도 (Spend 가중)",  en: "Saturation (Spend-weighted)" },
  "mmm.saturation.tier.low":        { ko: "여유",                      en: "Low" },
  "mmm.saturation.tier.medium":     { ko: "주의",                      en: "Medium" },
  "mmm.saturation.tier.high":       { ko: "포화",                      en: "High" },
  "mmm.contribution.title":         { ko: "총 Install 기여 분해",      en: "Install Contribution Breakdown" },
  "mmm.contribution.center.pct":    { ko: "Organic {{pct}}% · Paid 나머지", en: "Organic {{pct}}% · Paid remainder" },
  "mmm.contribution.organic.label": { ko: "Organic (자연)",            en: "Organic" },
  "mmm.channel.badge.low":          { ko: "여유",                      en: "Room" },
  "mmm.channel.badge.medium":       { ko: "주의",                      en: "Watch" },
  "mmm.channel.badge.high":         { ko: "포화",                      en: "Saturated" },
  "mmm.channel.mmp.label":          { ko: "AF 귀속",                   en: "AF Attrib." },
  "mmm.channel.mmm.label":          { ko: "MMM 인과",                  en: "MMM Causal" },
  "mmm.benchmark.quadrant.title":      { ko: "시장 대비 CPI 적절성",     en: "CPI vs Market Benchmark" },
  "mmm.benchmark.quadrant.subtitle":   { ko: "포화도 × 시장 편차 4분면", en: "Saturation × Market Deviation" },
  "mmm.benchmark.quadrant.yLabel":     { ko: "시장 대비 편차",           en: "Deviation from Market" },
  "mmm.benchmark.quadrant.q.oversaturated": { ko: "포화+비쌈 (축소)",    en: "Saturated + Expensive" },
  "mmm.benchmark.quadrant.q.creative":      { ko: "여유+비쌈 (Creative)", en: "Room + Expensive" },
  "mmm.benchmark.quadrant.q.optimal":       { ko: "여유+저렴 (최적)",     en: "Room + Cheap (Optimal)" },
  "mmm.benchmark.quadrant.q.unicorn":       { ko: "포화+저렴 (유니콘)",   en: "Saturated + Cheap" },
  "mmm.benchmark.table.headers.channel":    { ko: "채널",   en: "Channel" },
  "mmm.benchmark.table.headers.us":         { ko: "우리",   en: "Us" },
  "mmm.benchmark.table.headers.market":     { ko: "시장",   en: "Market" },
  "mmm.benchmark.table.headers.deviation":  { ko: "편차",   en: "Deviation" },
  "mmm.benchmark.table.headers.verdict":    { ko: "판정",   en: "Verdict" },
  "mmm.benchmark.verdict.expensive":        { ko: "비쌈",   en: "Expensive" },
  "mmm.benchmark.verdict.close":            { ko: "근접",   en: "Close" },
  "mmm.benchmark.verdict.cheap":            { ko: "저렴",   en: "Cheap" },
  "mmm.benchmark.source":                   { ko: "출처: AppsFlyer Benchmarks (Mock — Phase 2에서 크롤러 연동)", en: "Source: AppsFlyer Benchmarks (Mock — crawler integration in Phase 2)" },
  "mmm.reallocation.title":                 { ko: "재배분 권고",     en: "Reallocation Plan" },
  "mmm.reallocation.before":                { ko: "현재",            en: "Before" },
  "mmm.reallocation.after":                 { ko: "권고",            en: "After" },
  "mmm.reallocation.totalMoved":            { ko: "총 이동",         en: "Total Moved" },
```

- [ ] **Step 3: Typecheck for key coverage**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "^src/" | head`
Expected: no output (all new keys typecheck).

- [ ] **Step 4: Commit**

```bash
git add src/shared/i18n/dictionary.ts
git commit -m "feat(mmm): v2 i18n — 30 keys for 6-section dashboard"
```

---

## Task 12: Rewrite page.tsx as 6-section compose

**Files:**
- Modify: `src/app/(dashboard)/dashboard/mmm/page.tsx`
- Modify: `src/widgets/charts/index.ts` (export new components, remove ResponseCurveGrid)
- Delete: `src/widgets/charts/ui/response-curve-grid.tsx`

- [ ] **Step 1: Replace page.tsx entirely**

Overwrite `src/app/(dashboard)/dashboard/mmm/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { DecisionStoryCard } from "@/widgets/dashboard"
import { SaturationMeter } from "@/widgets/charts/ui/saturation-meter"
import { ContributionDonut } from "@/widgets/charts/ui/contribution-donut"
import { ChannelStatusCard } from "@/widgets/charts/ui/channel-status-card"
import { ChannelDetailModal } from "@/widgets/charts/ui/channel-detail-modal"
import { CpiQuadrant } from "@/widgets/charts/ui/cpi-quadrant"
import { CpiBenchmarkTable } from "@/widgets/charts/ui/cpi-benchmark-table"
import { ReallocationSummary } from "@/widgets/charts/ui/reallocation-summary"
import { useLocale } from "@/shared/i18n"
import type { SignalStatus } from "@/shared/api/mock-data"
import {
  mmmChannels,
  mmmVerdict,
  mmmPortfolio,
  mmmContribution,
  mmmReallocation,
  isMmmStale,
  mmmAgeDays,
  type MmmChannel,
} from "@/shared/api/mmm-data"

function deriveChannelStatus(mROAS: number): SignalStatus {
  if (mROAS >= 1.4) return "invest"
  if (mROAS >= 1.0) return "hold"
  return "reduce"
}

function fmtK(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`
  return `$${v.toFixed(0)}`
}

export default function MmmPage() {
  const { locale } = useLocale()
  const [detailChannel, setDetailChannel] = useState<MmmChannel | null>(null)

  const totalSpend = mmmChannels.reduce((s, c) => s + c.currentSpend, 0)
  const weightedMROAS =
    mmmChannels.reduce((s, c) => s + c.marginal.roas * c.currentSpend, 0) / Math.max(1, totalSpend)
  const saturatedCount = mmmChannels.filter((c) => c.marginal.roas < 1).length

  const impactText =
    locale === "ko"
      ? `총 spend ${fmtK(totalSpend)} · 가중 mROAS ${weightedMROAS.toFixed(2)}× · 포화 ${saturatedCount}/${mmmChannels.length}채널`
      : `Total spend ${fmtK(totalSpend)} · Weighted mROAS ${weightedMROAS.toFixed(2)}× · ${saturatedCount}/${mmmChannels.length} saturated`

  const regions = mmmChannels.map((c) => ({
    label: c.label,
    status: deriveChannelStatus(c.marginal.roas),
    reason: `mROAS ${c.marginal.roas.toFixed(2)}× · mCPI $${c.marginal.cpi.toFixed(2)}`,
  }))

  return (
    <PageTransition>
      {/* ① Hero Verdict */}
      <FadeInUp className="mb-8" delay={0}>
        <DecisionStoryCard
          status={mmmVerdict.status}
          headline={mmmVerdict.headline[locale]}
          impactText={impactText}
          confidence={Math.round(mmmVerdict.confidence * 100)}
          metrics={mmmVerdict.metrics.map((m) => ({ label: m.label[locale], value: m.value }))}
          regions={regions}
          regionsLabel={locale === "ko" ? "채널별 상태" : "Per-channel status"}
          ctaLabel={locale === "ko" ? "방법론 보기" : "View methodology"}
        />
      </FadeInUp>

      <FadeInUp className="mb-2" delay={0.05}>
        <div className="flex items-center gap-2 flex-wrap">
          <PageHeader titleKey="mmm.title" subtitleKey="mmm.subtitle" />
          {isMmmStale() ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--signal-caution)]/40 bg-[var(--signal-caution)]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--signal-caution)]">
              STALE · {mmmAgeDays()}일 경과
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-[var(--bg-2)] px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Mock (Phase 1)
            </span>
          )}
        </div>
      </FadeInUp>

      {/* ② Saturation Meter */}
      <FadeInUp className="mb-6" delay={0.1}>
        <SaturationMeter portfolio={mmmPortfolio} />
      </FadeInUp>

      {/* ③ Base vs Incremental Donut */}
      <FadeInUp className="mb-8" delay={0.15}>
        <ContributionDonut contribution={mmmContribution} />
      </FadeInUp>

      {/* ④ Channel Status Cards (2×2) */}
      <FadeInUp className="mb-10" delay={0.2}>
        <div className="grid grid-cols-2 gap-4">
          {mmmChannels.map((c) => (
            <ChannelStatusCard
              key={c.key}
              channel={c}
              onClick={() => setDetailChannel(c)}
            />
          ))}
        </div>
      </FadeInUp>

      {/* ⑤ CPI Benchmark Analysis (Quadrant + Table, 2 cols) */}
      <FadeInUp className="mb-8" delay={0.25}>
        <div className="grid grid-cols-[1fr_1fr] gap-4">
          <CpiQuadrant channels={mmmChannels} />
          <CpiBenchmarkTable channels={mmmChannels} />
        </div>
      </FadeInUp>

      {/* ⑥ Reallocation Summary */}
      <FadeInUp delay={0.3}>
        <ReallocationSummary channels={mmmChannels} reallocation={mmmReallocation} />
      </FadeInUp>

      <ChannelDetailModal channel={detailChannel} onClose={() => setDetailChannel(null)} />
    </PageTransition>
  )
}
```

- [ ] **Step 2: Remove ResponseCurveGrid**

Run: `rm src/widgets/charts/ui/response-curve-grid.tsx`

- [ ] **Step 3: Update charts index exports**

Replace current `response-curve-grid` export with v2 components in `src/widgets/charts/index.ts`:

Remove line:
```
export { ResponseCurveGrid } from "./ui/response-curve-grid"
```

Add lines (after `export { ResponseCurveCard } from "./ui/response-curve-card"`):
```
export { SaturationMeter } from "./ui/saturation-meter"
export { ContributionDonut } from "./ui/contribution-donut"
export { ChannelStatusCard } from "./ui/channel-status-card"
export { ChannelDetailModal } from "./ui/channel-detail-modal"
export { CpiQuadrant } from "./ui/cpi-quadrant"
export { CpiBenchmarkTable } from "./ui/cpi-benchmark-table"
export { ReallocationSummary } from "./ui/reallocation-summary"
```

- [ ] **Step 4: Final typecheck + lint**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "^src/" | head`
Expected: no output.

Run: `npx eslint src/app/\(dashboard\)/dashboard/mmm/page.tsx src/widgets/charts/ui/saturation-meter.tsx src/widgets/charts/ui/contribution-donut.tsx src/widgets/charts/ui/channel-status-card.tsx src/widgets/charts/ui/channel-detail-modal.tsx src/widgets/charts/ui/cpi-quadrant.tsx src/widgets/charts/ui/cpi-benchmark-table.tsx src/widgets/charts/ui/reallocation-summary.tsx`
Expected: no errors (warnings acceptable).

- [ ] **Step 5: Commit page rewrite + removal together**

```bash
git add src/app/\(dashboard\)/dashboard/mmm/page.tsx src/widgets/charts/index.ts
git add -u src/widgets/charts/ui/response-curve-grid.tsx   # stage deletion
git commit -m "refactor(mmm): page.tsx v2 — 6-section compose, drop ResponseCurveGrid"
```

---

## Task 13: Full validation — build + runtime

**Files:** none (verification only)

- [ ] **Step 1: Clean build**

Run: `rm -rf .next && npm run build 2>&1 | tail -40`
Expected: build succeeds; `/dashboard/mmm` listed as `○ Static`.

- [ ] **Step 2: Test suite**

Run: `npx tsx --test src/shared/api/__tests__/mmm-data.test.ts`
Expected: `# pass 16` (all v2 tests).

Run: `npm test 2>&1 | tail -5`
Expected: all vitest tests pass (74+).

- [ ] **Step 3: Dev server runtime smoke check**

Run: `curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/dashboard/mmm`
Expected: `HTTP 200` (assumes dev or prod server already running on 3000).

Run: `curl -s http://localhost:3000/dashboard/mmm | grep -oE "(채널 포화도|Should We Spend|Organic|AF 귀속|재배분 권고)" | sort -u`
Expected: at least 4 of the 5 Korean/English markers present.

- [ ] **Step 4: Browser visual verification (manual)**

Navigate to `http://localhost:3000/dashboard/mmm` in browser. Verify:
- ① Hero Verdict renders with channel status badges
- ② Saturation Meter shows ~66% value
- ③ ContributionDonut shows organic (gray) + 4 paid slices
- ④ 4 ChannelStatusCard click through → ChannelDetailModal opens with ResponseCurveCard
- ⑤ CpiQuadrant shows 4 dots in correct quadrants; CpiBenchmarkTable shows 4 rows with verdict badges
- ⑥ ReallocationSummary shows before/after horizontal bars with +$28K headline
- Sidebar "채널 포화도" entry active; other pages not regressed
- Locale toggle (if available): ko↔en swaps correctly

- [ ] **Step 5: Git status clean**

Run: `git status --short`
Expected: empty (all changes committed).

Run: `git log --oneline feat/mmm-dashboard ^main | head -20`
Expected: includes all v2 task commits in order.

---

## Post-completion

After all 13 tasks complete:
- `/dashboard/mmm` should fully reflect v2 spec 6-section design
- All v1 schema fields still present (used by ResponseCurveCard in drill-down modal)
- Phase 2 (AppsFlyer Benchmarks crawler) and Phase 3 (Python MMM) unchanged — schema-compatible

**Next step options:**
1. Push + create PR for review
2. Continue to Phase 2 (Benchmarks crawler spec)
3. Continue to Phase 3 (Python MMM spec)
