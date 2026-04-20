import { Command } from "commander";
import { runLogin } from "./auth/login.js";
import { isStorageStateValid } from "./auth/session.js";
import { env } from "./config/env.js";
import { log } from "./lib/logger.js";

const program = new Command();

program
  .name("compass-crawler")
  .description("Project Compass — Sensor Tower 크롤러 (Merge × JP × Top 20)")
  .version("0.1.0");

program
  .option("--login", "헤드 브라우저로 ST에 직접 로그인하고 세션 저장")
  .option("--dry-run", "수집한 결과를 stdout에만 출력 (파일 저장 안 함)")
  .option("--limit <n>", "처리할 게임 수 제한 (디버깅용)", parseInt)
  .action(async (opts: { login?: boolean; dryRun?: boolean; limit?: number }) => {
    if (opts.login) {
      await runLogin();
      return;
    }

    const validity = isStorageStateValid(env.ST_STORAGE_STATE, env.ST_STORAGE_TTL_DAYS);
    if (!validity.valid) {
      log.error(`세션이 유효하지 않습니다 (이유: ${validity.reason}).`);
      log.error("재로그인이 필요합니다: npm run crawl:st:login");
      process.exit(1);
    }
    log.info("세션 유효 — 크롤 시작 (Phase 2부터 구현 예정)");
  });

program.parse();
