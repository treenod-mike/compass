import { describe, it, beforeEach } from "node:test"
import { strict as assert } from "node:assert"
import { useGameSettings, DEFAULT_GAME_SETTINGS } from "../game-settings"

describe("game-settings store", () => {
  beforeEach(() => {
    useGameSettings.setState({ settings: { ...DEFAULT_GAME_SETTINGS } })
  })

  it("exposes default for poco = (JP, merge)", () => {
    const s = useGameSettings.getState().settings["poco"]
    assert.equal(s?.country, "JP")
    assert.equal(s?.genre, "merge")
  })

  it("updateSettings merges partial update", () => {
    useGameSettings.getState().updateSettings("poco", { country: "US" })
    const s = useGameSettings.getState().settings["poco"]
    assert.equal(s?.country, "US")
    assert.equal(s?.genre, "merge")
  })

  it("updateSettings creates entry for unknown game", () => {
    useGameSettings.getState().updateSettings("future-game", { country: "KR", genre: "puzzle" })
    const s = useGameSettings.getState().settings["future-game"]
    assert.equal(s?.country, "KR")
    assert.equal(s?.genre, "puzzle")
  })
})
