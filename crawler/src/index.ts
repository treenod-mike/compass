import { Command } from "commander";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { runLogin } from "./auth/login.js";
import { isStorageStateValid } from "./auth/session.js";
import { acquireLock, releaseLock } from "./lib/lockfile.js";
import { fetchMarketSnapshot } from "./fetchers/market-snapshot.js";
import { fetchRetentionSnapshot } from "./fetchers/retention-snapshot.js";
import { extractGameIdSet, joinSnapshot, detectPocomerge } from "./transformers/join-snapshot.js";
import { computeGenrePrior, computeNonNullCount } from "./transformers/to-prior.js";
import { writeSnapshotAtomic, writeLastUpdated } from "./storage/snapshot-writer.js";
import { SnapshotSchema } from "./schemas/snapshot.js";
import { env } from "./config/env.js";
import { targets } from "./config/targets.js";
import { log } from "./lib/logger.js";

const LOCK_PATH = "./.crawler.lock";
const CRAWLER_VERSION = "0.2.0";
const SNAPSHOT_NAME = `${targets.genre.toLowerCase()}-${targets.region.toLowerCase()}-snapshot.json`;

async function runCrawl(opts: { dryRun?: boolean; limit?: number }): Promise<void> {
  const validity = isStorageStateValid(env.ST_STORAGE_STATE, env.ST_STORAGE_TTL_DAYS);
  if (!validity.valid) {
    log.error(`세션 무효 (${validity.reason}). 재로그인: npm run crawl:st:login`);
    process.exit(1);
  }
  if (!acquireLock(LOCK_PATH)) {
    log.error("다른 크롤 인스턴스 실행 중. 종료 후 재시도, 또는 .crawler.lock 수동 삭제.");
    process.exit(1);
  }

  const topN = opts.limit ?? targets.topN;
  if (topN > targets.maxGamesPerRun) {
    releaseLock(LOCK_PATH);
    throw new Error(`topN(${topN}) > 안전 한도(${targets.maxGamesPerRun})`);
  }

  const warnings: string[] = [];
  const browser = await chromium.launch({ headless: env.ST_HEADLESS });
  const context = await browser.newContext({ storageState: env.ST_STORAGE_STATE });

  try {
    log.info(`수집 시작: ${targets.genre} × ${targets.region} × Top ${topN}`);

    const market = await fetchMarketSnapshot(context, targets.marketAnalysisUrl);
    const gameIds = extractGameIdSet(market, topN);
    if (gameIds.length === 0) throw new Error("Market Analysis 응답에 게임이 0개");
    log.info(`Market Analysis 완료 — ${gameIds.length}개 게임 ID 추출`);

    const retention = await fetchRetentionSnapshot(context, gameIds);
    log.info("Retention 완료");

    const { topGames, warnings: joinWarnings } = joinSnapshot(market, retention, topN);
    warnings.push(...joinWarnings);
    if (topGames.length === 0) throw new Error("JOIN 후 TopGame이 0개");

    const pocoDetect = detectPocomerge(topGames);
    if (pocoDetect.found) {
      log.info(`포코머지 탐지됨: ${pocoDetect.matches.map((g) => `${g.name} (rank ${g.rank})`).join(", ")}`);
    } else {
      const msg = "포코머지가 Top 목록에 없음 — prior 전용 스냅샷";
      log.warn(msg);
      warnings.push(msg);
    }

    const genrePrior = computeGenrePrior(topGames);

    const snapshot = {
      $schemaVersion: 1 as const,
      metadata: {
        fetchedAt: new Date().toISOString(),
        fetchedBy: "crawler@local",
        genre: targets.genre,
        region: targets.region,
        topN: topGames.length,
        tier: targets.chart,
        crawlerVersion: CRAWLER_VERSION,
        warnings,
        nonNullCount: computeNonNullCount(topGames),
      },
      topGames,
      genrePrior,
    };

    SnapshotSchema.parse(snapshot);

    if (opts.dryRun) {
      console.log(JSON.stringify(snapshot, null, 2));
      log.info("[DRY RUN] 파일 저장 생략");
    } else {
      const outDir = resolve(env.ST_DATA_OUT);
      writeSnapshotAtomic(outDir, SNAPSHOT_NAME, snapshot);
      writeLastUpdated(outDir, SNAPSHOT_NAME);
      log.info(`스냅샷 저장 완료: ${outDir}/${SNAPSHOT_NAME}`);
    }
  } finally {
    await context.close();
    await browser.close();
    releaseLock(LOCK_PATH);
  }
}

const program = new Command();
program
  .name("compass-crawler")
  .description("Project Compass — Sensor Tower 크롤러 (Merge × JP × Top N)")
  .version(CRAWLER_VERSION);

program
  .option("--login", "헤드 브라우저로 ST에 직접 로그인하고 세션 저장")
  .option("--dry-run", "수집 결과를 stdout에만 출력 (파일 저장 안 함)")
  .option("--limit <n>", "처리할 게임 수 제한 (디버깅용)", parseInt)
  .action(async (opts: { login?: boolean; dryRun?: boolean; limit?: number }) => {
    if (opts.login) {
      await runLogin();
      return;
    }
    await runCrawl(opts);
  });

program.parse();
