import type { Metadata } from "next"
import "@/styles/globals.css"
import { TooltipProvider } from "@/shared/ui/tooltip"
import { LocaleProvider } from "@/shared/i18n"

export const metadata: Metadata = {
  title: {
    default: "Compass | Experiment-to-Investment Decision OS",
    template: "%s | Compass",
  },
  description:
    "Translate A/B tests, live ops, and market signals into capital allocation decisions. Built for mobile gaming operators.",
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
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        <LocaleProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
