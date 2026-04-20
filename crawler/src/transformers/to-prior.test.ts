import { describe, it, expect } from "vitest";
import { percentile, computeGenrePrior } from "./to-prior.js";
import type { TopGame } from "../schemas/snapshot.js";

describe("percentile", () => {
  it("returns p50 of [1..10] as 5.5", () => {
    expect(percentile([1,2,3,4,5,6,7,8,9,10], 0.5)).toBe(5.5);
  });

  it("returns p10/p50/p90 of [1..100]", () => {
    const arr = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(arr, 0.1)).toBeCloseTo(10.9, 1);
    expect(percentile(arr, 0.5)).toBeCloseTo(50.5, 1);
    expect(percentile(arr, 0.9)).toBeCloseTo(90.1, 1);
  });

  it("ignores null/NaN values", () => {
    expect(percentile([1, null as any, 2, NaN, 3], 0.5)).toBe(2);
  });

  it("throws on empty array after filtering", () => {
    expect(() => percentile([null as any, NaN], 0.5)).toThrow();
  });
});

describe("computeGenrePrior", () => {
  function fakeGame(d1: number, monthlyRev: number, monthlyDl: number): TopGame {
    return {
      rank: 1, name: "x", publisher: "y",
      appIds: { ios: "1", android: null },
      downloads: { last90dTotal: monthlyDl * 3, monthly: [{ month: "2026-01", value: monthlyDl }] },
      revenue: { last90dTotalUsd: monthlyRev * 3, monthly: [{ month: "2026-01", value: monthlyRev }] },
      retention: { d1, d7: d1 / 2, d30: d1 / 4, sampleSize: "ST", fetchedAt: "2026-01-01" },
    };
  }

  it("computes p10/p50/p90 across games", () => {
    const games = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map((d1) =>
      fakeGame(d1, d1 * 1_000_000, d1 * 100_000),
    );
    const prior = computeGenrePrior(games);
    expect(prior.retention.d1.p50).toBeCloseTo(0.55, 2);
    expect(prior.retention.d1.p10).toBeCloseTo(0.19, 1);
    expect(prior.retention.d1.p90).toBeCloseTo(0.91, 1);
  });
});
