"use client"
import type { AppState } from "@/shared/api/appsflyer"

const STATUS_STYLES: Record<AppState["status"], { dot: string; label: string }> = {
  backfilling:        { dot: "bg-[var(--signal-pending)]",  label: "초기 데이터 수집 중" },
  active:             { dot: "bg-[var(--signal-positive)]", label: "Active" },
  stale:              { dot: "bg-[var(--signal-caution)]",  label: "Stale" },
  failed:             { dot: "bg-[var(--signal-risk)]",     label: "Last sync failed" },
  credential_invalid: { dot: "bg-[var(--signal-risk)]",     label: "인증 만료" },
  app_missing:        { dot: "bg-[var(--signal-risk)]",     label: "앱 미등록" },
}

export type AppCardProps = {
  appId: string
  label: string
  state: AppState
}

export function AppCard({ appId, label, state }: AppCardProps) {
  const style = STATUS_STYLES[state.status]
  const installsCount = state.progress.rowsFetched
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--fg-0)]">{label}</h3>
        <span className="font-mono text-xs text-[var(--fg-2)]">{appId}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
        <span className="text-[var(--fg-1)]">{style.label}</span>
      </div>
      {state.status === "active" && (
        <div className="mt-2 text-xs text-[var(--fg-2)]">
          14일간 설치 {installsCount}
        </div>
      )}
      {state.status === "backfilling" && (
        <div className="mt-2 text-xs text-[var(--fg-2)]">
          {state.progress.step} / {state.progress.total}
        </div>
      )}
      {state.status === "failed" && (
        <div className="mt-2">
          <button className="rounded-[var(--radius-inline)] bg-[var(--signal-risk)] px-2 py-0.5 text-xs text-white">
            재시도
          </button>
        </div>
      )}
      {state.status === "credential_invalid" && (
        <div className="mt-2">
          <button className="rounded-[var(--radius-inline)] bg-[var(--signal-risk)] px-2 py-0.5 text-xs text-white">
            토큰 재등록
          </button>
        </div>
      )}
      {state.status === "app_missing" && (
        <div className="mt-2">
          <button className="rounded-[var(--radius-inline)] bg-[var(--signal-risk)] px-2 py-0.5 text-xs text-white">
            App ID 확인
          </button>
        </div>
      )}
    </div>
  )
}
