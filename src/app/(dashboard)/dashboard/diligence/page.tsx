"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import type { IconifyIcon } from "@iconify/types"
import { Icon } from "@iconify/react"
import graphUpBold from "@iconify-icons/solar/graph-up-bold"
import widget5Bold from "@iconify-icons/solar/widget-5-bold"
import { PageHeader } from "@/shared/ui"
import { PageTransition, FadeInUp } from "@/shared/ui/page-transition"
import { useLocale, type TranslationKey } from "@/shared/i18n"
import { flaskBold } from "@/shared/config/custom-icons"

type DiligenceCard = {
  href: string
  icon: IconifyIcon
  titleKey: TranslationKey
  descKey: TranslationKey
}

const CARDS: DiligenceCard[] = [
  {
    href: "/dashboard/market-gap",
    icon: graphUpBold,
    titleKey: "diligence.card.market.title",
    descKey: "diligence.card.market.desc",
  },
  {
    href: "/dashboard/mmm",
    icon: widget5Bold,
    titleKey: "diligence.card.channel.title",
    descKey: "diligence.card.channel.desc",
  },
  {
    href: "/dashboard/prism",
    icon: flaskBold,
    titleKey: "diligence.card.prism.title",
    descKey: "diligence.card.prism.desc",
  },
]

export default function DiligencePage() {
  const { t } = useLocale()

  return (
    <PageTransition>
      <div className="px-10 pt-6 pb-24">
        <FadeInUp>
          <PageHeader titleKey="diligence.page.title" subtitleKey="diligence.page.subtitle" />
        </FadeInUp>

        <FadeInUp className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="group rounded-[var(--radius-card)] border border-border bg-card p-6 flex flex-col gap-4 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-[var(--radius-card)] bg-[var(--bg-2)] p-3">
                    <Icon icon={card.icon} className="size-5 text-foreground" />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors mt-0.5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">{t(card.titleKey)}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t(card.descKey)}</p>
                </div>
              </Link>
            ))}
          </div>
        </FadeInUp>
      </div>
    </PageTransition>
  )
}
