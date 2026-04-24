import { test } from "node:test"
import assert from "node:assert/strict"
import { mockTitleHealth, getGameData, getGameChartData } from "../mock-data"

test("mockTitleHealth: contains only poco (sample games removed)", () => {
  const ids = mockTitleHealth.map((r) => r.gameId)
  assert.deepEqual(ids, ["poco"])
})

test("getGameData returns poco data for unknown games (no game1/game2 stubs)", () => {
  const poco = getGameData("poco")
  assert.ok(poco, "poco should return data")
  // Unknown gameId should fall back to poco (verify fallback path still works)
  const unknown = getGameData("some-future-game")
  assert.deepEqual(unknown, poco)
})

test("getGameChartData returns poco data for unknown games", () => {
  const poco = getGameChartData("poco")
  const unknown = getGameChartData("some-future-game")
  assert.deepEqual(unknown, poco)
})
