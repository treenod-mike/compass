import { existsSync, readFileSync } from "node:fs";

export type ValidityResult =
  | { valid: true }
  | { valid: false; reason: "missing" | "expired" | "no-meta" | "parse-error" };

export interface StorageMeta {
  savedAt: string;
}

export function readStorageStateMeta(path: string): StorageMeta | null {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return raw._meta ?? null;
  } catch {
    return null;
  }
}

export function isStorageStateValid(path: string, ttlDays: number): ValidityResult {
  if (!existsSync(path)) return { valid: false, reason: "missing" };
  let raw: any;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { valid: false, reason: "parse-error" };
  }
  if (!raw._meta?.savedAt) return { valid: false, reason: "no-meta" };
  const ageMs = Date.now() - new Date(raw._meta.savedAt).getTime();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  if (ageMs > ttlMs) return { valid: false, reason: "expired" };
  return { valid: true };
}
