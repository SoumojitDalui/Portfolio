function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function averageWeight(items) {
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => sum + item.weight, 0) / items.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function resumeToEzTreeOptions(data) {
  const branchCount = data.branches.length;
  const skillCount = data.skillClusters.reduce((sum, cluster) => sum + cluster.skills.length, 0);
  const projectCount = data.fruits.length;
  const productionWeight = data.trunk.productionWeight || 0.5;
  const branchWeight = averageWeight(data.branches);
  const skillWeight = averageWeight(data.skillClusters);
  const parity = 1 - Math.abs(branchCount - data.skillClusters.length) / Math.max(branchCount, data.skillClusters.length, 1);
  const ageScale = clamp((data.trunk.years || 1) / 6, 0.35, 1);
  const compactScale = 1 - parity * 0.16;

  return {
    seed: hashString(data.seed),
    type: "deciduous",
    bark: {
      type: "oak",
      tint: 0xc98755,
      flatShading: true,
      textured: false,
      textureScale: { x: 0.7, y: 4 }
    },
    branch: {
      levels: 3,
      angle: {
        1: 42 + branchWeight * 18,
        2: 52 + skillWeight * 14,
        3: 40
      },
      children: {
        0: clamp(Math.round(branchCount * 0.85), 4, 8),
        1: clamp(Math.round(skillCount / Math.max(branchCount, 1)), 2, 5),
        2: clamp(Math.round(projectCount / 3), 2, 4)
      },
      force: {
        direction: { x: 0, y: 1, z: 0 },
        strength: -0.012 - productionWeight * 0.012
      },
      gnarliness: {
        0: 0.05 + branchWeight * 0.04,
        1: 0.08 + projectCount * 0.008,
        2: 0.12,
        3: 0.05
      },
      length: {
        0: 3.2 + ageScale * 2.1,
        1: (1.65 + branchWeight * 1.25) * compactScale,
        2: (0.82 + skillWeight * 0.72) * compactScale,
        3: 0.45
      },
      radius: {
        0: 0.34 + productionWeight * 0.13,
        1: 0.14 + branchWeight * 0.09,
        2: 0.07 + skillWeight * 0.05,
        3: 0.035
      },
      sections: {
        0: 10,
        1: 8,
        2: 6,
        3: 4
      },
      segments: {
        0: 8,
        1: 6,
        2: 5,
        3: 4
      },
      start: {
        1: 0.42,
        2: 0.34,
        3: 0.22
      },
      taper: {
        0: 0.26,
        1: 0.58,
        2: 0.66,
        3: 0.78
      },
      twist: {
        0: 0.06,
        1: -0.08,
        2: 0.1,
        3: 0
      }
    },
    leaves: {
      type: "ash",
      billboard: "double",
      angle: 36,
      count: clamp(Math.round(skillCount * 0.55), 10, 26),
      start: 0.2,
      size: 0.32 + skillWeight * 0.2,
      sizeVariance: 0.42,
      tint: 0xb8e879,
      alphaTest: 0.5
    },
    trellis: {
      enabled: false
    }
  };
}

export async function createEzTreeFromResume(data) {
  const { Tree } = await import("@dgreenheck/ez-tree");
  const options = resumeToEzTreeOptions(data);
  const tree = new Tree(options);
  tree.generate();
  tree.name = "ResumeGeneratedTree";
  tree.scale.setScalar(0.36);
  tree.position.y = -1.02;
  tree.userData.adapter = {
    source: "ez-tree",
    options
  };
  return tree;
}
