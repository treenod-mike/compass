"use client"

import { motion } from "framer-motion"
import { useLocale } from "@/shared/i18n"
import { COHORT_HEATMAP_COLORS } from "@/shared/config/chart-colors"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/ui/card"

const C = COHORT_HEATMAP_COLORS

const cohortData = [
  { cohort: "Jan", d1: 41, d3: 28, d7: 17, d14: 12, d30: 7 },
  { cohort: "Feb", d1: 42, d3: 29, d7: 18, d14: 13, d30: 8 },
  { cohort: "Mar", d1: 42, d3: 28, d7: 19, d14: 13, d30: 9 },
]

function heatStyle(value: number): { bg: string; text: string } {
  if (value >= 35) return { bg: C.level5, text: "#FFFFFF" }
  if (value >= 25) return { bg: C.level4, text: "#FFFFFF" }
  if (value >= 15) return { bg: C.level3, text: "#FFFFFF" }
  if (value >= 10) return { bg: C.level2, text: "#1E3A6E" }
  return { bg: C.level1, text: "#2D5FA0" }
}

type CohortHeatmapProps = {
  compact?: boolean
}

export function CohortHeatmap({ compact = false }: CohortHeatmapProps) {
  const { locale } = useLocale()
  const days = ["D1", "D3", "D7", "D14", "D30"]

  const tableBody = (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-[var(--fg-2)]">Cohort</th>
            {days.map((d) => (
              <th key={d} className="px-3 py-2 text-center text-xs font-medium text-[var(--fg-2)]">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohortData.map((row) => (
            <tr key={row.cohort}>
              <td className="px-3 py-2 text-xs font-medium text-[var(--fg-2)]">{row.cohort} 2026</td>
              {[row.d1, row.d3, row.d7, row.d14, row.d30].map((val, i) => {
                const { bg, text } = heatStyle(val)
                return (
                  <td key={i} className="px-1 py-1">
                    <div
                      className="rounded-md px-3 py-2 text-center text-xs font-semibold font-mono"
                      style={{ backgroundColor: bg, color: text }}
                    >
                      {val}%
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  if (compact) {
    return <div className="flex flex-col h-full">{tableBody}</div>
  }

  return (
    <motion.div layout transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
      <Card className="rounded-2xl hover:border-primary transition-colors h-full flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex flex-row justify-between items-start gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground break-keep">
                {locale === "ko" ? "코호트 리텐션 히트맵" : "Cohort Retention Heatmap"}
              </CardTitle>
              <CardDescription className="mt-1 text-[11px] text-muted-foreground/80 break-keep">
                {locale === "ko" ? "월별 코호트 · D1 ~ D30 리텐션율" : "Monthly cohorts · D1 – D30 retention rate"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col flex-1 pt-0">
          {tableBody}
        </CardContent>
      </Card>
    </motion.div>
  )
}
