"use client"

import { useState } from "react"
import { Share2, Check } from "lucide-react"
import { clsx } from "clsx"
import { useLocale } from "@/shared/i18n"
import type { Offer } from "@/shared/api/vc-simulation"
import { useShareableOffer } from "../lib/use-shareable-offer"

type Props = { offer: Offer }

export function ShareLinkButton({ offer }: Props) {
  const { t } = useLocale()
  const { buildShareUrl } = useShareableOffer()
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = buildShareUrl(offer)
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked — fall back to a manual prompt
      window.prompt(t("vc.share.fallbackPrompt"), url)
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={t("vc.share.label")}
      className={clsx(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
        copied
          ? "border-[var(--signal-positive)] bg-[var(--signal-positive)]/10 text-[var(--signal-positive)]"
          : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
      )}
    >
      {copied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
      {copied ? t("vc.share.copied") : t("vc.share.label")}
    </button>
  )
}
