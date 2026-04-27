"use client"

import { useLocale } from "@/shared/i18n"

export function CalcErrorCard() {
  const { t } = useLocale()
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-8 text-center">
      <div className="text-destructive text-lg font-semibold">{t("vc.error.calcFailed")}</div>
    </div>
  )
}
