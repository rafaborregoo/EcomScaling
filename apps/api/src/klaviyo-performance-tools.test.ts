import assert from "node:assert/strict";
import test from "node:test";
import { parseKlaviyoPerformanceWindow } from "./klaviyo-performance-tools.js";

test("A12 windows accept at most 90 inclusive calendar days and derive an equal prior window", () => {
  assert.deepEqual(
    parseKlaviyoPerformanceWindow("2026-01-01", "2026-03-31"),
    {
      start: "2026-01-01",
      end: "2026-03-31",
      previousStart: "2025-10-03",
      previousEnd: "2025-12-31",
    },
  );
  assert.equal(parseKlaviyoPerformanceWindow("2026-01-01", "2026-04-01"), null);
});

test("A12 rejects invalid, reversed, and non-date inputs", () => {
  assert.equal(parseKlaviyoPerformanceWindow("2026-02-30", "2026-03-01"), null);
  assert.equal(parseKlaviyoPerformanceWindow("2026-03-02", "2026-03-01"), null);
  assert.equal(parseKlaviyoPerformanceWindow("2026-03-01T00:00:00Z", "2026-03-02"), null);
  assert.equal(parseKlaviyoPerformanceWindow(null, "2026-03-02"), null);
});
