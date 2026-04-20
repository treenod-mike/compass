import type { Metadata } from "next"
import "@/styles/globals.css"
import { ThemeProvider } from "next-themes"
import { Toaster } from "sonner"
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
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LocaleProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </LocaleProvider>
          <Toaster position="top-right" closeButton duration={2000} />
        </ThemeProvider>
      </body>
    </html>
  )
}
