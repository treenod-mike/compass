"use client"

import { createContext, useContext, type ReactNode } from "react"
import { type Locale, type TranslationKey, translate } from "./dictionary"

type I18nContextType = {
  locale: Locale
  t: (key: TranslationKey) => string
}

const FIXED_LOCALE: Locale = "ko"

const I18nContext = createContext<I18nContextType>({
  locale: FIXED_LOCALE,
  t: (key) => translate(key, FIXED_LOCALE),
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  return <I18nContext.Provider value={{ locale: FIXED_LOCALE, t: (key) => translate(key, FIXED_LOCALE) }}>{children}</I18nContext.Provider>
}

export function useLocale() {
  return useContext(I18nContext)
}
