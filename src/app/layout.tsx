import type { Metadata } from "next"
import "@/styles/globals.css"
import { Toaster } from "sonner"
import { TooltipProvider } from "@/shared/ui/tooltip"
import { LocaleProvider } from "@/shared/i18n"

export const metadata: Metadata = {
  title: {
    default: "Compass | 실험→투자 의사결정 OS",
    template: "%s | Compass",
  },
  description:
    "A/B 테스트, 라이브 운영, 시장 시그널을 자본 배분 결정으로 번역하는 AI 기반 의사결정 플랫폼.",
  icons: {
    icon: [{ url: "/images/logo/icon.png", type: "image/png" }],
    apple: "/images/logo/icon.png",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <LocaleProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </LocaleProvider>
        <Toaster position="top-right" closeButton duration={2000} />
      </body>
    </html>
  )
}
