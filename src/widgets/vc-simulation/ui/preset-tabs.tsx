"use client"

import { PRESETS } from "@/shared/api/vc-simulation"
import type { Offer } from "@/shared/api/vc-simulation"
import { useLocale } from "@/shared/i18n"
import { clsx } from "clsx"

type Props = { active: keyof typeof PRESETS; onSelect: (preset: Offer) => void }

export function PresetTabs({ active, onSelect }: Props) {
  const { t } = useLocale()
  const items = [
    { key: "conservative" as const, label: t("vc.preset.conservative") },
    { key: "standard" as const,     label: t("vc.preset.standard") },
    { key: "aggressive" as const,   label: t("vc.preset.aggressive") },
  ]
  return (
    <div className="flex gap-1 mb-4">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onSelect(PRESETS[it.key])}
          className={clsx(
            "flex-1 text-xs font-medium px-2 py-1.5 rounded-md border transition-colors",
            active === it.key
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
