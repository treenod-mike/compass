import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeSnapshotAtomic } from "./snapshot-writer.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "snap-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("writeSnapshotAtomic", () => {
  it("writes new snapshot with no prior file", () => {
    writeSnapshotAtomic(dir, "merge-jp-snapshot.json", { x: 1 });
    expect(JSON.parse(readFileSync(join(dir, "merge-jp-snapshot.json"), "utf8"))).toEqual({ x: 1 });
  });

  it("backs up previous snapshot before overwrite", () => {
    writeFileSync(join(dir, "merge-jp-snapshot.json"), JSON.stringify({ old: true }));
    writeSnapshotAtomic(dir, "merge-jp-snapshot.json", { new: true });
    expect(JSON.parse(readFileSync(join(dir, "merge-jp-snapshot.json"), "utf8"))).toEqual({ new: true });
    expect(existsSync(join(dir, "last-good-snapshot.json"))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "last-good-snapshot.json"), "utf8"))).toEqual({ old: true });
  });
});
