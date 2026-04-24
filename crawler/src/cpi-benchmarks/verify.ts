import { log } from "../lib/logger.js"

const LEVELPLAY_CPI_INDEX_URL = process.env.LEVELPLAY_CPI_INDEX_URL
  ?? "https://levelplay.com/cpi-index/"

export async function verifyEndpoint(): Promise<void> {
  const res = await fetch(LEVELPLAY_CPI_INDEX_URL, {
    method: "HEAD",
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) {
    log.error(`LevelPlay endpoint returned ${res.status}`)
    process.exit(1)
  }
  log.info(`LevelPlay endpoint alive (${res.status})`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  verifyEndpoint().catch((err) => {
    log.error(String(err))
    process.exit(1)
  })
}
