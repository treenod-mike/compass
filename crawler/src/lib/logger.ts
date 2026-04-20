import { env } from "../config/env.js";

type Level = "info" | "debug" | "warn" | "error";

const LEVEL_RANK: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

function shouldLog(level: Level): boolean {
  if (env.ST_LOG_LEVEL === "silent") return level === "error" || level === "warn";
  if (env.ST_LOG_LEVEL === "info") return LEVEL_RANK[level] <= LEVEL_RANK.info;
  return true;
}

function fmt(level: Level, msg: string): string {
  const ts = new Date().toISOString();
  return `[${ts}] [${level.toUpperCase()}] ${msg}`;
}

export const log = {
  info: (msg: string) => shouldLog("info") && console.log(fmt("info", msg)),
  debug: (msg: string) => shouldLog("debug") && console.log(fmt("debug", msg)),
  warn: (msg: string) => shouldLog("warn") && console.warn(fmt("warn", msg)),
  error: (msg: string) => shouldLog("error") && console.error(fmt("error", msg)),
};
