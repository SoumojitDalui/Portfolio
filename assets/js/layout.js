import * as THREE from "three";

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed, salt) {
  const hash = hashString(`${seed}:${salt}`);
  const raw = Math.sin(hash * 12.9898) * 43758.5453;
  return ((raw % 1) + 1) % 1;
}

export function seededRange(seed, salt, min, max) {
  return min + seededUnit(seed, salt) * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createLayoutProfile(data) {
  const branchCount = data.branches.length;
  const leafClusterCount = data.skillClusters.length;
  const parity = 1 - Math.abs(branchCount - leafClusterCount) / Math.max(branchCount, leafClusterCount, 1);
  const compactness = 1 - parity * 0.18;

  return {
    parity,
    horizontalScale: compactness,
    verticalScale: 1 - parity * 0.1,
    canopyScale: 1 - parity * 0.16,
    fruitScale: 1 - parity * 0.12
  };
}

function createBranchLayout(data, branch, index, profile) {
  const type = data.experienceTypes[branch.experienceType] || data.experienceTypes.personal;
  const tier = Math.floor(index / 2);
  const outward = (0.82 + branch.weight * 0.66 + type.outwardBoost) * profile.horizontalScale;
  const branchCount = data.branches.length;
  const evenStep = (Math.PI * 2) / branchCount;
  const angleOffset = 0.5;
  const angle = angleOffset + index * evenStep + seededRange(data.seed, `${branch.id}:angle`, -0.18, 0.18);
  const startY = 0.9 + tier * 0.18;
  const endY = 0.82 + (1.73 + branch.weight * 0.56 + type.heightBias + seededRange(data.seed, `${branch.id}:height`, -0.12, 0.12)) * profile.verticalScale;
  const endpoint = new THREE.Vector3(
    Math.sin(angle) * outward,
    endY,
    Math.cos(angle) * outward * 0.74 + type.zBias + seededRange(data.seed, `${branch.id}:z`, -0.14, 0.14)
  );

  return {
    ...branch,
    index,
    angle,
    startY,
    type,
    radius: Math.max(0.045, 0.058 + branch.weight * 0.09 + type.radiusBoost),
    endpoint,
    controlA: new THREE.Vector3(Math.sin(angle) * outward * 0.28, startY + 0.52, Math.cos(angle) * outward * 0.18),
    controlB: new THREE.Vector3(endpoint.x * 0.74, (startY + endY) * 0.52, endpoint.z * 0.72)
  };
}

function createSkillLayout(data, branchLayouts, cluster, index, profile) {
  const linkedBranches = branchLayouts.filter((branch) => branch.skills.includes(cluster.id));
  const center = linkedBranches.reduce((sum, branch) => sum.add(branch.endpoint), new THREE.Vector3());
  if (linkedBranches.length > 0) {
    center.multiplyScalar(1 / linkedBranches.length);
  }

  const crownAngle = (index / data.skillClusters.length) * Math.PI * 2;
  center.x += Math.sin(crownAngle) * 0.26;
  center.y = center.y + 0.2 + cluster.weight * 0.24 + seededRange(data.seed, `${cluster.id}:skillY`, -0.08, 0.08);
  center.z += Math.cos(crownAngle) * 0.18;

  return {
    ...cluster,
    center,
    linkedBranchIds: linkedBranches.map((branch) => branch.id),
    scale: new THREE.Vector3(
      (0.54 + cluster.weight * 0.42) * profile.canopyScale,
      (0.42 + cluster.weight * 0.26) * profile.canopyScale,
      (0.48 + cluster.weight * 0.34) * profile.canopyScale
    ),
    leafCount: Math.round((10 + cluster.skills.length * 3 + cluster.weight * 10) * profile.canopyScale)
  };
}

function createFruitLayout(data, branchLayoutsById, skillLayouts, fruit, index, profile) {
  const branchLayouts = Object.values(branchLayoutsById);
  const branch = branchLayoutsById[fruit.branch] || branchLayouts[index % branchLayouts.length];
  const type = data.experienceTypes[fruit.experienceType] || branch.type || data.experienceTypes.personal;
  const side = index % 2 === 0 ? 1 : -1;
  const relatedSkillClusters = skillLayouts.filter((cluster) => branch.skills.includes(cluster.id));
  const crownAnchor = relatedSkillClusters.length > 0
    ? relatedSkillClusters.reduce((sum, cluster) => sum.add(cluster.center), new THREE.Vector3()).multiplyScalar(1 / relatedSkillClusters.length)
    : branch.endpoint.clone().add(new THREE.Vector3(0, 0.45, 0));
  const position = branch.endpoint.clone().lerp(crownAnchor, 0.72);

  position.x += side * seededRange(data.seed, `${fruit.id}:fruitX`, 0.08, 0.24);
  position.y += seededRange(data.seed, `${fruit.id}:fruitY`, -0.16, 0.16);
  position.z += seededRange(data.seed, `${fruit.id}:fruitZ`, 0.08, 0.34) + type.zBias * 0.15;

  position.y = clamp(position.y - 0.38, 2.2, 3.14);
  position.x = clamp(position.x, -2.15, 2.15);
  position.z = clamp(position.z + 0.12, -1.45, 1.45);

  if (Math.abs(position.x) < 0.42) {
    position.x = 0.42 * (side || 1);
  }

  return {
    ...fruit,
    type,
    position,
    radius: (0.075 + fruit.weight * 0.09) * profile.fruitScale
  };
}

export function buildPortfolioLayout(data) {
  const profile = createLayoutProfile(data);
  const branchLayouts = data.branches.map((branch, index) => createBranchLayout(data, branch, index, profile));
  const branchById = Object.fromEntries(branchLayouts.map((branch) => [branch.id, branch]));
  const skillLayouts = data.skillClusters.map((cluster, index) => createSkillLayout(data, branchLayouts, cluster, index, profile));
  const fruits = data.fruits.map((fruit, index) => createFruitLayout(data, branchById, skillLayouts, fruit, index, profile));

  return { branchLayouts, branchById, skillLayouts, fruits, profile };
}
