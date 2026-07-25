import assert from "node:assert/strict";
import test from "node:test";

import { shouldFocusCameraAfterSelection } from "../assets/js/interactionPolicy.js";

test("pointer selection does not reset the camera", () => {
  assert.equal(shouldFocusCameraAfterSelection("pointer"), false);
  assert.equal(shouldFocusCameraAfterSelection("keyboard"), true);
});
