import { chromium } from "playwright";
import { writeFileSync, chmodSync } from "node:fs";
import { env } from "../config/env.js";
import { log } from "../lib/logger.js";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ST_DASHBOARD_URL = "https://app.sensortower.com/";

export async function runLogin(): Promise<void> {
  log.info("Headed Chromium 실행 — Sensor Tower 로그인 페이지로 이동합니다.");
  log.info("브라우저에서 직접 로그인하세요. 2FA가 있다면 완료까지 끝낸 뒤 콘솔로 돌아오세요.");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(ST_DASHBOARD_URL);

  const rl = readline.createInterface({ input: stdin, output: stdout });
  await rl.question("\n로그인이 완료되어 ST 대시보드가 보이면 Enter를 누르세요... ");
  rl.close();

  const state = await context.storageState();
  const stateWithMeta = { ...state, _meta: { savedAt: new Date().toISOString() } };
  writeFileSync(env.ST_STORAGE_STATE, JSON.stringify(stateWithMeta, null, 2));
  try {
    chmodSync(env.ST_STORAGE_STATE, 0o600);
  } catch (e) {
    log.warn(`chmod 600 실패 (무시 가능, OS 따라 다름): ${(e as Error).message}`);
  }

  log.info(`세션 저장 완료: ${env.ST_STORAGE_STATE}`);
  await browser.close();
}
