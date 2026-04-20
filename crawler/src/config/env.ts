import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  ST_DATA_OUT: z.string().default("../src/shared/api/data/sensor-tower"),
  ST_HEADLESS: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  ST_USER_DATA_DIR: z.string().default("./.playwright"),
  ST_STORAGE_STATE: z.string().default("./storageState.json"),
  ST_STORAGE_TTL_DAYS: z.coerce.number().int().positive().default(30),
  ST_MIN_DELAY_MS: z.coerce.number().int().nonnegative().default(1500),
  ST_MAX_DELAY_MS: z.coerce.number().int().nonnegative().default(4000),
  ST_PAGE_SCROLL_SIM: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  ST_MAX_GAMES_PER_RUN: z.coerce.number().int().positive().default(25),
  ST_TARGET_GENRE: z.string().default("Merge"),
  ST_TARGET_REGION: z.string().default("JP"),
  ST_TARGET_CHART: z.string().default("iphone-grossing"),
  ST_TARGET_TOP_N: z.coerce.number().int().positive().default(20),
  ST_MARKET_ANALYSIS_URL: z.string().url().default("https://app.sensortower.com/market-analysis/top-apps?metric=downloads&os=unified&custom_fields_filter_id=67241da4a340ea2c2bda3b7f&uai=62997510bafac62d04f854a3&saa=com.mergegames.gossipharbor&saa=com.mergegames.cookie&sia=1623318294&sia=6472696051&edit=1&granularity=weekly&start_date=2026-03-20&end_date=2026-04-18&duration=P30D&measure=DAU&comparison_attribute=absolute&comparison_period=pop&category=0&device=iphone&device=ipad&device=android&page=1&page_size=25&custom_fields_filter_mode=include_unified_apps&period=day&country=JP"),
  ST_DEBUG_SCREENSHOTS: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  ST_LOG_LEVEL: z.enum(["silent", "info", "debug"]).default("info"),
});

export const env = EnvSchema.parse(process.env);
export type Env = typeof env;
