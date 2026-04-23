import { getState, putState } from "./blob-store"
import { ThrottledError } from "./errors"

const QUOTA = 20
const LOCK_TTL_MS = 300_000  // 5분

export async function incrementCalls(appId: string, delta: number): Promise<void> {
  const state = await getState(appId)
  if (!state) throw new Error(`state not found for ${appId}`)
  const newCount = state.callsUsedToday + delta
  if (newCount > QUOTA) {
    const retryAfter = Math.max(1, Math.ceil((new Date(state.callsResetAt).getTime() - Date.now()) / 1000))
    throw new ThrottledError(retryAfter)
  }
  await putState({ ...state, callsUsedToday: newCount })
}

export async function isResetDue(appId: string): Promise<boolean> {
  const state = await getState(appId)
  if (!state) return false
  return Date.now() >= new Date(state.callsResetAt).getTime()
}

export async function resetIfDue(appId: string): Promise<void> {
  const state = await getState(appId)
  if (!state) return
  if (Date.now() < new Date(state.callsResetAt).getTime()) return
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  tomorrow.setUTCHours(0, 0, 0, 0)
  await putState({
    ...state,
    callsUsedToday: 0,
    callsResetAt: tomorrow.toISOString(),
  })
}

export async function acquireLock(appId: string, execId: string): Promise<boolean> {
  const state = await getState(appId)
  if (!state) return false
  if (state.syncLock !== null) {
    const heldEpoch = new Date(state.syncLock.heldAt).getTime()
    if (Date.now() - heldEpoch < LOCK_TTL_MS) return false  // still valid
    // else: expired, fall through and overwrite
  }
  await putState({
    ...state,
    syncLock: {
      heldBy: execId,
      heldAt: new Date().toISOString(),
      ttlMs: LOCK_TTL_MS as 300000,
    },
  })
  return true
}

export async function releaseLock(appId: string, execId: string): Promise<void> {
  const state = await getState(appId)
  if (!state || !state.syncLock || state.syncLock.heldBy !== execId) return
  await putState({ ...state, syncLock: null })
}
