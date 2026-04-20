"use client"

import { useState } from "react"
import { Icon as Iconify } from "@iconify/react"
import calendarBold from "@iconify-icons/solar/calendar-bold"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog"
import { cn } from "@/shared/lib/utils"

type Range = { from: string; to: string; label: string }

const PRESETS: Range[] = [
  { from: "2026-04-14", to: "2026-04-20", label: "지난 7일" },
  { from: "2026-04-07", to: "2026-04-20", label: "지난 14일" },
  { from: "2026-03-21", to: "2026-04-20", label: "지난 30일" },
  { from: "2026-01-01", to: "2026-04-20", label: "올해 (YTD)" },
]

const DEFAULT_RANGE = PRESETS[2]

function formatRange(r: Range) {
  return `${r.from.replaceAll("-", ".")} – ${r.to.replaceAll("-", ".")}`
}

export function DateRangePicker() {
  const [current, setCurrent] = useState<Range>(DEFAULT_RANGE)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center h-10 gap-2 rounded-full px-4",
            "border border-border bg-card hover:border-primary transition-colors",
            "text-sm font-semibold text-foreground",
          )}
        >
          <Iconify icon={calendarBold} width={16} height={16} className="text-primary" />
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatRange(current)}</span>
          <span className="text-muted-foreground text-xs font-normal">· {current.label}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Iconify icon={calendarBold} width={18} height={18} className="text-primary" />
            기간 선택
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {PRESETS.map((r) => {
            const selected = r.from === current.from && r.to === current.to
            return (
              <button
                key={r.label}
                type="button"
                onClick={() => setCurrent(r)}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border transition-colors",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/60",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      "text-sm font-bold",
                      selected ? "text-primary" : "text-foreground",
                    )}
                  >
                    {r.label}
                  </span>
                  <span
                    className="text-xs text-muted-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatRange(r)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-muted-foreground text-right italic">
          * 데모용 — 사용자 지정 범위 & 실제 데이터 연동은 후속 작업
        </p>
      </DialogContent>
    </Dialog>
  )
}
