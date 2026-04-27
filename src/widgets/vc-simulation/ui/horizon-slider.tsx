"use client"

import * as Slider from "@radix-ui/react-slider"
import { useLocale } from "@/shared/i18n"

type Props = { months: number; onChange: (m: number) => void }

export function HorizonSlider({ months, onChange }: Props) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t("vc.field.horizon")}</span>
        <span className="font-mono tabular-nums text-foreground">{months} {t("vc.unit.months")}</span>
      </div>
      <Slider.Root
        className="relative flex items-center w-full h-5"
        value={[months]}
        onValueChange={([v]) => onChange(v)}
        min={12}
        max={60}
        step={6}
      >
        <Slider.Track className="bg-muted relative grow h-1 rounded-full">
          <Slider.Range className="absolute bg-primary h-full rounded-full" />
        </Slider.Track>
        <Slider.Thumb className="block w-4 h-4 bg-background border-2 border-primary rounded-full shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
      </Slider.Root>
    </div>
  )
}
