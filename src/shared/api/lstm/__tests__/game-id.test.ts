import { describe, expect, it } from "vitest"
import { resolveSnapshotGameId } from "../game-id"

describe("resolveSnapshotGameId", () => {
  it("maps internal `poco` to snapshot key `poko_merge`", () => {
    expect(resolveSnapshotGameId("poco")).toBe("poko_merge")
  })

  it("passes unknown game ids through unchanged", () => {
    expect(resolveSnapshotGameId("portfolio")).toBe("portfolio")
    expect(resolveSnapshotGameId("unmapped-game")).toBe("unmapped-game")
  })
})
