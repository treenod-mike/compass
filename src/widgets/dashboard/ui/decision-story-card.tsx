"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Icon as Iconify } from "@iconify/react"
import arrowRightBold from "@iconify-icons/solar/arrow-right-bold"
import graphUpBold from "@iconify-icons/solar/graph-up-bold"
import graphDownBold from "@iconify-icons/solar/graph-down-bold"
import type { SignalStatus } from "@/shared/api/mock-data"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog"
import { cn } from "@/shared/lib/utils"

/**
 * DecisionStoryCard — α+β hybrid, polished + interactive CTA pass.
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
  regionsLabel?: string
  ctaLabel?: string
  /** 선택: CTA 클릭 시 외부 핸들러. 미지정 시 내장 Dialog 노출 */
  onCta?: () => void
}

const STATUS_EMOJI: Record<SignalStatus, string> = {
  invest: "🚀",
  hold: "⚠️",
  reduce: "🚨",
}

const STATUS_KO: Record<SignalStatus, string> = {
  invest: "확대 권고",
  hold: "유지 권고",
  reduce: "축소 권고",
}

const STATUS_BADGE: Record<SignalStatus, string> = {
  invest: "bg-success/15 text-success ring-1 ring-success/20",
  hold: "bg-warning/20 text-warning ring-1 ring-warning/25",
  reduce: "bg-destructive/15 text-destructive ring-1 ring-destructive/20",
}

const STATUS_DOT: Record<SignalStatus, string> = {
  invest: "bg-success",
  hold: "bg-warning",
  reduce: "bg-destructive",
}

const REGION_STATUS_TAG: Record<SignalStatus, string> = {
  invest: "bg-success/15 text-success",
  hold: "bg-warning/20 text-warning",
  reduce: "bg-destructive/15 text-destructive",
}

function confidenceAsOutOfTen(conf: number): string {
  const outOf10 = Math.round(conf / 10)
  return `10번 중 ${outOf10}번 맞을 근거`
}

/** "12억원", "148%", "44일", "+6.2%p" 같은 숫자 토큰을 purple pill로 자동 강조 */
function highlightImpactNumbers(text: string): React.ReactNode {
  const regex = /([0-9][0-9.,]*[억만원일%p/]+(?:\s*[+\-]?[0-9.,]+[%p]?)?)/g
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span
        key={i}
        className="bg-primary/15 text-primary font-extrabold px-1.5 py-0.5 rounded-md"
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
  regionsLabel = "지역별 상태",
  ctaLabel = "자세히 보기",
  onCta,
}: DecisionStoryCardProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const ctaTrigger = (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={onCta}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold",
        "bg-primary text-primary-foreground shadow-lg shadow-primary/20",
      )}
    >
      {ctaLabel}
      <Iconify
        icon={arrowRightBold}
        width={16}
        height={16}
        className="transition-transform group-hover:translate-x-0.5"
      />
    </motion.button>
  )

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card",
        "transition-colors hover:border-primary",
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, transparent) 0%, transparent 50%)",
        }}
      />

      <div className="relative p-8 md:p-10 flex flex-col gap-7">
        {/* 1. Top — 단일 status 뱃지 (emoji + 한글 권고) */}
        <div className="flex items-center justify-between gap-4">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={
              mounted ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }
            }
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-extrabold",
              STATUS_BADGE[status],
            )}
          >
            <span className="text-lg leading-none" aria-hidden>
              {STATUS_EMOJI[status]}
            </span>
            {STATUS_KO[status]}
          </motion.div>
        </div>

        {/* 2. Hero headline */}
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

        {/* 4. β — 지역별 상태 (2개 이상일 때만) */}
        {regions.length >= 2 && (
          <div className="rounded-xl bg-muted/40 border border-border/60 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {regionsLabel}
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
                    {STATUS_KO[r.status].replace(" 권고", "")}
                  </span>
                  <span className="text-muted-foreground break-keep">
                    {r.reason}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 5. CTA — 내장 Dialog 또는 external handler */}
        <div className="flex justify-end">
          {onCta ? (
            ctaTrigger
          ) : (
            <Dialog>
              <DialogTrigger asChild>{ctaTrigger}</DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <span aria-hidden>{STATUS_EMOJI[status]}</span>
                    재배분 플랜 · 포코머지
                  </DialogTitle>
                  <DialogDescription>
                    현재 예산 대비 권장 분배 및 예상 효과 (mock)
                  </DialogDescription>
                </DialogHeader>
                <ReallocationPlanContent status={status} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </div>
  )
}

/** Mock 재배분 플랜 컨텐츠 */
function ReallocationPlanContent({ status }: { status: SignalStatus }) {
  const rows = [
    { label: "UA (신규 유저 획득)", before: "62%", after: "75%", delta: "+13%p" },
    { label: "라이브 이벤트", before: "22%", after: "15%", delta: "-7%p" },
    { label: "리텐션 보상", before: "10%", after: "8%", delta: "-2%p" },
    { label: "R&D / 콘텐츠", before: "6%", after: "2%", delta: "-4%p" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-muted/50 border border-border p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
          월 예산 재배분 권고
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold text-muted-foreground">
              <th className="text-left pb-2">항목</th>
              <th className="text-right pb-2">현재</th>
              <th className="text-right pb-2">권장</th>
              <th className="text-right pb-2">변화</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border/40">
                <td className="py-2 font-medium text-foreground">{r.label}</td>
                <td
                  className="py-2 text-right text-muted-foreground"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {r.before}
                </td>
                <td
                  className="py-2 text-right font-bold text-primary"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {r.after}
                </td>
                <td
                  className="py-2 text-right text-xs font-bold text-success"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {r.delta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-primary/5 p-4 flex flex-col gap-1">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          예상 효과
        </div>
        <div className="text-lg font-bold text-foreground">
          1년 내 매출{" "}
          <span className="text-primary">
            +12억원
          </span>{" "}
          · 본전 회수 평균{" "}
          <span className="text-primary">44일</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 break-keep">
          {status === "invest"
            ? "현재 ROAS 148%, 월 성장 +6.2%p 추세를 고려한 베이지안 사후 추정 기반. 신뢰도 78% 구간(P10 35일 ~ P90 58일)."
            : "현재 흐름을 유지할 때의 예상치입니다."}
        </div>
      </div>

      <div className="flex justify-end text-xs text-muted-foreground italic">
        * 데모용 mock 데이터 — 실제 재배분 API 미연결
      </div>
    </div>
  )
}

function MetricPill({ label, value, trend }: Metric) {
  const TrendIconData = trend?.direction === "down" ? graphDownBold : graphUpBold
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
        <div className={cn("flex items-center gap-1 text-xs font-semibold", trendColor)}>
          {trend.direction !== "flat" && (
            <Iconify icon={TrendIconData} width={14} height={14} />
          )}
          <span
            className="break-keep"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {trend.text}
          </span>
        </div>
      )}
    </div>
  )
}

/** 5-dot confidence gauge */
function ConfidenceGauge({ confidence }: { confidence: number }) {
  const filled = Math.round(confidence / 20)
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
