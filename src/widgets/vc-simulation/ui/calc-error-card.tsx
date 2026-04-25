"use client"

import { useLocale } from "@/shared/i18n"

export function CalcErrorCard() {
  const { t } = useLocale()
  return (
    <div className="border border-[var(--signal-risk)] rounded-[var(--radius-card)] p-8 text-center">
      <div className="text-[var(--signal-risk)] text-lg">{t("vc.error.calcFailed")}</div>
    </div>
  )
}
