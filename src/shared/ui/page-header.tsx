"use client"

import { useLocale } from "@/shared/i18n"
import type { TranslationKey } from "@/shared/i18n"

type PageHeaderProps = {
  titleKey: TranslationKey
  subtitleKey: TranslationKey
}

export function PageHeader({ titleKey, subtitleKey }: PageHeaderProps) {
  const { t, locale } = useLocale()

  return (
    <div className="mb-6">
      <h1 className="text-foreground font-bold" style={{ fontSize: "var(--tds-t2-size)", lineHeight: "var(--tds-t2-line)" }}>
        {t(titleKey)}
      </h1>
      <p className="mt-1 text-muted-foreground flex items-center gap-2" style={{ fontSize: "var(--tds-t6-size)", lineHeight: "var(--tds-t6-line)" }}>
        {t(subtitleKey)}
        <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/60">
          {locale === "en" ? "Sample data" : "샘플 데이터"}
        </span>
      </p>
    </div>
  )
}
