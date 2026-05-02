"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { RippleForecast } from "@/shared/api/mock-data"
import { ChartTooltip } from "@/shared/ui/chart-tooltip"
import { RIPPLE_FORECAST_COLORS } from "@/shared/config/chart-colors"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

const C = RIPPLE_FORECAST_COLORS

type RippleForecastFanProps = {
  forecast: RippleForecast
  variantName: string
  compact?: boolean
}

export function RippleForecastFan({ forecast, variantName, compact = false }: RippleForecastFanProps) {
  const { t } = useLocale()

  const data = forecast.stages.map(s => ({
    stage: `${s.percentage}%`,
    p50: s.predicted_ltv_lift,
    p10: s.ci_low,
    p90: s.ci_high,
    days: s.days_to_observe,
  }))

  const chartBody = (
    <ResponsiveContainer width="100%" height={compact ? 220 : 320}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="rippleBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.line} stopOpacity={0.28} />
            <stop offset="100%" stopColor={C.line} stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke={C.grid} vertical={false} />
        <XAxis
          dataKey="stage"
          tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
          axisLine={{ stroke: C.border }}
          tickLine={false}
          label={{ value: t("exp.stageRollout"), position: "insideBottom", offset: -5, ...CHART_TYPO.annotationText, fill: C.axis }}
        />
        <YAxis
          tick={{ ...CHART_TYPO.axisTick, fill: C.axis }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `$${v.toFixed(0)}`}
        />
        <Tooltip
          content={
            <ChartTooltip
              render={({ payload, label }) => (
                <div>
                  {label != null && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#0A0A0A", marginBottom: 4 }}>{label}</div>
                  )}
                  {payload.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1.6 }}>
                      <span style={{ color: "#6B7280" }}>{p.name}</span>
                      <span style={{ marginLeft: "auto", paddingLeft: 12, fontWeight: 500, color: "#0A0A0A", fontVariantNumeric: "tabular-nums" }}>
                        {p.value != null ? `$${Number(p.value).toFixed(0)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            />
          }
        />
        <Area type="monotone" dataKey="p90" stroke="none" fill="url(#rippleBand)" animationBegin={200} animationDuration={1200} animationEasing="ease-out" />
        <Area type="monotone" dataKey="p10" stroke="none" fill="#FFFFFF" animationBegin={200} animationDuration={1200} animationEasing="ease-out" />
        <Line type="monotone" dataKey="p50" stroke={C.line} strokeWidth={2.5} dot={{ r: 4, fill: "#FFFFFF", stroke: C.line, strokeWidth: 2 }} animationBegin={400} animationDuration={1000} animationEasing="ease-out" />
        <ReferenceLine y={0} stroke={C.axis} strokeDasharray="3 3" />
      </AreaChart>
    </ResponsiveContainer>
  )

  if (compact) {
    return <div>{chartBody}</div>
  }

  return (
    <motion.div layout transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="rounded-2xl hover:border-primary transition-colors h-full">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("exp.rippleForecast")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {variantName} · {t("info.rippleForecast")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {chartBody}
        </CardContent>
      </Card>
    </motion.div>
  )
}
