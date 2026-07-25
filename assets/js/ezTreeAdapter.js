function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const MEDIUM_ASH_MODEL = {
  type: "deciduous",
  bark: {
    type: "oak",
    tint: 0xcec0a6,
    flatShading: false,
    textured: true,
    textureScale: { x: 0.5, y: 5 }
  },
  branch: {
    levels: 2,
    angle: { 1: 48, 2: 75, 3: 60 },
    children: { 0: 10, 1: 3, 2: 3 },
    force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.02 },
    gnarliness: { 0: 0.11, 1: 0.09, 2: 0.05, 3: 0.09 },
    length: { 0: 23.87, 1: 18, 2: 5.59, 3: 4.6 },
    radius: { 0: 0.81, 1: 0.56, 2: 0.76, 3: 0.7 },
    sections: { 0: 12, 1: 10, 2: 10, 3: 10 },
    segments: { 0: 8, 1: 6, 2: 4, 3: 3 },
    start: { 1: 0.53, 2: 0.33, 3: 0 },
    taper: { 0: 0.7, 1: 0.7, 2: 0.7, 3: 0.7 },
    twist: { 0: 0.3, 1: -0.07, 2: 0, 3: 0 }
  },
  leaves: {
    type: "ash",
    billboard: "double",
    angle: 55,
    count: 30,
    start: 0,
    size: 2.05,
    sizeVariance: 0.717,
    tint: 0xffffff,
    alphaTest: 0.5
  },
  trellis: { enabled: false }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cloneSection(section) {
  return {
    origin: section.origin.clone(),
    orientation: section.orientation.clone(),
    radius: section.radius
  };
}

function sectionTip(sections) {
  return sections[sections.length - 1]?.origin?.clone() || null;
}

function sectionMid(sections) {
  if (!sections.length) return null;
  return sections[Math.floor(sections.length * 0.62)]?.origin?.clone() || null;
}

/**
 * ez-tree grows a deciduous trunk (level 0), then:
 * 1. one vertical terminal continuation
 * 2. children[0] lateral branches around the trunk
 *
 * We treat those laterals as resume domains, ordered by angle around Y.
 */
export function resumeToGrowthProfile(data) {
  const domains = data.branches || [];
  const domainCount = Math.max(domains.length, 1);
  const projectCounts = domains.map((domain) => (
    (data.fruits || []).filter((fruit) => fruit.branch === domain.id).length
  ));
  const maxProjects = Math.max(1, ...projectCounts, 0);
  const avgProjects = projectCounts.length
    ? projectCounts.reduce((sum, count) => sum + count, 0) / projectCounts.length
    : 1;
  const yearsOfExperience = data.trunk?.years || 1;
  const secondaryForks = clamp(Math.round(avgProjects), 1, 3);
  const meanWeight = domains.reduce((sum, domain) => sum + (domain.weight || 0.5), 0) / domainCount;

  return {
    domainCount,
    projectCounts,
    branch: {
      levels: 2,
      // Keep domain laterals starting mid-trunk so they read as distinct limbs.
      angle: { 1: 52 + meanWeight * 8, 2: 48 },
      children: { 0: domainCount, 1: secondaryForks },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.004 },
      gnarliness: { 0: 0.015, 1: 0.04, 2: 0.035 },
      length: {
        0: 20.5 + yearsOfExperience * 0.55,
        1: 9.2 + meanWeight * 2.4 + domainCount * 0.18,
        2: 3.1 + maxProjects * 0.35
      },
      radius: {
        0: 0.8,
        1: 0.5 + meanWeight * 0.12,
        2: 0.58
      },
      sections: { 0: 12, 1: 10, 2: 7 },
      segments: { 0: 8, 1: 6, 2: 4 },
      start: { 1: 0.34, 2: 0.28 },
      taper: { 0: 0.68, 1: 0.74, 2: 0.8 },
      twist: { 0: 0.015, 1: 0.08, 2: 0.04 }
    },
    leaves: {
      count: clamp(Math.round(12 + avgProjects * 5 + domainCount), 16, 28),
      size: 1.55,
      sizeVariance: 0.42,
      angle: 46,
      start: 0.15
    }
  };
}

export function resumeToEzTreeOptions(data) {
  const growth = resumeToGrowthProfile(data);

  return {
    ...MEDIUM_ASH_MODEL,
    seed: hashString(data.seed),
    bark: { ...MEDIUM_ASH_MODEL.bark, textureScale: { ...MEDIUM_ASH_MODEL.bark.textureScale } },
    branch: {
      ...MEDIUM_ASH_MODEL.branch,
      ...growth.branch,
      angle: { ...MEDIUM_ASH_MODEL.branch.angle, ...growth.branch.angle },
      children: { ...MEDIUM_ASH_MODEL.branch.children, ...growth.branch.children },
      force: { ...MEDIUM_ASH_MODEL.branch.force, ...growth.branch.force, direction: { ...growth.branch.force.direction } },
      gnarliness: { ...MEDIUM_ASH_MODEL.branch.gnarliness, ...growth.branch.gnarliness },
      length: { ...MEDIUM_ASH_MODEL.branch.length, ...growth.branch.length },
      radius: { ...MEDIUM_ASH_MODEL.branch.radius, ...growth.branch.radius },
      sections: { ...MEDIUM_ASH_MODEL.branch.sections, ...growth.branch.sections },
      segments: { ...MEDIUM_ASH_MODEL.branch.segments, ...growth.branch.segments },
      start: { ...MEDIUM_ASH_MODEL.branch.start, ...growth.branch.start },
      taper: { ...MEDIUM_ASH_MODEL.branch.taper, ...growth.branch.taper },
      twist: { ...MEDIUM_ASH_MODEL.branch.twist, ...growth.branch.twist }
    },
    leaves: { ...MEDIUM_ASH_MODEL.leaves, ...growth.leaves },
    trellis: { ...MEDIUM_ASH_MODEL.trellis }
  };
}

function captureBranchSkeleton(tree) {
  const records = [];
  let activeRecord = null;
  const originalGenerateBranch = tree.generateBranch.bind(tree);
  const originalGenerateChildBranches = tree.generateChildBranches.bind(tree);
  const originalGenerateLeaves = tree.generateLeaves.bind(tree);

  const captureSections = (sections) => {
    if (!activeRecord || !sections?.length) return;
    activeRecord.sections = sections.map(cloneSection);
    activeRecord.tip = sectionTip(sections);
    activeRecord.mid = sectionMid(sections);
  };

  tree.generateChildBranches = (count, level, sections) => {
    captureSections(sections);
    const queueStart = tree.branchQueue.length;
    originalGenerateChildBranches(count, level, sections);
    const children = tree.branchQueue.slice(queueStart).map((branch, index) => ({
      index,
      level: branch.level,
      origin: branch.origin.clone(),
      orientation: branch.orientation.clone(),
      length: branch.length,
      radius: branch.radius
    }));
    if (activeRecord) {
      activeRecord.childStarts = children;
    }
  };

  tree.generateLeaves = (sections) => {
    captureSections(sections);
    originalGenerateLeaves(sections);
  };

  tree.generateBranch = (branch) => {
    const record = {
      id: records.length,
      level: branch.level,
      origin: branch.origin.clone(),
      orientation: branch.orientation.clone(),
      length: branch.length,
      radius: branch.radius,
      sections: [],
      tip: null,
      mid: null,
      childStarts: [],
      parentId: null
    };
    activeRecord = record;
    originalGenerateBranch(branch);
    activeRecord = null;
    records.push(record);
  };

  tree.generate();

  tree.generateBranch = originalGenerateBranch;
  tree.generateChildBranches = originalGenerateChildBranches;
  tree.generateLeaves = originalGenerateLeaves;

  // Link children by matching queued starts to grown branch origins.
  records.forEach((parent) => {
    parent.childStarts.forEach((childStart) => {
      const child = records.find((candidate) => (
        candidate.parentId === null
        && candidate.level === childStart.level
        && candidate.origin.distanceToSquared(childStart.origin) < 1e-8
      ));
      if (child) child.parentId = parent.id;
    });
  });

  return records;
}

function isVerticalContinuation(branch) {
  const tip = branch.tip || branch.origin;
  const lateral = Math.hypot(tip.x - branch.origin.x, tip.z - branch.origin.z);
  const rise = tip.y - branch.origin.y;
  return rise > lateral * 1.35;
}

export function assignDomainsToBranches(skeletonBranches, domains) {
  const levelOne = skeletonBranches.filter((branch) => branch.level === 1);
  const laterals = levelOne
    .filter((branch) => !isVerticalContinuation(branch))
    .sort((a, b) => {
      const angleA = Math.atan2(a.tip?.x ?? a.origin.x, a.tip?.z ?? a.origin.z);
      const angleB = Math.atan2(b.tip?.x ?? b.origin.x, b.tip?.z ?? b.origin.z);
      return angleA - angleB;
    });

  // Prefer laterals; if capture missed some, fall back to remaining level-1 branches.
  const pool = laterals.length >= domains.length
    ? laterals
    : [...laterals, ...levelOne.filter((branch) => !laterals.includes(branch))];

  return domains.map((domain, index) => {
    const branch = pool[index] || pool[pool.length - 1] || null;
    const children = branch
      ? skeletonBranches.filter((candidate) => candidate.parentId === branch.id)
      : [];
    return {
      domain,
      branch,
      children,
      fruitSites: buildFruitSites(branch, children)
    };
  });
}

function buildFruitSites(branch, children = []) {
  const sites = [];
  const pushFromSections = (sections, source) => {
    if (!sections?.length) return;
    const start = Math.floor(sections.length * 0.45);
    for (let index = start; index < sections.length; index += 1) {
      const section = sections[index];
      const outward = section.origin.clone();
      outward.y = 0;
      if (outward.lengthSq() > 1e-6) outward.normalize();
      else outward.set(0, 0, 1);
      sites.push({
        source,
        origin: section.origin.clone(),
        orientation: section.orientation.clone(),
        radius: section.radius,
        outward
      });
    }
  };

  if (branch) pushFromSections(branch.sections, "domain");
  children.forEach((child) => pushFromSections(child.sections, "fork"));
  return sites;
}

export function getFruitAnchorForDomain(domainBinding, fruitIndex, fruitCount) {
  const sites = domainBinding?.fruitSites || [];
  if (!sites.length) return null;

  const safeCount = Math.max(fruitCount, 1);
  const slot = fruitIndex / safeCount;
  const siteIndex = Math.min(sites.length - 1, Math.floor(slot * sites.length));
  const site = sites[siteIndex];
  // Keep fruit tight to the bark so the stem stays short.
  const hang = 0.18 + (fruitIndex % 3) * 0.05;
  const side = ((fruitIndex % 2) * 2 - 1) * (0.06 + (fruitIndex % 3) * 0.03);

  const position = site.origin.clone();
  position.addScaledVector(site.outward, site.radius + hang);
  const sideAxis = site.origin.clone().set(-site.outward.z, 0, site.outward.x);
  if (sideAxis.lengthSq() > 1e-6) {
    sideAxis.normalize();
    position.addScaledVector(sideAxis, side);
  }
  position.y -= 0.12 + (fruitIndex % 2) * 0.04;

  return {
    position,
    attachment: site.origin.clone().addScaledVector(site.outward, site.radius * 0.95),
    outward: site.outward.clone()
  };
}

export async function createEzTreeFromResume(data) {
  const { Tree } = await import("@dgreenheck/ez-tree");
  const options = resumeToEzTreeOptions(data);
  const growth = resumeToGrowthProfile(data);
  const tree = new Tree(options);
  const skeletonBranches = captureBranchSkeleton(tree);
  const domainBindings = assignDomainsToBranches(skeletonBranches, data.branches || []);

  tree.name = "ResumeGeneratedTree";
  tree.scale.setScalar(0.13);
  tree.position.y = -1.02;
  tree.userData.adapter = {
    source: "ez-tree",
    model: "resume-domain-branches",
    scale: 0.13,
    options,
    growth,
    skeletonBranches,
    domainBindings
  };
  return tree;
}
