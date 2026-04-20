"use client"

import { TrendingUp, TrendingDown } from "lucide-react"
import type { SignalStatus } from "@/shared/api/mock-data"
import { Card } from "@/shared/ui/card"
import { cn } from "@/shared/lib/utils"

/**
 * OverviewSummaryStrip — "투자 결정" 페이지 최상단 4칸 요약 strip.
 *
 * - 판정 카드(Verdict) 위에 얹혀 "한 줄로 핵심 4개 숫자"만 제시.
 * - 숫자는 tabular-nums로 정렬, 트렌드는 색/화살표로 시각화.
 * - 명사 레이블 (ROAS, MOIC 등)은 영어 약어 유지.
 */

type SummaryItem = {
  label: string
  value: string
  unit?: string
  trend?: { delta: string; direction: "up" | "down"; caption?: string }
  status?: SignalStatus
}

const STATUS_LABEL: Record<SignalStatus, string> = {
  invest: "확대",
  hold: "유지",
  reduce: "축소",
}

const STATUS_DOT: Record<SignalStatus, string> = {
  invest: "bg-success",
  hold: "bg-warning",
  reduce: "bg-destructive",
}

type OverviewSummaryStripProps = {
  runwayMonths: number
  runwayTrend: number
  blendedRoas: number
  blendedRoasTrend: number
  confidence: number
  status: SignalStatus
  portfolioMoic: number
  portfolioMoicTrend: number
}

export function OverviewSummaryStrip({
  runwayMonths,
  runwayTrend,
  blendedRoas,
  blendedRoasTrend,
  confidence,
  status,
  portfolioMoic,
  portfolioMoicTrend,
}: OverviewSummaryStripProps) {
  const items: SummaryItem[] = [
    {
      label: "런웨이",
      value: runwayMonths.toFixed(1),
      unit: "개월",
      trend: {
        delta: `${runwayTrend >= 0 ? "+" : ""}${runwayTrend.toFixed(1)}`,
        direction: runwayTrend >= 0 ? "up" : "down",
        caption: "현금 보유 기준",
      },
    },
    {
      label: "Blended ROAS",
      value: `${blendedRoas}`,
      unit: "%",
      trend: {
        delta: `${blendedRoasTrend >= 0 ? "+" : ""}${blendedRoasTrend.toFixed(1)}%p`,
        direction: blendedRoasTrend >= 0 ? "up" : "down",
        caption: "전월 대비",
      },
    },
    {
      label: "판정 신뢰도",
      value: `${confidence}`,
      unit: "%",
      status,
    },
    {
      label: "Portfolio MOIC",
      value: portfolioMoic.toFixed(2),
      unit: "x",
      trend: {
        delta: `${portfolioMoicTrend >= 0 ? "+" : ""}${portfolioMoicTrend.toFixed(2)}x`,
        direction: portfolioMoicTrend >= 0 ? "up" : "down",
        caption: "누적 투자 배수",
      },
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {items.map((item) => (
        <SummaryCard key={item.label} {...item} />
      ))}
    </div>
  )
}

function SummaryCard({ label, value, unit, trend, status }: SummaryItem) {
  const TrendIcon = trend?.direction === "up" ? TrendingUp : TrendingDown
  const trendColor =
    trend?.direction === "up"
      ? "text-success"
      : "text-destructive"

  return (
    <Card size="sm" className="px-4 py-4 gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {status && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
            <span className={cn("w-2 h-2 rounded-full", STATUS_DOT[status])} />
            {STATUS_LABEL[status]}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-1">
        <span
          className="text-3xl font-bold text-foreground leading-none"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm font-semibold text-muted-foreground">
            {unit}
          </span>
        )}
      </div>

      {trend && (
        <div className={cn("flex items-center gap-1 text-xs font-medium", trendColor)}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{trend.delta}</span>
          {trend.caption && (
            <span className="text-muted-foreground font-normal ml-1">
              {trend.caption}
            </span>
          )}
        </div>
      )}
    </Card>
  )
}
