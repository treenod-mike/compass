"use client"
import { useEffect, useState } from "react"
import type { AppState } from "@/shared/api/appsflyer"

const POLL_MS = 2000
const TERMINAL: ReadonlyArray<AppState["status"]> = [
  "active", "credential_invalid", "app_missing", "failed",
]

export type UseAfStateResult = {
  state: AppState | null
  error: string | null
}

export function useAfState(appId: string | null): UseAfStateResult {
  const [state, setState] = useState<AppState | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!appId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const res = await fetch(`/api/appsflyer/state/${encodeURIComponent(appId)}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          if (!cancelled) setError(`HTTP ${res.status}`)
          return
        }
        const next = (await res.json()) as AppState
        if (cancelled) return
        setState(next)
        if (!TERMINAL.includes(next.status)) {
          timer = setTimeout(poll, POLL_MS)
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      }
    }
    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [appId])

  return { state, error }
}
