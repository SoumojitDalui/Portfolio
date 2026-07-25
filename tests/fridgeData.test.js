import assert from "node:assert/strict";
import test from "node:test";

import { fridgePortfolio } from "../assets/js/fridgeData.js";

test("fridge portfolio keeps the tree and maps resume content into storage zones", () => {
  assert.equal(fridgePortfolio.profile.tree, "./tree.html");
  assert.ok(fridgePortfolio.experience.length >= 3);
  assert.ok(fridgePortfolio.academics.length >= 3);
  assert.equal(fridgePortfolio.shelves.length, 4);
  assert.ok(fridgePortfolio.shelves.every((shelf) => shelf.projects.length >= 2));
});

test("project containers have unique labels and repository links", () => {
  const projects = fridgePortfolio.shelves.flatMap((shelf) => shelf.projects);
  assert.equal(new Set(projects.map((project) => project.label)).size, projects.length);
  assert.ok(projects.every((project) => project.url.startsWith("https://github.com/")));
});
