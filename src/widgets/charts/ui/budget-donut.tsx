"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import type { BudgetSlice } from "@/shared/api/mock-data"
import { ExpandButton } from "@/shared/ui/expand-button"
import { useChartExpand } from "@/shared/hooks/use-chart-expand"
import { BUDGET_DONUT_COLORS } from "@/shared/config/chart-colors"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts"
import { CHART_TYPO } from "@/shared/config/chart-typography"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

const C = BUDGET_DONUT_COLORS

type BudgetDonutProps = {
  data: BudgetSlice[]
  expanded?: boolean
  onToggle?: () => void
  compact?: boolean
}

export function BudgetDonut({
  data,
  expanded: externalExpanded,
  onToggle: externalToggle,
  compact = false,
}: BudgetDonutProps) {
  const { t, locale } = useLocale()
  const { expanded, toggle, gridClassName, chartHeight } = useChartExpand({
    baseHeight: 200,
    expanded: externalExpanded,
    onToggle: externalToggle,
  })

  const chartBody = (
    <div className="flex-1" style={{ minHeight: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            dataKey="value"
            paddingAngle={3}
            strokeWidth={0}
            animationBegin={200}
            animationDuration={1000}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            iconSize={10}
            wrapperStyle={{ ...CHART_TYPO.legend, color: C.legend }}
            formatter={(value: string, entry: { payload?: { value?: number } }) =>
              `${value} (${entry.payload?.value ?? 0}%)`
            }
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )

  // --- Compact mode: no Card wrapper ---
  if (compact) {
    return (
      <div className="flex flex-col h-full">
        {chartBody}
      </div>
    )
  }

  // --- Full mode: Gameboard-pattern Card wrapper ---
  return (
    <motion.div
      layout
      className={gridClassName}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="rounded-2xl hover:border-primary transition-colors h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {t("chart.budgetAlloc")}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {t("info.budgetDonut")}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ExpandButton expanded={expanded} onToggle={toggle} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 pt-0">
          {chartBody}
        </CardContent>
      </Card>
    </motion.div>
  )
}
