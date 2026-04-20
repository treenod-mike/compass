import { writeFileSync, existsSync, rmSync } from "node:fs";

export function acquireLock(path: string): boolean {
  if (existsSync(path)) return false;
  writeFileSync(path, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: "wx" });
  return true;
}

export function releaseLock(path: string): void {
  if (existsSync(path)) rmSync(path);
}
