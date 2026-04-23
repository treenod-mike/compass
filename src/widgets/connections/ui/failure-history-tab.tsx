"use client"
import type { AppState } from "@/shared/api/appsflyer"

export type FailureHistoryTabProps = {
  appId: string
  failureHistory: AppState["failureHistory"]
  onRetry: (appId: string) => void
}

const TYPE_COLOR: Record<string, string> = {
  auth_invalid: "text-[var(--signal-risk)]",
  not_found:    "text-[var(--signal-risk)]",
  full_failure: "text-[var(--signal-risk)]",
  throttled:    "text-[var(--signal-caution)]",
  partial:      "text-[var(--signal-caution)]",
  retryable:    "text-[var(--signal-caution)]",
}

export function FailureHistoryTab({ appId, failureHistory, onRetry }: FailureHistoryTabProps) {
  const entries = [...failureHistory].slice(-10).reverse()
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--bg-3)] bg-[var(--bg-1)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--fg-0)]">최근 실패 이력</h3>
        <button
          onClick={() => onRetry(appId)}
          aria-label="재시도"
          className="rounded-[var(--radius-inline)] bg-[var(--brand)] px-2 py-0.5 text-xs text-white"
        >
          재시도
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="text-xs text-[var(--fg-2)]">기록 없음</div>
      ) : (
        <ul className="space-y-1">
          {entries.map((e, idx) => (
            <li key={`${e.at}-${idx}`} className="flex items-start gap-2 text-xs">
              <span className="font-mono text-[var(--fg-2)]">
                {new Date(e.at).toISOString().slice(5, 16).replace("T", " ")}
              </span>
              <span className={`font-semibold ${TYPE_COLOR[e.type] ?? "text-[var(--fg-1)]"}`}>
                {e.type}
              </span>
              <span className="text-[var(--fg-1)]">{e.message}</span>
              {e.report && <span className="font-mono text-[var(--fg-2)]">({e.report})</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
