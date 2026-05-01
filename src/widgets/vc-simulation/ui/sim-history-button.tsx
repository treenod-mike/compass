"use client"

import { History, Save } from "lucide-react"
import { useLocale } from "@/shared/i18n"

type Props = {
  count: number
  onSave: () => void
  onOpenHistory: () => void
}

export function SimHistoryButton({ count, onSave, onOpenHistory }: Props) {
  const { t } = useLocale()
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
      >
        <Save className="size-3.5" />
        {t("vc.history.save")}
      </button>
      <button
        type="button"
        onClick={onOpenHistory}
        aria-label={t("vc.history.openLabel")}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
      >
        <History className="size-3.5" />
        {count > 0 && (
          <span className="font-mono tabular-nums">{count}</span>
        )}
      </button>
    </div>
  )
}
