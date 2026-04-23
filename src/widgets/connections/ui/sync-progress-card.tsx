"use client"
import type { AppState } from "@/shared/api/appsflyer"

export type SyncProgressCardProps = {
  progress: AppState["progress"]
}

export function SyncProgressCard({ progress }: SyncProgressCardProps) {
  const pct = Math.round((progress.step / progress.total) * 100)
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-3">
      <div className="mb-1 text-xs text-[var(--fg-2)]">
        초기 14일 데이터 수집 중 {progress.step} / {progress.total}
      </div>
      <div className="h-2 w-full overflow-hidden rounded-[var(--radius-inline)] bg-[var(--bg-2)]">
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-full bg-[var(--brand)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      {progress.currentReport && (
        <div className="mt-1 font-mono text-xs text-[var(--fg-2)]">
          {progress.currentReport}
        </div>
      )}
      <div className="mt-0.5 text-xs text-[var(--fg-2)]">{progress.rowsFetched} rows</div>
    </div>
  )
}
