import { put } from "@vercel/blob"
import { LstmSnapshotSchema, type LstmSnapshot } from "../vc-simulation/types"
import { RevenueSnapshotSchema, type RevenueSnapshot } from "./revenue-snapshot"

const RETENTION_PATH = "lstm/retention-snapshot.json"
const REVENUE_PATH = "lstm/revenue-snapshot.json"
const RETRY_BACKOFFS = [500, 1000, 2000]

export async function writeLstmSnapshots(args: {
  retentionSnapshot: LstmSnapshot
  revenueSnapshot: RevenueSnapshot | null
}): Promise<{ retentionUrl: string; revenueUrl: string | null }> {
  LstmSnapshotSchema.parse(args.retentionSnapshot)
  if (args.revenueSnapshot) RevenueSnapshotSchema.parse(args.revenueSnapshot)

  const retentionUrl = await putWithRetry(
    RETENTION_PATH,
    JSON.stringify(args.retentionSnapshot),
  )

  let revenueUrl: string | null = null
  if (args.revenueSnapshot) {
    revenueUrl = await putWithRetry(
      REVENUE_PATH,
      JSON.stringify(args.revenueSnapshot),
    )
  }

  return { retentionUrl, revenueUrl }
}

async function putWithRetry(path: string, body: string): Promise<string> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= RETRY_BACKOFFS.length; attempt++) {
    try {
      const result = await put(path, body, {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      })
      return result.url
    } catch (err) {
      lastErr = err
      if (attempt < RETRY_BACKOFFS.length) {
        await new Promise((r) => setTimeout(r, RETRY_BACKOFFS[attempt]!))
      }
    }
  }
  throw lastErr
}
