"use client"

import { useEffect, useState } from "react"
import type { Offer, VcSimResult } from "@/shared/api/vc-simulation"

const STORAGE_KEY = "compass:sim-history"
const MAX_ENTRIES = 30

export type SimHistoryEntry = {
  id: string
  savedAt: number
  label: string
  offer: Offer
  // Snapshot of key outputs (saved alongside offer for instant preview without
  // re-computing). Re-computation on restore uses the live engine, so these
  // values may diverge slightly if compute changes — that's expected.
  preview: {
    irrPct: number | null
    moic: number | null
    paybackMonths: number | null
  }
}

function load(): SimHistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function save(entries: SimHistoryEntry[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota exceeded or storage disabled — silent fail
  }
}

export function useSimHistory() {
  const [entries, setEntries] = useState<SimHistoryEntry[]>([])

  // Hydrate from localStorage on mount (client-only)
  useEffect(() => {
    setEntries(load())
  }, [])

  const saveCurrent = (offer: Offer, result: VcSimResult, label?: string) => {
    const now = Date.now()
    const entry: SimHistoryEntry = {
      id: String(now),
      savedAt: now,
      label:
        label ??
        new Date(now).toLocaleString("ko-KR", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        }),
      offer,
      preview: {
        irrPct: Number.isFinite(result.baselineB.p50Irr)
          ? result.baselineB.p50Irr * 100
          : null,
        moic: Number.isFinite(result.baselineB.p50Moic)
          ? result.baselineB.p50Moic
          : null,
        paybackMonths: result.baselineB.paybackMonths,
      },
    }
    setEntries((prev) => {
      const next = [entry, ...prev].slice(0, MAX_ENTRIES)
      save(next)
      return next
    })
  }

  const remove = (id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id)
      save(next)
      return next
    })
  }

  const clear = () => {
    save([])
    setEntries([])
  }

  return { entries, saveCurrent, remove, clear }
}
