import { env } from "./env.js";

export const targets = {
  genre: env.ST_TARGET_GENRE,
  region: env.ST_TARGET_REGION,
  chart: env.ST_TARGET_CHART,
  topN: env.ST_TARGET_TOP_N,
  maxGamesPerRun: env.ST_MAX_GAMES_PER_RUN,
} as const;

export type Targets = typeof targets;
