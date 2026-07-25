import assert from "node:assert/strict";
import test from "node:test";

import {
  assignDomainsToBranches,
  resumeToGrowthProfile
} from "../assets/js/ezTreeAdapter.js";

function vec(x, y, z) {
  return {
    x,
    y,
    z,
    clone() {
      return vec(this.x, this.y, this.z);
    },
    lengthSq() {
      return this.x * this.x + this.y * this.y + this.z * this.z;
    },
    normalize() {
      const length = Math.hypot(this.x, this.y, this.z) || 1;
      this.x /= length;
      this.y /= length;
      this.z /= length;
      return this;
    },
    set(nx, ny, nz) {
      this.x = nx;
      this.y = ny;
      this.z = nz;
      return this;
    },
    addScaledVector() {
      return this;
    },
    distanceToSquared(other) {
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const dz = this.z - other.z;
      return dx * dx + dy * dy + dz * dz;
    }
  };
}

test("maps resume domains and projects to a controlled branch hierarchy", () => {
  const profile = resumeToGrowthProfile({
    branches: Array.from({ length: 7 }, (_, index) => ({ id: `branch-${index}`, weight: 0.7 })),
    fruits: Array.from({ length: 13 }, (_, index) => ({
      id: `project-${index}`,
      branch: `branch-${index % 7}`
    })),
    trunk: { years: 4 }
  });

  assert.equal(profile.branch.levels, 2);
  assert.equal(profile.branch.children[0], 7);
  assert.equal(profile.domainCount, 7);
  assert.equal(profile.branch.children[1], 2);
  assert.equal(profile.branch.force.strength, 0.004);
  assert.ok(profile.branch.length[1] > profile.branch.length[2]);
  assert.ok(profile.leaves.count >= 16 && profile.leaves.count <= 28);
});

test("assigns each resume domain to a distinct lateral level-1 branch", () => {
  const domains = [
    { id: "a", label: "A", weight: 0.9 },
    { id: "b", label: "B", weight: 0.8 },
    { id: "c", label: "C", weight: 0.7 }
  ];

  const mkBranch = (id, level, origin, tipPoint, parentId = null) => ({
    id,
    level,
    parentId,
    origin: vec(...origin),
    tip: vec(...tipPoint),
    sections: [
      { origin: vec(...origin), orientation: { clone() { return this; } }, radius: 0.4 },
      { origin: vec(...tipPoint), orientation: { clone() { return this; } }, radius: 0.2 }
    ],
    childStarts: []
  });

  const skeleton = [
    mkBranch(0, 0, [0, 0, 0], [0, 10, 0]),
    mkBranch(1, 1, [0, 8, 0], [0, 16, 0], 0),
    mkBranch(2, 1, [0, 5, 0], [4, 8, 1], 0),
    mkBranch(3, 1, [0, 5, 0], [-3, 7, 3], 0),
    mkBranch(4, 1, [0, 5, 0], [1, 7, -4], 0),
    mkBranch(5, 2, [4, 8, 1], [5, 9, 2], 2)
  ];

  const bindings = assignDomainsToBranches(skeleton, domains);
  assert.equal(bindings.length, 3);
  assert.deepEqual(bindings.map((binding) => binding.domain.id), ["a", "b", "c"]);
  assert.equal(new Set(bindings.map((binding) => binding.branch.id)).size, 3);
  assert.ok(bindings.every((binding) => binding.branch.id !== 1));
  assert.ok(bindings.find((binding) => binding.branch.id === 2).children.some((child) => child.id === 5));
  assert.ok(bindings.every((binding) => binding.fruitSites.length > 0));
});
