"use client"

import { useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { X, ArrowUpRight } from "lucide-react"
import { useLocale } from "@/shared/i18n"
import { mmmChannels } from "@/shared/api/mmm-data"
import { CpiBenchmarkTable } from "@/widgets/charts/ui/cpi-benchmark-table"
import { CpiQuadrant } from "@/widgets/charts/ui/cpi-quadrant"

type Props = {
  open: boolean
  onClose: () => void
}

/**
 * 우측 slide-in drawer. open=true 시 480px 폭으로 등장.
 * 내부에 채널 분해 차트 (CpiQuadrant + CpiBenchmarkTable) 노출.
 * 헤더의 "전체 화면 ↗" 링크로 /dashboard/mmm 진입 가능.
 */
export function ChannelDrawer({ open, onClose }: Props) {
  const { t } = useLocale()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50"
            aria-hidden="true"
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-[480px] overflow-y-auto bg-card border-l border-border shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={t("vc.channel.title")}
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur px-5 py-3">
              <h2 className="text-sm font-semibold text-foreground">{t("vc.channel.title")}</h2>
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/mmm"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t("vc.channel.fullscreen")}
                  <ArrowUpRight className="size-3" />
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div className="p-5 space-y-6">
              <CpiQuadrant channels={mmmChannels} />
              <CpiBenchmarkTable channels={mmmChannels} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
