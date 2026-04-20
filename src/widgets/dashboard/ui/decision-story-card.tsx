"use client"

import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react"
import type { SignalStatus } from "@/shared/api/mock-data"
import { Card } from "@/shared/ui/card"
import { cn } from "@/shared/lib/utils"

/**
 * DecisionStoryCard — Concept α + β (Toss Story + Linear 3-region narrative)
 *
 * /dashboard 최상단 투자 판정 덱의 리디자인 버전.
 *  - α: 이모지 + 평이어 Hero + 3 메트릭 + CTA
 *  - β: Hero 아래 3-지역 서사 (포코머지 글로벌/일본/국내 상태)
 *
 * 설계 원칙 (docs/top-card-research.md §2 Toss 8원칙):
 *  1) 단일 hero 문장 (평이어)
 *  2) 숫자 + 평이어 병기 ("신뢰도 78% · 10번 중 8번")
 *  3) 감정 태그 이모지 (🚀 / ⚠️ / 🚨)
 *  4) 3-metric supporting grid
 *  5) 지역별 상태 한 줄 서사 (β)
 *  6) 단일 primary CTA
 *  7) status 색은 좌측 border-l-4로 subtle
 *  8) 톤: 친근 · 전문 중간
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
  invest: "확대",
  hold: "유지",
  reduce: "축소",
}

const STATUS_BORDER: Record<SignalStatus, string> = {
  invest: "border-l-success",
  hold: "border-l-warning",
  reduce: "border-l-destructive",
}

const STATUS_DOT: Record<SignalStatus, string> = {
  invest: "bg-success",
  hold: "bg-warning",
  reduce: "bg-destructive",
}

function confidenceAsOutOfTen(conf: number): string {
  const outOf10 = Math.round(conf / 10)
  return `10번 중 ${outOf10}번 맞을 근거`
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
  return (
    <Card
      className={cn(
        "border-l-4 p-8 gap-6 hover:border-l-4",
        STATUS_BORDER[status],
      )}
    >
      {/* 1. Hero — emoji + 평이어 한 문장 */}
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none mt-1 flex-shrink-0">
          {STATUS_EMOJI[status]}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="text-[26px] font-bold text-foreground leading-snug tracking-tight break-keep">
            {headline}
          </h2>
        </div>
      </div>

      {/* 2. Impact + confidence */}
      <div className="pl-12 -mt-2">
        <p className="text-base font-semibold text-foreground/90 break-keep">
          {impactText}
        </p>
        <p className="text-sm text-muted-foreground mt-1 break-keep">
          ↳ {confidenceAsOutOfTen(confidence)}{" "}
          <span className="text-foreground/70">(신뢰도 {confidence}%)</span>
        </p>
      </div>

      {/* 3. 3-metric supporting grid */}
      <div className="grid grid-cols-3 gap-3 pl-12">
        {metrics.map((m) => (
          <MetricPill key={m.label} {...m} />
        ))}
      </div>

      {/* 4. β section — 지역별 상태 한 줄 서사 */}
      <div className="border-t border-border pt-5 pl-12">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
          지역별 상태
        </div>
        <ul className="flex flex-col gap-2.5">
          {regions.map((r) => (
            <li key={r.label} className="flex items-start gap-3">
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0 mt-[7px]",
                  STATUS_DOT[r.status],
                )}
              />
              <div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-bold text-foreground">
                  {r.label}
                </span>
                <span className="text-xs font-semibold text-foreground/70">
                  · {STATUS_KO[r.status]}
                </span>
                <span className="text-sm text-muted-foreground break-keep">
                  · {r.reason}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* 5. CTA */}
      {onCta && (
        <div className="flex justify-end pt-2">
          <button
            onClick={onCta}
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold",
              "bg-primary text-primary-foreground",
              "transition-transform hover:scale-[1.02] active:scale-[0.97]",
            )}
          >
            {ctaLabel}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </Card>
  )
}

function MetricPill({ label, value, trend }: Metric) {
  const TrendIcon = trend?.direction === "down" ? TrendingDown : TrendingUp
  const trendColor =
    trend?.direction === "down" ? "text-destructive" : "text-success"

  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3 flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide break-keep">
        {label}
      </span>
      <span
        className="text-xl font-bold text-foreground leading-none"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
      {trend && (
        <div
          className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}
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
