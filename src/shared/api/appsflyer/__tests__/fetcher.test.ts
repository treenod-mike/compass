import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { parseMasterRows, parseCohortRows } from "../fetcher"

const __dirname = dirname(fileURLToPath(import.meta.url))

test("parseMasterRows: accepts fixture shape", () => {
  const raw = JSON.parse(
    readFileSync(resolve(__dirname, "../__fixtures__/master.json"), "utf-8"),
  )
  const rows = parseMasterRows(raw)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].date, "2026-04-18")
  assert.equal(rows[0].installs, 42)
})

test("parseCohortRows: accepts fixture shape", () => {
  const raw = JSON.parse(
    readFileSync(resolve(__dirname, "../__fixtures__/cohort.json"), "utf-8"),
  )
  const rows = parseCohortRows(raw)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].retention_day_1, 0.42)
})
