import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readSnapshotFrom, writeSnapshotTo } from "../snapshot"
import { deriveStatus } from "../snapshot-derive"
import type { AppsFlyerSnapshot } from "../types"

function tmp(): string {
  return join(mkdtempSync(join(tmpdir(), "af-")), "snap.json")
}

const makeSnap = (fetchedAt: string): AppsFlyerSnapshot => ({
  version: 2,
  fetchedAt,
  request: null,
  installs: null,
  meta: { warnings: [], source: "pull-api-v5" },
})

test("writeSnapshotTo + readSnapshotFrom: round-trip", () => {
  const path = tmp()
  const snap = makeSnap(new Date("2026-04-20T00:00:00Z").toISOString())
  writeSnapshotTo(path, snap)
  const read = readSnapshotFrom(path)
  assert.deepEqual(read, snap)
})

test("readSnapshotFrom: returns null on missing file", () => {
  const path = join(mkdtempSync(join(tmpdir(), "af-")), "missing.json")
  assert.equal(readSnapshotFrom(path), null)
})

test("readSnapshotFrom: throws on version mismatch", () => {
  const path = tmp()
  writeFileSync(path, JSON.stringify({ version: 99, fetchedAt: "x" }))
  assert.throws(() => readSnapshotFrom(path))
})

test("deriveStatus: thresholds", () => {
  const now = Date.now()
  assert.equal(
    deriveStatus(new Date(now - 23 * 3_600_000).toISOString()),
    "connected",
  )
  assert.equal(
    deriveStatus(new Date(now - 25 * 3_600_000).toISOString()),
    "warn",
  )
  assert.equal(
    deriveStatus(new Date(now - 6 * 24 * 3_600_000).toISOString()),
    "warn",
  )
  assert.equal(
    deriveStatus(new Date(now - 8 * 24 * 3_600_000).toISOString()),
    "error",
  )
})
