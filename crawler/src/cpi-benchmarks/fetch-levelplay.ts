import type { LevelPlayRow } from "./normalize.js"

const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 1000
const REQUEST_TIMEOUT_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchLevelPlayCpi(url: string): Promise<readonly LevelPlayRow[]> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: { accept: "application/json" },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const body = (await res.json()) as { rows?: unknown } | null
      if (!body || !Array.isArray(body.rows)) {
        throw new Error(
          `unexpected LevelPlay response shape: ${JSON.stringify(Object.keys(body ?? {}))}`,
        )
      }
      return body.rows as LevelPlayRow[]
    } catch (err) {
      lastError = err
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1))
      }
    }
  }
  throw new Error(`fetchLevelPlayCpi fail after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`)
}
