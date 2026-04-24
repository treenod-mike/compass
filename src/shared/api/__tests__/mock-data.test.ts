import { test } from "node:test"
import assert from "node:assert/strict"
import { mockTitleHealth } from "../mock-data"

test("mockTitleHealth: contains only poco (sample games removed)", () => {
  const ids = mockTitleHealth.map((r) => r.gameId)
  assert.deepEqual(ids, ["poco"])
})
