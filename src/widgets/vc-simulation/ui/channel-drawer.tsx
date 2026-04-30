"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { useLocale } from "@/shared/i18n"
import { mmmChannels } from "@/shared/api/mmm-data"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/shared/ui/sheet"
import { CpiBenchmarkTable } from "@/widgets/charts/ui/cpi-benchmark-table"
import { CpiQuadrant } from "@/widgets/charts/ui/cpi-quadrant"

type Props = {
  open: boolean
  onClose: () => void
}

export function ChannelDrawer({ open, onClose }: Props) {
  const { t } = useLocale()

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="border-b border-border px-5 py-3">
          <SheetTitle className="text-sm font-semibold">{t("vc.channel.title")}</SheetTitle>
          <Link
            href="/dashboard/mmm"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            {t("vc.channel.fullscreen")}
            <ArrowUpRight className="size-3" />
          </Link>
        </SheetHeader>

        <div className="p-5 space-y-6">
          <CpiQuadrant channels={mmmChannels} />
          <CpiBenchmarkTable channels={mmmChannels} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
