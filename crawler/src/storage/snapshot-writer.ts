import { writeFileSync, copyFileSync, renameSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function writeSnapshotAtomic(outDir: string, fileName: string, data: unknown): void {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const finalPath = join(outDir, fileName);
  const tmpPath = join(outDir, `.${fileName}.tmp.${process.pid}`);
  const backupPath = join(outDir, "last-good-snapshot.json");

  if (existsSync(finalPath)) {
    copyFileSync(finalPath, backupPath);
  }
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, finalPath);
}

export function writeLastUpdated(outDir: string, snapshotName: string): void {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const meta = {
    fetchedAt: new Date().toISOString(),
    snapshotPath: snapshotName,
    ageWarningDays: 14,
  };
  writeFileSync(join(outDir, "last-updated.json"), JSON.stringify(meta, null, 2));
}
