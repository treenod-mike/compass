import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { LstmSnapshotSchema } from "../types"

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURES = join(HERE, "fixtures")

test("lstm.valid.json passes schema", () => {
  const raw = JSON.parse(readFileSync(join(FIXTURES, "lstm.valid.json"), "utf-8"))
  const r = LstmSnapshotSchema.safeParse(raw)
  assert.equal(r.success, true)
})

test("lstm.malformed.json (9 points) fails schema", () => {
  const raw = JSON.parse(readFileSync(join(FIXTURES, "lstm.malformed.json"), "utf-8"))
  const r = LstmSnapshotSchema.safeParse(raw)
  assert.equal(r.success, false)
})

test("production retention-snapshot.json passes schema", () => {
  const raw = JSON.parse(readFileSync(
    join(HERE, "..", "..", "data", "lstm", "retention-snapshot.json"),
    "utf-8"
  ))
  const r = LstmSnapshotSchema.safeParse(raw)
  assert.equal(r.success, true, r.success ? "" : JSON.stringify(r.error.issues))
})
