import { z } from "zod"

/* ─────────── 호출 파라미터 (Pull API v5) ─────────── */

export const InstallsParamsSchema = z.object({
  appId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  additionalFields: z.array(z.string()).optional(),
})
export type InstallsParams = z.infer<typeof InstallsParamsSchema>

/* ─────────── 응답 Row ─────────── */

/** CSV 파싱 직후 로우: 헤더 그대로 키로 사용 (81개 컬럼 원본 보존). */
export type CsvRow = Record<string, string | number | null>

/** 스냅샷에 저장하는 경량 row — 필요한 컬럼만 추출. */
export const CompactInstallSchema = z.object({
  installTime: z.string().nullable(),       // "Install Time"
  partner: z.string().nullable(),           // "Partner"
  mediaSource: z.string().nullable(),       // "Media Source"
  costValue: z.number().nullable(),         // "Cost Value" (광고비, home currency)
  eventRevenueUsd: z.number().nullable(),   // "Event Revenue USD"
  eventName: z.string().nullable(),         // "Event Name"
  countryCode: z.string().nullable(),       // "Country Code"
  platform: z.string().nullable(),          // "Platform"
})
export type CompactInstall = z.infer<typeof CompactInstallSchema>

/**
 * CSV 81컬럼 raw row → 스냅샷 저장용 경량 row 로 투영.
 * 미지정 컬럼은 무시하여 snapshot 용량을 최소화.
 */
export function toCompactInstall(row: CsvRow): CompactInstall {
  const str = (v: unknown): string | null =>
    typeof v === "string" && v !== "" ? v : null
  const num = (v: unknown): number | null =>
    typeof v === "number" ? v : null
  return {
    installTime: str(row["Install Time"]),
    partner: str(row["Partner"]),
    mediaSource: str(row["Media Source"]),
    costValue: num(row["Cost Value"]),
    eventRevenueUsd: num(row["Event Revenue USD"]),
    eventName: str(row["Event Name"]),
    countryCode: str(row["Country Code"]),
    platform: str(row["Platform"]),
  }
}

/* ─────────── 스냅샷 ─────────── */

export const SnapshotSchema = z.object({
  version: z.literal(2),
  fetchedAt: z.string().datetime(),
  request: z.object({
    appId: z.string(),
    from: z.string(),
    to: z.string(),
  }).nullable(),
  installs: z.object({
    nonOrganic: z.array(CompactInstallSchema),
    organic: z.array(CompactInstallSchema),
  }).nullable(),
  meta: z.object({
    warnings: z.array(z.string()),
    source: z.literal("pull-api-v5"),
  }),
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
  installs: InstallsParams | null
  fetchOrganic?: boolean
}

export type RunSyncResult = {
  snapshot: AppsFlyerSnapshot
  warnings: string[]
  summary: {
    nonOrganicCount: number
    organicCount: number
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
