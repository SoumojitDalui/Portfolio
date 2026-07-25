import assert from "node:assert/strict";
import test from "node:test";

import { shouldUseEzTree } from "../assets/js/sceneConfig.js";

test("uses EZ Tree unless the legacy generator is explicitly requested", () => {
  assert.equal(shouldUseEzTree(""), true);
  assert.equal(shouldUseEzTree("?reload=tree-visuals"), true);
  assert.equal(shouldUseEzTree("?skeleton=ez"), true);
  assert.equal(shouldUseEzTree("?skeleton=legacy"), false);
});
