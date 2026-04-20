import type { TopGame } from "../schemas/snapshot.js";
import type { RawMarketSnapshot } from "../fetchers/market-snapshot.js";
import type { RawRetentionSnapshot, GameIdSet } from "../fetchers/retention-snapshot.js";
import { log } from "../lib/logger.js";

interface AppsIdEntry {
  unified_app_id: string;
  sub_app_ids: Array<number | string>;
}

function splitSubAppIds(subIds: Array<number | string>): { ios: string | null; android: string | null } {
  let ios: string | null = null;
  let android: string | null = null;
  for (const s of subIds) {
    if (typeof s === "number") ios = String(s);
    else if (typeof s === "string") android = s;
  }
  return { ios, android };
}

export function extractGameIdSet(raw: RawMarketSnapshot, topN: number): GameIdSet[] {
  const apps = (raw.topAppsPayload?.data?.apps_ids ?? []) as AppsIdEntry[];
  return apps.slice(0, topN).map((a) => {
    const { ios, android } = splitSubAppIds(a.sub_app_ids);
    return { unifiedAppId: a.unified_app_id, iosAppId: ios, androidPackageId: android };
  });
}

export function joinSnapshot(
  market: RawMarketSnapshot,
  retention: RawRetentionSnapshot,
  topN: number,
): { topGames: TopGame[]; warnings: string[] } {
  const warnings: string[] = [];
  const appsIds = (market.topAppsPayload?.data?.apps_ids ?? []) as AppsIdEntry[];
  const entityApps: any[] = market.entitiesPayload?.apps ?? [];
  const entityPublishers: any[] = market.entitiesPayload?.publishers ?? [];
  const facetsArr: any[] = market.facetsPayload?.data ?? [];
  const retentionArr: any[] = retention.retentionPayload?.data ?? [];

  const entityByUai = new Map(entityApps.map((e) => [e.unified_app_id, e]));
  const publisherById = new Map(entityPublishers.map((p) => [p.publisher_id, p]));
  const facetByUai = new Map(facetsArr.map((f) => [f.unifiedAppId, f]));

  // Build retention map: prefer row where appId is non-null (specific platform),
  // else fall back to unified row where appId is null.
  const retentionByUai = new Map<string, any>();
  for (const r of retentionArr) {
    const existing = retentionByUai.get(r.unifiedAppId);
    if (!existing) retentionByUai.set(r.unifiedAppId, r);
    else if (existing.appId == null && r.appId != null) retentionByUai.set(r.unifiedAppId, r);
  }

  const topGames: TopGame[] = [];
  const limit = Math.min(appsIds.length, topN);
  for (let i = 0; i < limit; i++) {
    const entry = appsIds[i]!;
    const uai = entry.unified_app_id;
    const entity = entityByUai.get(uai);
    const facet = facetByUai.get(uai);
    const ret = retentionByUai.get(uai);
    const { ios, android } = splitSubAppIds(entry.sub_app_ids);

    if (!entity) warnings.push(`entity missing for ${uai}`);
    if (!facet) warnings.push(`facet missing for ${uai}`);
    if (!ret) warnings.push(`retention missing for ${uai}`);

    const name = entity?.name ?? entity?.app_name ?? `(unknown ${uai})`;
    const publisherId = entity?.publisher_id;
    const publisher = publisherId ? (publisherById.get(publisherId)?.name ?? "(unknown publisher)") : "(unknown publisher)";

    topGames.push({
      rank: i + 1,
      name,
      publisher,
      appIds: { ios, android },
      downloads: {
        last90dTotal: facet?.downloadsAbsolute ?? null,
        monthly: [],
      },
      revenue: {
        // NOTE: revenueAbsolute unit is UNKNOWN — possibly JPY cents or USD cents×100.
        // Stored raw here. Calibration required before treating as USD.
        last90dTotalUsd: facet?.revenueAbsolute ?? null,
        monthly: [],
      },
      retention: {
        d1: ret?.est_retention_d1 ?? null,
        d7: ret?.est_retention_d7 ?? null,
        d30: ret?.est_retention_d30 ?? null,
        sampleSize: "ST estimate",
        fetchedAt: retention.capturedAt,
      },
    });
  }

  return { topGames, warnings };
}

// Detect 포코머지 (Pocomerge) presence for observability
export function detectPocomerge(topGames: TopGame[]): { found: boolean; matches: TopGame[] } {
  const needles = ["pocomerge", "포코머지", "pocomer", "poco merge"];
  const matches = topGames.filter((g) => {
    const hay = (g.name + " " + g.publisher).toLowerCase();
    return needles.some((n) => hay.includes(n));
  });
  return { found: matches.length > 0, matches };
}
