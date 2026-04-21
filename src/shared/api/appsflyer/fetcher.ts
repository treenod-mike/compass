import { afHttp } from "./client"
import { ValidationError } from "./errors"
import {
  CohortRowSchema,
  MasterRowSchema,
  type CohortParams,
  type CohortRow,
  type MasterParams,
  type MasterRow,
} from "./types"
import { z } from "zod"

const MASTER_BASE = "https://hq1.appsflyer.com/api/master-agg-data/v4/app"
const COHORT_BASE = "https://hq1.appsflyer.com/api/cohorts/v1/data/app"

const MasterResponseSchema = z.object({ data: z.array(z.record(z.string(), z.any())) })
const CohortResponseSchema = z.object({ data: z.array(z.record(z.string(), z.any())) })

export function parseMasterRows(raw: unknown): MasterRow[] {
  const parsed = MasterResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError("master.response", parsed.error.message)
  }
  return parsed.data.data.map((row) => {
    const r = MasterRowSchema.safeParse(row)
    if (!r.success) throw new ValidationError("master.row", r.error.message)
    return r.data
  })
}

export function parseCohortRows(raw: unknown): CohortRow[] {
  const parsed = CohortResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError("cohort.response", parsed.error.message)
  }
  return parsed.data.data.map((row) => {
    const r = CohortRowSchema.safeParse(row)
    if (!r.success) throw new ValidationError("cohort.row", r.error.message)
    return r.data
  })
}

export async function fetchMasterAggregate(
  devToken: string,
  params: MasterParams,
): Promise<MasterRow[]> {
  const url = `${MASTER_BASE}/${encodeURIComponent(params.appId)}/${encodeURIComponent(params.reportType)}`
  const query: Record<string, string> = {
    from: params.from,
    to: params.to,
    groupings: params.groupings.join(","),
    kpis: params.kpis.join(","),
    format: "json",
    ...(params.extraQuery ?? {}),
  }
  const raw = await afHttp({ url, method: "GET", token: devToken, query })
  return parseMasterRows(raw)
}

export async function fetchCohortRetention(
  devToken: string,
  params: CohortParams,
): Promise<CohortRow[]> {
  const url = `${COHORT_BASE}/${encodeURIComponent(params.appId)}`
  const body: Record<string, unknown> = {
    cohort_type: params.cohortType,
    from: params.from,
    to: params.to,
    aggregation_type: params.aggregationType ?? "on_day",
    groupings: params.groupings,
    kpis: params.kpis,
    per_user: params.perUser ?? false,
  }
  if (params.granularity) body.granularity = params.granularity
  if (params.minCohortSize) body.min_cohort_size = params.minCohortSize
  const raw = await afHttp({ url, method: "POST", token: devToken, body })
  return parseCohortRows(raw)
}
