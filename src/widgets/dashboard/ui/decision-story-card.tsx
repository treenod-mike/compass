"use client"

import { useEffect, useState } from "react"
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react"
import { motion } from "framer-motion"
import type { SignalStatus } from "@/shared/api/mock-data"
import { cn } from "@/shared/lib/utils"

/**
 * DecisionStoryCard — α+β hybrid, polished pass.
 *
 * 디자인 원칙:
 *  - 브랜드(purple) 톤 우선, 상태 색(green/amber/red)은 chip·dot에만 제한
 *  - border-l accent 제거 → 상단 status chip + subtle bg gradient
 *  - 임팩트 숫자(매출 12억원) 하이라이트: bg + color + 큰 font
 *  - 이모지 mount 시 scale-in 애니메이션으로 생동감
 *  - CTA: purple gradient pill + hover lift
 */

type Metric = {
  label: string
  value: string
  trend?: { text: string; direction: "up" | "down" | "flat" }
}

type RegionStatus = {
  label: string
  status: SignalStatus
  reason: string
}

type DecisionStoryCardProps = {
  status: SignalStatus
  headline: string
  impactText: string
  confidence: number
  metrics: Metric[]
  regions: RegionStatus[]
  ctaLabel?: string
  onCta?: () => void
}

const STATUS_EMOJI: Record<SignalStatus, string> = {
  invest: "🚀",
  hold: "⚠️",
  reduce: "🚨",
}

const STATUS_KO: Record<SignalStatus, string> = {
  invest: "확대 타이밍",
  hold: "관망 중",
  reduce: "축소 권고",
}

const STATUS_PILL: Record<SignalStatus, string> = {
  invest: "bg-success/12 text-success",
  hold: "bg-warning/15 text-warning",
  reduce: "bg-destructive/12 text-destructive",
}

const STATUS_DOT: Record<SignalStatus, string> = {
  invest: "bg-success",
  hold: "bg-warning",
  reduce: "bg-destructive",
}

const REGION_STATUS_TAG: Record<SignalStatus, string> = {
  invest: "bg-success/12 text-success",
  hold: "bg-warning/15 text-warning",
  reduce: "bg-destructive/12 text-destructive",
}

function confidenceAsOutOfTen(conf: number): string {
  const outOf10 = Math.round(conf / 10)
  return `10번 중 ${outOf10}번 맞을 근거`
}

/** Highlight tokens like "12억원", "4,500만원", "N일", "N%p". */
function highlightImpactNumbers(text: string): React.ReactNode {
  const regex = /([0-9][0-9.,]*[억만원일%p/]+(?:\s*[+\-]?[0-9.,]+[%p]?)?)/g
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span
        key={i}
        className="bg-primary/12 text-primary font-extrabold px-1.5 py-0.5 rounded-md"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export function DecisionStoryCard({
  status,
  headline,
  impactText,
  confidence,
  metrics,
  regions,
  ctaLabel = "자세히 보기",
  onCta,
}: DecisionStoryCardProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card",
        "transition-colors hover:border-primary",
      )}
    >
      {/* 배경 그라데이션 — purple tint (subtle) */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--primary) 5%, transparent) 0%, transparent 45%)",
        }}
      />

      <div className="relative p-8 md:p-10 flex flex-col gap-7">
        {/* 1. Top row — emoji + status chip */}
        <div className="flex items-center justify-between gap-4">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={mounted ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className="text-4xl leading-none"
            aria-hidden
          >
            {STATUS_EMOJI[status]}
          </motion.span>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold",
              STATUS_PILL[status],
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status])} />
            {STATUS_KO[status]}
          </span>
        </div>

        {/* 2. Hero headline — 2단 구성 */}
        <div className="flex flex-col gap-3">
          <h2
            className="text-[30px] md:text-[34px] font-extrabold text-foreground leading-[1.2] tracking-tight break-keep"
            style={{ letterSpacing: "-0.02em" }}
          >
            {headline}
          </h2>

          <p className="text-lg font-semibold text-foreground/90 leading-relaxed break-keep flex flex-wrap items-baseline gap-x-1">
            {highlightImpactNumbers(impactText)}
          </p>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ConfidenceGauge confidence={confidence} />
            <span>
              {confidenceAsOutOfTen(confidence)}{" "}
              <span className="text-foreground/60">· 신뢰도 {confidence}점</span>
            </span>
          </div>
        </div>

        {/* 3. 3-metric supporting grid */}
        <div className="grid grid-cols-3 gap-3">
          {metrics.map((m) => (
            <MetricPill key={m.label} {...m} />
          ))}
        </div>

        {/* 4. β — 지역별 상태 (다중 지역일 때만 노출) */}
        {regions.length >= 2 && (
          <div className="rounded-xl bg-muted/40 border border-border/60 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                지역별 상태
              </span>
              <span className="flex-1 h-px bg-border/60" />
            </div>
            <ul className="flex flex-col gap-2.5">
              {regions.map((r) => (
                <li key={r.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm",
                      STATUS_DOT[r.status],
                    )}
                  />
                  <span className="font-bold text-foreground flex-shrink-0">
                    {r.label}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold flex-shrink-0",
                      REGION_STATUS_TAG[r.status],
                    )}
                  >
                    {STATUS_KO[r.status].replace(" 타이밍", "").replace(" 중", "").replace(" 권고", "")}
                  </span>
                  <span className="text-muted-foreground break-keep">
                    {r.reason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 5. CTA */}
        {onCta && (
          <div className="flex justify-end">
            <motion.button
              onClick={onCta}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className={cn(
                "group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold",
                "bg-primary text-primary-foreground shadow-lg shadow-primary/20",
              )}
            >
              {ctaLabel}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricPill({ label, value, trend }: Metric) {
  const TrendIcon = trend?.direction === "down" ? TrendingDown : TrendingUp
  const trendColor =
    trend?.direction === "down" ? "text-destructive" : "text-success"

  return (
    <div
      className={cn(
        "rounded-xl bg-card border border-border px-4 py-3.5 flex flex-col gap-1.5",
        "transition-all hover:border-primary/60 hover:shadow-sm",
      )}
    >
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide break-keep">
        {label}
      </span>
      <span
        className="text-[22px] font-extrabold text-foreground leading-none"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
      {trend && (
        <div
          className={cn("flex items-center gap-1 text-xs font-semibold", trendColor)}
        >
          {trend.direction !== "flat" && <TrendIcon className="w-3 h-3" />}
          <span className="break-keep" style={{ fontVariantNumeric: "tabular-nums" }}>
            {trend.text}
          </span>
        </div>
      )}
    </div>
  )
}

/** Tiny inline gauge — 5 dots, filled proportionally to confidence. */
function ConfidenceGauge({ confidence }: { confidence: number }) {
  const filled = Math.round(confidence / 20) // 0-5
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-1.5 h-1.5 rounded-full transition-colors",
            i < filled ? "bg-primary" : "bg-primary/20",
          )}
        />
      ))}
    </span>
  )
}
