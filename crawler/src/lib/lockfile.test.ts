import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { acquireLock, releaseLock } from "./lockfile.js";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TEST_LOCK = join(tmpdir(), "test-crawler.lock");

describe("lockfile", () => {
  beforeEach(() => { if (existsSync(TEST_LOCK)) rmSync(TEST_LOCK); });
  afterEach(() => { if (existsSync(TEST_LOCK)) rmSync(TEST_LOCK); });

  it("acquires lock when file does not exist", () => {
    expect(acquireLock(TEST_LOCK)).toBe(true);
    expect(existsSync(TEST_LOCK)).toBe(true);
  });

  it("fails to acquire when lock exists", () => {
    acquireLock(TEST_LOCK);
    expect(acquireLock(TEST_LOCK)).toBe(false);
  });

  it("releases lock", () => {
    acquireLock(TEST_LOCK);
    releaseLock(TEST_LOCK);
    expect(existsSync(TEST_LOCK)).toBe(false);
  });
});
