import type { BrowserContext } from "playwright";
import { captureFirstMatchingResponse } from "../lib/xhr-intercept.js";
import { sleep, randomDelayMs } from "../lib/humanlike-delay.js";
import { env } from "../config/env.js";
import { log } from "../lib/logger.js";

export interface RawMarketSnapshot {
  topAppsPayload: any;         // /api/unified/top_apps response
  entitiesPayload: any;        // /api/unified/internal_entities response
  facetsPayload: any;          // /api/v2/apps/facets?query_identifier=top_apps_table response
  capturedAt: string;
}

export async function fetchMarketSnapshot(
  context: BrowserContext,
  marketPageUrl: string,
): Promise<RawMarketSnapshot> {
  const page = await context.newPage();
  log.info(`Market Analysis 페이지 진입`);

  const topAppsPromise = captureFirstMatchingResponse(page, "/api/unified/top_apps", 45_000);
  const entitiesPromise = captureFirstMatchingResponse(page, "/api/unified/internal_entities", 45_000);
  const facetsPromise = captureFirstMatchingResponse(page, /\/api\/v2\/apps\/facets\?query_identifier=top_apps_table/, 45_000);

  await page.goto(marketPageUrl, { waitUntil: "networkidle", timeout: 60_000 });

  if (env.ST_PAGE_SCROLL_SIM) {
    await sleep(1500);
    await page.evaluate(() => (globalThis as any).scrollBy(0, 600));
    await sleep(1500);
  }

  const [topApps, entities, facets] = await Promise.all([topAppsPromise, entitiesPromise, facetsPromise]);

  await sleep(randomDelayMs(env.ST_MIN_DELAY_MS, env.ST_MAX_DELAY_MS));
  await page.close();

  return {
    topAppsPayload: topApps,
    entitiesPayload: entities,
    facetsPayload: facets,
    capturedAt: new Date().toISOString(),
  };
}
