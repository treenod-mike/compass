"use client"

import { Trash2 } from "lucide-react"
import { useLocale } from "@/shared/i18n"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet"
import type { Offer } from "@/shared/api/vc-simulation"
import type { SimHistoryEntry } from "../lib/use-sim-history"

type Props = {
  open: boolean
  onClose: () => void
  entries: SimHistoryEntry[]
  onRestore: (offer: Offer) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function SimHistoryDrawer({
  open,
  onClose,
  entries,
  onRestore,
  onRemove,
  onClear,
}: Props) {
  const { t } = useLocale()

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="border-b border-border px-5 py-3">
          <SheetTitle className="text-sm font-semibold">
            {t("vc.history.title")}
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {t("vc.history.subtitle")}
          </p>
        </SheetHeader>

        <div className="p-5 space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              {t("vc.history.empty")}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("vc.history.count")} {entries.length} / 30
                </span>
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  {t("vc.history.clearAll")}
                </button>
              </div>

              <ul className="space-y-2">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onRestore(entry.offer)
                        onClose()
                      }}
                      className="w-full text-left rounded-md border border-border bg-card p-3 hover:border-primary transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-foreground">
                            {entry.label}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            ${(entry.offer.investmentUsd / 1000).toFixed(0)}K ·{" "}
                            {entry.offer.horizonMonths}mo · UA{" "}
                            {entry.offer.uaSharePct.toFixed(0)}%
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemove(entry.id)
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1 -mr-1"
                          aria-label={t("vc.history.remove")}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">IRR</span>
                          <span className="font-mono tabular-nums text-foreground">
                            {entry.preview.irrPct != null
                              ? `${entry.preview.irrPct.toFixed(1)}%`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">MOIC</span>
                          <span className="font-mono tabular-nums text-foreground">
                            {entry.preview.moic != null
                              ? `${entry.preview.moic.toFixed(2)}×`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">Payback</span>
                          <span className="font-mono tabular-nums text-foreground">
                            {entry.preview.paybackMonths != null
                              ? `${entry.preview.paybackMonths}mo`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
