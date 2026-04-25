"use client"
import { useEffect, useState } from "react"
import type { App, AppState, CohortSummary } from "@/shared/api/appsflyer"

export type LiveAfData = {
  app: App | null
  state: AppState | null
  summary: CohortSummary | null
  badge: "ML1" | "ML2" | null
}

/**
 * Client-side hook that fetches the first registered app + its state + cohort summary
 * via existing API routes. Returns ML1/ML2/null badge per spec §5.1.
 *
 * Loads once on mount. Polling/SWR can be added later.
 */
export function useLiveAfData(): LiveAfData & { loading: boolean } {
  const [data, setData] = useState<LiveAfData>({
    app: null,
    state: null,
    summary: null,
    badge: "ML1",
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const appsRes = await fetch("/api/appsflyer/apps", {
          cache: "no-store",
        }).catch(() => null)

        if (!appsRes || !appsRes.ok) {
          if (!cancelled) {
            setData({ app: null, state: null, summary: null, badge: "ML1" })
            setLoading(false)
          }
          return
        }

        const apps = (await appsRes.json()) as App[]
        if (apps.length === 0) {
          if (!cancelled) {
            setData({ app: null, state: null, summary: null, badge: "ML1" })
            setLoading(false)
          }
          return
        }

        const app = apps[0]

        const stateRes = await fetch(
          `/api/appsflyer/state/${encodeURIComponent(app.appId)}`,
          { cache: "no-store" },
        ).catch(() => null)
        const state =
          stateRes && stateRes.ok
            ? ((await stateRes.json()) as AppState)
            : null

        const summaryRes = await fetch(
          `/api/appsflyer/summary/${encodeURIComponent(app.appId)}`,
          { cache: "no-store" },
        ).catch(() => null)
        const summary =
          summaryRes && summaryRes.ok
            ? ((await summaryRes.json()) as CohortSummary)
            : null

        let badge: LiveAfData["badge"] = null
        if (!state || state.status === "backfilling") {
          badge = "ML1"
        } else if (
          state.status === "stale" ||
          state.status === "failed" ||
          state.status === "credential_invalid" ||
          state.status === "app_missing"
        ) {
          badge = "ML2"
        }

        if (!cancelled) {
          setData({ app, state, summary, badge })
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setData({ app: null, state: null, summary: null, badge: "ML1" })
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { ...data, loading }
}
