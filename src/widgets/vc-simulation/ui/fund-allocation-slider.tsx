"use client"

import * as Slider from "@radix-ui/react-slider"
import { useLocale } from "@/shared/i18n"

type Props = { uaSharePct: number; onChange: (pct: number) => void }

export function FundAllocationSlider({ uaSharePct, onChange }: Props) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{t("vc.field.uaShare")}: <span className="font-mono tabular-nums text-foreground">{uaSharePct.toFixed(0)}%</span></span>
        <span className="text-muted-foreground">{t("vc.field.opsShare")}: <span className="font-mono tabular-nums text-foreground">{(100 - uaSharePct).toFixed(0)}%</span></span>
      </div>
      <Slider.Root
        className="relative flex items-center w-full h-5"
        value={[uaSharePct]}
        onValueChange={([v]) => onChange(v)}
        min={0}
        max={100}
        step={5}
      >
        <Slider.Track className="bg-muted relative grow h-1 rounded-full">
          <Slider.Range className="absolute bg-primary h-full rounded-full" />
        </Slider.Track>
        <Slider.Thumb className="block w-4 h-4 bg-background border-2 border-primary rounded-full shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" />
      </Slider.Root>
    </div>
  )
}
