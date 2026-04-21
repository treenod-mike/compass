import { z } from "zod"

/* ─────────── 호출 파라미터 ─────────── */

export const MasterParamsSchema = z.object({
  appId: z.string().min(1),
  reportType: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  groupings: z.array(z.string()),
  kpis: z.array(z.string()),
  extraQuery: z.record(z.string(), z.string()).optional(),
})
export type MasterParams = z.infer<typeof MasterParamsSchema>

export const CohortParamsSchema = z.object({
  appId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cohortType: z.enum(["user_acquisition", "retargeting", "unified"]),
  aggregationType: z.enum(["cumulative", "on_day"]).optional(),
  granularity: z.enum(["hour", "day"]).optional(),
  minCohortSize: z.number().int().min(1).optional(),
  groupings: z.array(z.string()),
  kpis: z.array(z.string()),
  perUser: z.boolean().optional(),
})
export type CohortParams = z.infer<typeof CohortParamsSchema>

/* ─────────── 응답 Row (느슨) ─────────── */

export const MasterRowSchema = z.record(z.string(), z.union([z.string(), z.number()]))
export type MasterRow = z.infer<typeof MasterRowSchema>

export const CohortRowSchema = z.record(z.string(), z.union([z.string(), z.number()]))
export type CohortRow = z.infer<typeof CohortRowSchema>

/* ─────────── 스냅샷 ─────────── */

export const SnapshotSchema = z.object({
  version: z.literal(1),
  fetchedAt: z.string().datetime(),
  request: z.object({
    master: MasterParamsSchema.nullable(),
    cohort: CohortParamsSchema.nullable(),
  }),
  master: z.object({ rows: z.array(MasterRowSchema) }).nullable(),
  cohort: z.object({ rows: z.array(CohortRowSchema) }).nullable(),
  meta: z.object({ warnings: z.array(z.string()) }),
})
export type AppsFlyerSnapshot = z.infer<typeof SnapshotSchema>

/* ─────────── API Route 요청 body ─────────── */

export const SyncRequestSchema = z.object({
  dev_token: z.string().min(1),
  home_currency: z.enum(["KRW", "USD", "JPY", "EUR"]),
  app_ids: z.string().min(1),
  sync_frequency: z.string(),
  dry_run: z.boolean().optional(),
})
export type SyncRequest = z.infer<typeof SyncRequestSchema>

export type HomeCurrency = z.infer<typeof SyncRequestSchema>["home_currency"]

/* ─────────── runAppsFlyerSync 인자/반환 ─────────── */

export type RunSyncOptions = {
  devToken: string
  appIds: string[]
  homeCurrency: HomeCurrency
  master: MasterParams | null
  cohort: CohortParams | null
}

export type RunSyncResult = {
  snapshot: AppsFlyerSnapshot
  warnings: string[]
  summary: {
    masterRows: number
    cohortRows: number
    durationMs: number
  }
}

/* ─────────── UI 카드 파생 ─────────── */

export type ConnectionStatusLive =
  | "connected" | "warn" | "error" | "disconnected"

export type AppsFlyerCardData = {
  status: ConnectionStatusLive
  lastSync: string
  metrics: Array<{ label: string; value: string }>
  retentionDepth: string | null
}

export const EMPTY_CARD: AppsFlyerCardData = {
  status: "disconnected",
  lastSync: "아직 sync 없음",
  metrics: [],
  retentionDepth: null,
}
