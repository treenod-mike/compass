import { writeFile, mkdir, readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { log } from "../lib/logger.js"
import { fetchLevelPlayCpi } from "./fetch-levelplay.js"
import { normalizeLevelPlayResponse } from "./normalize.js"
import { SnapshotSchema, type Snapshot } from "./schema.js"

const LEVELPLAY_API_URL = process.env.LEVELPLAY_API_URL ?? "https://levelplay.example/api/cpi-index"
const SNAPSHOT_PATH = resolve(
  process.cwd(),
  "../src/shared/api/data/cpi-benchmarks/levelplay-snapshot.json",
)

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function runIngest(): Promise<void> {
  log.info(`fetching LevelPlay CPI from ${LEVELPLAY_API_URL}`)
  const rows = await fetchLevelPlayCpi(LEVELPLAY_API_URL)
  log.info(`received ${rows.length} rows`)

  const { platforms, warnings } = normalizeLevelPlayResponse(rows)
  for (const w of warnings) log.warn(w)

  const now = new Date()
  const end = isoDate(now)
  const start = isoDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))

  const snapshot: Snapshot = {
    version: 1,
    source: "unity-levelplay-cpi-index",
    generatedAt: now.toISOString(),
    sourceRange: { start, end },
    platforms,
  }

  const parsed = SnapshotSchema.parse(snapshot)

  await mkdir(dirname(SNAPSHOT_PATH), { recursive: true })
  const prev = await readFile(SNAPSHOT_PATH, "utf8").catch(() => null)
  await writeFile(SNAPSHOT_PATH, JSON.stringify(parsed, null, 2) + "\n", "utf8")

  if (prev) {
    log.info(`snapshot updated (prev size=${prev.length}, new size=${JSON.stringify(parsed).length})`)
  } else {
    log.info(`snapshot created at ${SNAPSHOT_PATH}`)
  }
  log.info(`countries=${Object.keys(parsed.platforms.ios ?? {}).length} (ios), warnings=${warnings.length}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runIngest().catch((err) => {
    log.error(String(err))
    process.exit(1)
  })
}
