import { describe, it, expect } from "vitest";
import { matchesUrlPattern } from "./xhr-intercept.js";

describe("matchesUrlPattern", () => {
  it("matches simple substring", () => {
    expect(matchesUrlPattern("https://app.sensortower.com/api/top_charts/x", "/api/top_charts/")).toBe(true);
  });

  it("matches RegExp", () => {
    expect(matchesUrlPattern("https://app.sensortower.com/api/games/123/downloads", /\/api\/games\/\d+\/downloads/)).toBe(true);
  });

  it("does not match non-matching", () => {
    expect(matchesUrlPattern("https://example.com/foo", "/api/")).toBe(false);
  });
});
