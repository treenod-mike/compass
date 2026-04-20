import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isStorageStateValid, readStorageStateMeta } from "./session.js";

const TEST_PATH = join(tmpdir(), "test-storage-state.json");

describe("session", () => {
  afterEach(() => { if (existsSync(TEST_PATH)) rmSync(TEST_PATH); });

  it("returns invalid when file is missing", () => {
    expect(isStorageStateValid(TEST_PATH, 30)).toEqual({ valid: false, reason: "missing" });
  });

  it("returns invalid when file is older than TTL", () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    writeFileSync(TEST_PATH, JSON.stringify({ cookies: [], origins: [], _meta: { savedAt: old } }));
    expect(isStorageStateValid(TEST_PATH, 30)).toMatchObject({ valid: false, reason: "expired" });
  });

  it("returns valid when fresh", () => {
    const now = new Date().toISOString();
    writeFileSync(TEST_PATH, JSON.stringify({ cookies: [], origins: [], _meta: { savedAt: now } }));
    expect(isStorageStateValid(TEST_PATH, 30)).toEqual({ valid: true });
  });

  it("returns invalid when _meta missing", () => {
    writeFileSync(TEST_PATH, JSON.stringify({ cookies: [], origins: [] }));
    expect(isStorageStateValid(TEST_PATH, 30)).toMatchObject({ valid: false, reason: "no-meta" });
  });
});
