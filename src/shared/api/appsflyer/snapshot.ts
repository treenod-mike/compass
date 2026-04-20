import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import {
  SnapshotSchema,
  type AppsFlyerCardData,
  type AppsFlyerSnapshot,
} from "./types"
import { ValidationError } from "./errors"
import { EMPTY_CARD, deriveCardFromSnapshot } from "./snapshot-derive"

export {
  deriveCardFromSnapshot,
  deriveStatus,
  formatRelative,
} from "./snapshot-derive"

const DEFAULT_PATH = resolve(
  process.cwd(),
  "src/shared/api/data/appsflyer/snapshot.json",
)

export function writeSnapshotTo(path: string, snap: AppsFlyerSnapshot): void {
  const parsed = SnapshotSchema.safeParse(snap)
  if (!parsed.success) {
    throw new ValidationError("write.snapshot", parsed.error.message)
  }
  writeFileSync(path, JSON.stringify(parsed.data, null, 2) + "\n", "utf-8")
}

export function readSnapshotFrom(path: string): AppsFlyerSnapshot | null {
  if (!existsSync(path)) return null
  const raw = JSON.parse(readFileSync(path, "utf-8"))
  const parsed = SnapshotSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError("read.snapshot", parsed.error.message)
  }
  return parsed.data
}

export function writeSnapshot(snap: AppsFlyerSnapshot): void {
  writeSnapshotTo(DEFAULT_PATH, snap)
}

export function readSnapshot(): AppsFlyerSnapshot | null {
  return readSnapshotFrom(DEFAULT_PATH)
}

export function getAppsFlyerCardData(): AppsFlyerCardData {
  try {
    const snap = readSnapshot()
    if (!snap) return EMPTY_CARD
    if (Date.parse(snap.fetchedAt) <= 0) return EMPTY_CARD
    return deriveCardFromSnapshot(snap)
  } catch {
    return EMPTY_CARD
  }
}
