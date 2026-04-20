import { chromium, type Response } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { isStorageStateValid } from "./auth/session.js";
import { env } from "./config/env.js";
import { log } from "./lib/logger.js";
import { sleep } from "./lib/humanlike-delay.js";

interface CapturedXhr {
  url: string;
  method: string;
  status: number;
  requestHeaders: Record<string, string>;
  responseBodySize: number;
  responseBodyParsed: unknown | null;
  responseBodyPreview: string | null;
  parseError: string | null;
  timestamp: string;
}

async function main(): Promise<void> {
  const targetUrl = process.argv[2];
  if (!targetUrl) {
    log.error("사용법: npm run crawl:st:discover -- \"<Sensor Tower URL>\"");
    process.exit(1);
  }

  const validity = isStorageStateValid(env.ST_STORAGE_STATE, env.ST_STORAGE_TTL_DAYS);
  if (!validity.valid) {
    log.error(`세션 무효 (${validity.reason}). 재로그인: npm run crawl:st:login`);
    process.exit(1);
  }

  log.info(`Discovery 대상: ${targetUrl}`);
  log.info("Playwright 실행 중 — 브라우저가 뜨고 자동으로 페이지를 방문합니다. 창을 닫지 마세요.");

  const browser = await chromium.launch({ headless: env.ST_HEADLESS });
  const context = await browser.newContext({ storageState: env.ST_STORAGE_STATE });
  const page = await context.newPage();

  const captured: CapturedXhr[] = [];

  page.on("response", async (resp: Response) => {
    const url = resp.url();
    if (!url.includes("sensortower.com")) return;

    const captureItem: CapturedXhr = {
      url,
      method: resp.request().method(),
      status: resp.status(),
      requestHeaders: {},
      responseBodySize: 0,
      responseBodyParsed: null,
      responseBodyPreview: null,
      parseError: null,
      timestamp: new Date().toISOString(),
    };

    const reqHeaders = await resp.request().allHeaders();
    for (const [k, v] of Object.entries(reqHeaders)) {
      if (k.toLowerCase() === "cookie" || k.toLowerCase() === "authorization") continue;
      captureItem.requestHeaders[k] = v;
    }

    try {
      const body = await resp.body();
      captureItem.responseBodySize = body.length;
      const text = body.toString("utf8");
      captureItem.responseBodyPreview = text.slice(0, 500);
      try {
        captureItem.responseBodyParsed = JSON.parse(text);
      } catch {
        captureItem.parseError = "not JSON";
      }
    } catch (e) {
      captureItem.parseError = (e as Error).message;
    }

    captured.push(captureItem);
  });

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 });

  log.info("페이지 로드 완료. 지연 로딩 대비 5초 더 대기 후 스크롤 시뮬레이션...");
  await sleep(2000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (globalThis as any).scrollBy(0, 600));
  await sleep(1500);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.evaluate(() => (globalThis as any).scrollBy(0, 600));
  await sleep(1500);

  await browser.close();

  const fixturesDir = resolve("fixtures");
  if (!existsSync(fixturesDir)) mkdirSync(fixturesDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = join(fixturesDir, `discovery-${ts}.json`);
  writeFileSync(outPath, JSON.stringify({ targetUrl, capturedAt: new Date().toISOString(), count: captured.length, captured }, null, 2));

  const sortedBySize = [...captured].sort((a, b) => b.responseBodySize - a.responseBodySize);
  log.info(`\n=== Discovery 결과 (${captured.length} XHR 캡처) ===`);
  log.info(`저장 경로: ${outPath}\n`);
  log.info("Top 10 by response size:");
  for (const [i, c] of sortedBySize.slice(0, 10).entries()) {
    const shortUrl = c.url.length > 120 ? c.url.slice(0, 117) + "..." : c.url;
    log.info(`  ${i + 1}. [${c.status}] ${(c.responseBodySize / 1024).toFixed(1)}KB  ${shortUrl}`);
  }
}

main().catch((e) => {
  log.error(`Discovery 실패: ${(e as Error).message}`);
  process.exit(1);
});
