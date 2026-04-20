import { AppSidebar } from "@/widgets/sidebar"
import { RunwayStatusBar } from "@/widgets/app-shell"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <RunwayStatusBar />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-[var(--background)] px-10 pb-24 pt-6">
          {children}
        </main>
        <AppSidebar />
      </div>
    </div>
  )
}
