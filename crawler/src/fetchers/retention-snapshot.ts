import type { BrowserContext } from "playwright";
import { captureFirstMatchingResponse } from "../lib/xhr-intercept.js";
import { sleep, randomDelayMs } from "../lib/humanlike-delay.js";
import { env } from "../config/env.js";
import { log } from "../lib/logger.js";

export interface GameIdSet {
  unifiedAppId: string;
  iosAppId: string | null;
  androidPackageId: string | null;
}

export interface RawRetentionSnapshot {
  retentionPayload: any;  // /api/v2/apps/facets?query_identifier=app_analysis_retention_table
  capturedAt: string;
}

function buildRetentionUrl(games: GameIdSet[]): string {
  const base = new URL("https://app.sensortower.com/app-analysis/retention");
  base.searchParams.set("os", "unified");
  base.searchParams.set("granularity", "daily");
  base.searchParams.set("breakdown_attribute", "unifiedAppId");
  base.searchParams.set("retention_measure", "retentionD1");
  base.searchParams.set("country", "JP");
  base.searchParams.set("category", "6014");
  base.searchParams.append("device", "iphone");
  base.searchParams.append("device", "ipad");
  base.searchParams.append("device", "android");

  // last 30 days window
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  base.searchParams.set("start_date", start.toISOString().slice(0, 10));
  base.searchParams.set("end_date", end.toISOString().slice(0, 10));

  for (const g of games) {
    base.searchParams.append("uai", g.unifiedAppId);
    if (g.iosAppId) base.searchParams.append("sia", g.iosAppId);
    if (g.androidPackageId) base.searchParams.append("saa", g.androidPackageId);
  }
  return base.toString();
}

export async function fetchRetentionSnapshot(
  context: BrowserContext,
  games: GameIdSet[],
): Promise<RawRetentionSnapshot> {
  const url = buildRetentionUrl(games);
  const page = await context.newPage();
  log.info(`App Analysis/Retention 페이지 진입 (${games.length}개 게임)`);

  const retentionPromise = captureFirstMatchingResponse(page, /\/api\/v2\/apps\/facets\?query_identifier=app_analysis_retention_table/, 60_000);
  await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });

  if (env.ST_PAGE_SCROLL_SIM) {
    await sleep(1500);
    await page.evaluate(() => (globalThis as any).scrollBy(0, 600));
    await sleep(1500);
  }

  const retention = await retentionPromise;
  await sleep(randomDelayMs(env.ST_MIN_DELAY_MS, env.ST_MAX_DELAY_MS));
  await page.close();

  return { retentionPayload: retention, capturedAt: new Date().toISOString() };
}
