"use client"

import { Pin, X } from "lucide-react"
import { clsx } from "clsx"
import { useLocale } from "@/shared/i18n"

type Props = {
  isPinned: boolean
  onPin: () => void
  onClear: () => void
}

export function ScenarioPinButton({ isPinned, onPin, onClear }: Props) {
  const { t } = useLocale()
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPin}
        className={clsx(
          "flex-1 inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
          isPinned
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:border-primary hover:text-foreground",
        )}
      >
        <Pin className="size-3.5" />
        {isPinned ? t("vc.scenario.repin") : t("vc.scenario.pin")}
      </button>
      {isPinned && (
        <button
          type="button"
          onClick={onClear}
          aria-label={t("vc.scenario.clear")}
          className="rounded-md p-2 border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
