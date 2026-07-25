import assert from "node:assert/strict";
import test from "node:test";

import { getTimePalette, resolveTimeOfDay } from "../assets/js/timeOfDay.js";

test("resolves the current time from an IANA timezone in the URL", () => {
  const result = resolveTimeOfDay("?tz=America/New_York", new Date("2026-01-15T17:30:00Z"));
  assert.equal(result.timeZone, "America/New_York");
  assert.equal(result.hour, 12.5);
});

test("interpolates a distinct midday and midnight palette", () => {
  const noon = getTimePalette(12);
  const midnight = getTimePalette(0);
  assert.notEqual(noon.skyTop, midnight.skyTop);
  assert.ok(noon.sunIntensity > midnight.sunIntensity);
});
