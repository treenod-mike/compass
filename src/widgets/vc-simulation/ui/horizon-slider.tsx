"use client"

import * as Slider from "@radix-ui/react-slider"
import { useLocale } from "@/shared/i18n"

type Props = { months: number; onChange: (m: number) => void }

export function HorizonSlider({ months, onChange }: Props) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs text-[var(--fg-2)]">
        <span>{t("vc.field.horizon")}</span>
        <span className="font-mono">{months} {t("vc.unit.months")}</span>
      </div>
      <Slider.Root
        className="relative flex items-center w-full h-5"
        value={[months]}
        onValueChange={([v]) => onChange(v)}
        min={12}
        max={60}
        step={6}
      >
        <Slider.Track className="bg-[var(--bg-3)] relative grow h-1 rounded-full">
          <Slider.Range className="absolute bg-[var(--brand)] h-full rounded-full" />
        </Slider.Track>
        <Slider.Thumb className="block w-4 h-4 bg-white border-2 border-[var(--brand)] rounded-full shadow" />
      </Slider.Root>
    </div>
  )
}
