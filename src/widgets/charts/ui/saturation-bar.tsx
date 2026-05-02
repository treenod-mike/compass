"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { SATURATION_BAR_COLORS } from "@/shared/config/chart-colors"
import { ChartTooltip } from "@/shared/ui/chart-tooltip"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

const C = SATURATION_BAR_COLORS

type SaturationBarProps = {
  data: { metric: string; myGame: number; genreAvg: number }[]
  compact?: boolean
}

export function SaturationBar({ data, compact = false }: SaturationBarProps) {
  const { t } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({ baseHeight: 220 })

  const chartBody = (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="4 4" stroke={C.grid} vertical={false} />
        <XAxis dataKey="metric" tick={{ ...CHART_TYPO.axisTick, fill: C.axis }} axisLine={{ stroke: C.border }} tickLine={false} />
        <YAxis tick={{ ...CHART_TYPO.axisTick, fill: C.axis }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ ...CHART_TYPO.legend }} />
        <Bar dataKey="myGame" fill={C.myGame} radius={[4, 4, 0, 0]} barSize={16} name="포코머지" animationBegin={200} animationDuration={800} animationEasing="ease-out" />
        <Bar dataKey="genreAvg" fill={C.genreAvg} radius={[4, 4, 0, 0]} barSize={16} name={t("chart.genreAvg")} animationBegin={200} animationDuration={800} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  )

  if (compact) {
    return <div>{chartBody}</div>
  }

  return (
    <motion.div layout className={gridClassName} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="rounded-2xl hover:border-primary transition-colors h-full">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("chart.saturation")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {t("info.saturation")}
              </CardDescription>
            </div>
            <div className="shrink-0">
              <ExpandButton expanded={expanded} onToggle={toggle} />
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
