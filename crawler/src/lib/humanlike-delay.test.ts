import { describe, it, expect, vi } from "vitest";
import { randomDelayMs, sleep } from "./humanlike-delay.js";

describe("randomDelayMs", () => {
  it("returns value within [min, max]", () => {
    for (let i = 0; i < 100; i++) {
      const v = randomDelayMs(1500, 4000);
      expect(v).toBeGreaterThanOrEqual(1500);
      expect(v).toBeLessThanOrEqual(4000);
    }
  });

  it("throws when min > max", () => {
    expect(() => randomDelayMs(5000, 1000)).toThrow();
  });
});

describe("sleep", () => {
  it("resolves after approximately the given ms", async () => {
    vi.useFakeTimers();
    const promise = sleep(100);
    vi.advanceTimersByTime(100);
    await promise;
    vi.useRealTimers();
  });
});
