import assert from "node:assert/strict";
import test from "node:test";

import { groundingOffset, normalizedModelScale } from "../assets/js/foodPlacement.js";

test("grounds a model's lowest point directly above a shelf", () => {
  const shelfTop = 0.68;
  const modelMinY = -0.21;
  const offset = groundingOffset(shelfTop, modelMinY);
  assert.equal(Number((modelMinY + offset).toFixed(3)), 0.692);
});

test("normalizes food without exceeding shelf footprint or height", () => {
  const scale = normalizedModelScale({ x: 2, y: 1, z: 1.5 });
  assert.ok(2 * scale <= 0.52);
  assert.ok(1 * scale <= 0.42);
});
