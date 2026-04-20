import { describe, it, expect } from "vitest";
import { SnapshotSchema } from "./snapshot.js";

describe("SnapshotSchema", () => {
  it("validates a minimal valid snapshot", () => {
    const minimal = {
      $schemaVersion: 1,
      metadata: {
        fetchedAt: "2026-04-20T11:36:00+09:00",
        fetchedBy: "crawler@local",
        genre: "Merge", region: "JP", topN: 1, tier: "iphone-grossing",
        crawlerVersion: "0.1.0", warnings: [],
      },
      topGames: [{
        rank: 1, name: "Royal Match", publisher: "Dream Games",
        appIds: { ios: "1632298254", android: null },
        downloads: { last90dTotal: 4500000, monthly: [{ month: "2026-01", value: 1800000 }] },
        revenue: { last90dTotalUsd: 28400000, monthly: [{ month: "2026-01", value: 9500000 }] },
        retention: { d1: 0.42, d7: 0.18, d30: 0.08, sampleSize: "ST estimate", fetchedAt: "2026-04-20T11:36:00+09:00" },
      }],
      genrePrior: {
        retention: {
          d1: { p10: 0.28, p50: 0.38, p90: 0.50 },
          d7: { p10: 0.10, p50: 0.16, p90: 0.24 },
          d30: { p10: 0.04, p50: 0.07, p90: 0.12 },
        },
        monthlyRevenueUsd: { p10: 200000, p50: 1500000, p90: 12000000 },
        monthlyDownloads: { p10: 50000, p50: 350000, p90: 2500000 },
      },
    };
    expect(() => SnapshotSchema.parse(minimal)).not.toThrow();
  });

  it("rejects wrong $schemaVersion", () => {
    expect(() => SnapshotSchema.parse({ $schemaVersion: 2 })).toThrow();
  });
});
