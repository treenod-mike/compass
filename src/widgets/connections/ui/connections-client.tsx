"use client"
import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { RegisterModal } from "./register-modal"
import { AppCard } from "./app-card"
import { useAfState } from "@/shared/hooks/use-af-state"
import type { App } from "@/shared/api/appsflyer"

export type ConnectionsClientProps = {
  initialApps: App[]
}

export function ConnectionsClient({ initialApps }: ConnectionsClientProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const router = useRouter()

  const handleSuccess = useCallback(
    (_appId: string) => {
      setModalOpen(false)
      router.refresh()
    },
    [router],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--fg-0)]">연동 (Connections)</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-[var(--radius-inline)] bg-[var(--brand)] px-3 py-1 text-sm text-white"
        >
          + 연동 추가
        </button>
      </div>

      {initialApps.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--bg-3)] p-8 text-center text-sm text-[var(--fg-2)]">
          등록된 AppsFlyer 앱이 없습니다. 위 버튼으로 추가하세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {initialApps.map((app) => (
            <AppCardWithPolling key={app.appId} app={app} />
          ))}
        </div>
      )}

      <RegisterModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  )
}

function AppCardWithPolling({ app }: { app: App }) {
  const { state, error } = useAfState(app.appId)
  if (error) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--signal-risk)] bg-[var(--bg-1)] p-4 text-xs text-[var(--signal-risk)]">
        {app.label} ({app.appId}) — state load failed: {error}
      </div>
    )
  }
  if (!state) {
    return (
      <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4 text-xs text-[var(--fg-2)]">
        {app.label} — loading...
      </div>
    )
  }
  return <AppCard appId={app.appId} label={app.label} state={state} />
}
