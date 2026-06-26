import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { focusTargets, resumeTreeData } from "./data.js?v=ez-texture";
import { buildPortfolioLayout, seededRange } from "./layout.js?v=ez-texture";
import { createEzTreeFromResume, resumeToEzTreeOptions } from "./ezTreeAdapter.js?v=ez-texture";
import { createTextLabel as createSpriteTextLabel } from "./labels.js?v=ez-texture";
import { createMaterials } from "./materials.js?v=ez-texture";

// Renderer and camera setup
const canvas = document.querySelector("#tree-scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xdff3d5, 0.026);

const camera = new THREE.PerspectiveCamera(44, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.6, 8.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 4.2;
controls.maxDistance = 11.5;
controls.maxPolarAngle = Math.PI * 0.56;
controls.target.set(0, 1.7, 0);

const root = new THREE.Group();
scene.add(root);
const portfolioLayout = buildPortfolioLayout(resumeTreeData);
const ezTreeOptions = resumeToEzTreeOptions(resumeTreeData);
const useEzTreeSkeleton = new URLSearchParams(window.location.search).get("skeleton") === "ez";

const selectable = [];
const labels = [];
let selectedObject = null;
let desiredCamera = camera.position.clone();
let desiredTarget = controls.target.clone();
let frameCount = 0;
let isCameraAnimating = false;

const materials = createMaterials();

async function addEzTreeSkeleton() {
  const ezTree = await createEzTreeFromResume(resumeTreeData);
  root.add(ezTree);
  return ezTree;
}

// Environment
function addLights() {
  scene.add(new THREE.HemisphereLight(0xffffe6, 0x8fcf79, 2.05));

  const key = new THREE.DirectionalLight(0xffefba, 2.35);
  key.position.set(3.2, 8, 4.5);
  scene.add(key);

  const rim = new THREE.PointLight(0xc8f7ff, 8, 12, 2.2);
  rim.position.set(-4, 4.2, 3.4);
  scene.add(rim);

  const sunGlow = new THREE.PointLight(0xffd36a, 10, 14, 2.8);
  sunGlow.position.set(4.2, 5.6, -3.2);
  scene.add(sunGlow);
}

function addGround() {
  const groundGeometry = new THREE.CylinderGeometry(4.9, 4.94, 0.02, 96);
  groundGeometry.setAttribute("uv2", groundGeometry.attributes.uv);
  const ground = new THREE.Mesh(groundGeometry, materials.ground);
  ground.position.y = -1.03;
  root.add(ground);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(4.94, 4.98, 0.04, 96, 1, true), materials.soil);
  soil.position.y = -1.06;
  root.add(soil);

  const grassRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.72, 0.055, 8, 128),
    materials.groundRing
  );
  grassRing.position.y = -1.005;
  grassRing.rotation.x = Math.PI / 2;
  root.add(grassRing);

  addGrassBlades();
  addFlowers();
}

function addFlowers() {
  const stemGeometry = new THREE.CylinderGeometry(0.01, 0.014, 0.18, 5);
  const bloomGeometry = new THREE.IcosahedronGeometry(0.045, 1);

  for (let i = 0; i < 34; i += 1) {
    const angle = i * 2.399963 + 0.35;
    const radius = 1.15 + (((i * 43) % 100) / 100) * 3.1;

    const stem = new THREE.Mesh(stemGeometry, materials.grassDark);
    stem.position.set(Math.cos(angle) * radius, -0.93, Math.sin(angle) * radius);
    stem.rotation.z = (((i * 11) % 100) / 100 - 0.5) * 0.24;
    root.add(stem);

    const bloom = new THREE.Mesh(bloomGeometry, i % 3 === 0 ? materials.fruitAlt : materials.flower);
    bloom.position.copy(stem.position);
    bloom.position.y += 0.12;
    bloom.scale.setScalar(0.8 + (((i * 23) % 100) / 100) * 0.6);
    root.add(bloom);
  }
}

function addCloud(position, scale = 1) {
  const cloud = new THREE.Group();
  const puffGeometry = new THREE.IcosahedronGeometry(0.45, 2);
  const offsets = [
    [-0.6, 0, 0],
    [-0.18, 0.1, 0.05],
    [0.28, 0.04, -0.04],
    [0.68, -0.02, 0.02]
  ];

  offsets.forEach(([x, y, z], index) => {
    const puff = new THREE.Mesh(puffGeometry, materials.cloud);
    puff.position.set(x, y, z);
    puff.scale.set(1.05 - index * 0.08, 0.58 + index * 0.04, 0.55);
    cloud.add(puff);
  });

  cloud.position.copy(position);
  cloud.scale.setScalar(scale);
  scene.add(cloud);
}

function addGrassBlades() {
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.018, 0);
  bladeShape.lineTo(0.018, 0);
  bladeShape.lineTo(0.006, 0.22);
  bladeShape.lineTo(0, 0.3);
  bladeShape.lineTo(-0.008, 0.2);
  bladeShape.closePath();

  const bladeGeometry = new THREE.ShapeGeometry(bladeShape);

  for (let i = 0; i < 220; i += 1) {
    const angle = i * 2.399963;
    const ringNoise = ((i * 47) % 100) / 100;
    const radius = 0.9 + ringNoise * 3.72;
    const blade = new THREE.Mesh(bladeGeometry, i % 4 === 0 ? materials.grassDark : materials.grass);
    blade.position.set(Math.cos(angle) * radius, -1.01, Math.sin(angle) * radius);
    blade.rotation.set(
      0.18 + (((i * 29) % 100) / 100) * 0.32,
      -angle + Math.PI / 2,
      (((i * 17) % 100) / 100 - 0.5) * 0.45
    );
    blade.scale.setScalar(0.72 + (((i * 31) % 100) / 100) * 0.55);
    root.add(blade);
  }
}

function tubeFromPoints(points, radius, material, segments = 36) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 7, false);
  return new THREE.Mesh(geometry, material);
}

function closedTubeFromPoints(points, radius, material, segments = 96) {
  const curve = new THREE.CatmullRomCurve3(points, true);
  const geometry = new THREE.TubeGeometry(curve, segments, radius, 6, true);
  return new THREE.Mesh(geometry, material);
}

function createTextLabel(text, position, options = {}) {
  return createSpriteTextLabel(root, labels, text, position, options);
}

// Resume tree geometry
function addRoots() {
  resumeTreeData.roots.forEach((rootItem, index) => {
    const angle = (index / resumeTreeData.roots.length) * Math.PI * 2 + seededRange(resumeTreeData.seed, `${rootItem.id}:rootAngle`, -0.22, 0.22);
    const length = 1.35 + rootItem.weight * 1.05;
    const end = new THREE.Vector3(Math.cos(angle) * length, -1.46 - rootItem.weight * 0.22, Math.sin(angle) * length);
    const path = [
      new THREE.Vector3(0, -1.02, 0),
      new THREE.Vector3(Math.cos(angle) * length * 0.32, -1.16, Math.sin(angle) * length * 0.22),
      new THREE.Vector3(Math.cos(angle) * length * 0.68, -1.28 - rootItem.weight * 0.14, Math.sin(angle) * length * 0.62),
      end
    ];
    const mesh = tubeFromPoints(path, 0.035 + rootItem.weight * 0.032, materials.root);
    mesh.userData.type = "education";
    mesh.userData.item = rootItem;
    root.add(mesh);

    addNode("education", end.clone().add(new THREE.Vector3(0, 0.08, 0)), 0.07 + rootItem.weight * 0.065, materials.marker);
    createTextLabel(rootItem.label, end.clone().add(new THREE.Vector3(0, 0.32, 0)), {
      scale: 0.24,
      fontSize: 34,
      maxWidth: 300,
      background: "rgba(255, 246, 219, 0.78)"
    });
  });
}

function addTrunk() {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 2.65, 11), materials.bark);
  trunk.position.y = 0.38;
  trunk.userData.type = "profile";
  root.add(trunk);

  addNaturalBarkLines();
  addExperienceRings();
  addProfileLabels();
}

function addProfileLabels() {
  createTextLabel("Soumojit Dalui", new THREE.Vector3(0, 0.82, 0.58), {
    scale: 0.29,
    fontSize: 38,
    maxWidth: 340,
    background: "rgba(255, 230, 176, 0.86)"
  });
  createTextLabel("Software Engineer", new THREE.Vector3(0, 0.48, 0.6), {
    scale: 0.22,
    fontSize: 30,
    maxWidth: 300,
    background: "rgba(255, 248, 216, 0.78)"
  });
}

function addEzPortfolioDecorations() {
  addNaturalBarkLines();
  addExperienceRings();
  addProfileLabels();
  addEzDomainLabels();
  addEzProjectFruits();
}

function addEzDomainLabels() {
  portfolioLayout.branchLayouts.forEach((branch) => {
    const position = branch.endpoint.clone();
    position.multiplyScalar(0.86);
    position.y = Math.min(position.y + 0.18, 3.2);

    createTextLabel(branch.label, position, {
      scale: 0.15 + branch.weight * 0.026,
      fontSize: 26,
      maxWidth: 320,
      background: branch.experienceType === "production" ? "rgba(255, 220, 147, 0.58)" : "rgba(255, 248, 216, 0.54)"
    });
  });

  portfolioLayout.skillLayouts.forEach((cluster) => {
    const position = cluster.center.clone();
    position.multiplyScalar(0.82);
    position.y = Math.min(position.y + 0.32, 3.42);

    createTextLabel(cluster.label, position, {
      scale: 0.12,
      fontSize: 24,
      maxWidth: 260,
      background: "rgba(236, 255, 204, 0.48)"
    });
  });
}

function addEzProjectFruits() {
  portfolioLayout.fruits.forEach((fruit, index) => {
    const materialByType = {
      production: materials.fruitProduction,
      openSource: materials.fruitOpenSource,
      academic: materials.fruitAcademic,
      prototype: materials.fruitPrototype,
      personal: materials.fruitPersonal,
      internship: materials.fruitAlt
    };

    const position = fruit.position.clone();
    position.multiplyScalar(0.82);
    position.y = Math.min(Math.max(position.y + 0.08, 2.1), 3.05);
    fruit.position.copy(position);
    fruit.radius *= 0.92;

    addFruitModel(fruit, materialByType[fruit.experienceType] || (index % 3 === 0 ? materials.fruitAlt : materials.fruit));
    createTextLabel(fruit.label, fruit.position.clone().add(new THREE.Vector3(0, -fruit.radius - 0.12, 0.16)), {
      scale: 0.1 + fruit.weight * 0.018,
      fontSize: 22,
      maxWidth: 320,
      background: fruit.experienceType === "openSource" ? "rgba(215, 247, 255, 0.5)" : "rgba(255, 248, 216, 0.48)"
    });
  });
}

function trunkRadiusAt(y) {
  const normalized = (y + 0.945) / 2.65;
  return 0.46 + (0.38 - 0.46) * THREE.MathUtils.clamp(normalized, 0, 1);
}

function makeBarkRing(job, options = {}) {
  const points = [];
  const pointCount = 90;
  const baseRadius = trunkRadiusAt(job.y) + (options.offset || 0.026);
  const amplitude = options.amplitude || 0.018;

  for (let i = 0; i < pointCount; i += 1) {
    const angle = (i / pointCount) * Math.PI * 2;
    const wobble = Math.sin(angle * 3 + job.weight * 5.1) * amplitude
      + Math.sin(angle * 7 + job.angle) * amplitude * 0.42;
    points.push(new THREE.Vector3(
      Math.cos(angle) * (baseRadius + wobble),
      job.y + Math.sin(angle * 2 + job.angle) * 0.018,
      Math.sin(angle) * (baseRadius * 0.78 + wobble * 0.5)
    ));
  }

  const ring = closedTubeFromPoints(points, options.thickness || 0.012, options.material || materials.barkGroove);
  ring.userData.type = "experience";
  root.add(ring);
  return ring;
}

function makeFrontGroove(job, options = {}) {
  const points = [];
  const pointCount = 36;
  const startAngle = Math.PI * 0.14;
  const endAngle = Math.PI * 0.86;
  const baseRadius = trunkRadiusAt(job.y) + (options.offset || 0.05);

  for (let i = 0; i < pointCount; i += 1) {
    const t = i / (pointCount - 1);
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const wobble = Math.sin(t * Math.PI * 5 + job.angle) * 0.014;
    points.push(new THREE.Vector3(
      Math.cos(angle) * (baseRadius + wobble),
      job.y + Math.sin(t * Math.PI * 2 + job.weight) * 0.025,
      Math.sin(angle) * (baseRadius * 0.8)
    ));
  }

  const groove = tubeFromPoints(points, options.thickness || 0.018, options.material || materials.barkGroove, 34);
  groove.userData.type = "experience";
  root.add(groove);
  return groove;
}

function addNaturalBarkLines() {
  for (let i = 0; i < 8; i += 1) {
    const y = -0.72 + i * 0.27;
    const jobLike = {
      y,
      angle: i * 0.6,
      weight: 0.28 + i * 0.04
    };
    makeBarkRing(jobLike, {
      thickness: 0.005,
      amplitude: 0.01,
      offset: 0.014,
      material: i % 2 === 0 ? materials.barkDark : materials.barkHighlight
    });

    if (i % 2 === 0) {
      makeFrontGroove(jobLike, {
        thickness: 0.006,
        offset: 0.038,
        material: materials.barkDark
      });
    }
  }
}

function addExperienceRings() {
  resumeTreeData.trunk.jobs.forEach((job) => {
    const ringThickness = 0.01 + job.weight * 0.017;
    makeBarkRing(job, {
      thickness: ringThickness,
      amplitude: 0.016 + job.weight * 0.012,
      offset: 0.035,
      material: job.id === "ltimindtree" ? materials.barkGroove : materials.barkDark
    });
    makeFrontGroove(job, {
      thickness: 0.016 + job.weight * 0.02,
      offset: 0.058,
      material: job.id === "ltimindtree" ? materials.barkGroove : materials.barkDark
    });

    makeFrontGroove(
      { ...job, y: job.y - 0.055, angle: job.angle + 0.9 },
      {
        thickness: 0.005 + job.weight * 0.006,
        offset: 0.062,
        material: materials.barkHighlight
      }
    );

    const frontRadius = trunkRadiusAt(job.y) + 0.12;
    const labelPosition = new THREE.Vector3(0, job.y + 0.08, frontRadius * 0.82);
    createTextLabel(`${job.period} ${job.label}`, labelPosition, {
      scale: 0.12 + job.weight * 0.035,
      fontSize: 24,
      maxWidth: job.id === "ltimindtree" ? 430 : 340,
      color: "#3c2415",
      background: "rgba(255, 232, 177, 0.18)",
      border: "rgba(92, 55, 30, 0.04)"
    });

    addNode(
      "experience",
      new THREE.Vector3(Math.cos(job.angle) * frontRadius, job.y + 0.02, Math.sin(job.angle) * frontRadius * 0.78),
      0.035 + job.weight * 0.055,
      job.id === "ltimindtree" ? materials.barkHighlight : materials.barkDark
    );
  });

  const mainJob = resumeTreeData.trunk.jobs.find((job) => job.id === "ltimindtree") || resumeTreeData.trunk.jobs.at(-1);
  resumeTreeData.trunk.accomplishmentMarks.forEach((mark, index) => {
    const angle = index * 1.18 + seededRange(resumeTreeData.seed, `${mark.label}:markAngle`, -0.18, 0.18);
    const y = mainJob.y - 0.18 + index * 0.08;
    const radius = trunkRadiusAt(y) + 0.075;
    addNode(
      "profile",
      new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius * 0.78),
      0.035 + mark.weight * 0.035,
      materials.marker
    );
  });
}

function addBranch(type, points, radius) {
  const branch = tubeFromPoints(points, radius, materials.bark, 42);
  branch.userData.type = type;
  root.add(branch);
}

function addTwigFork(branch, branchType) {
  const twigCount = branch.weight > 0.72 ? 3 : 2;
  for (let i = 0; i < twigCount; i += 1) {
    const spread = (i - (twigCount - 1) / 2) * 0.24;
    const twigAngle = branch.angle + spread + seededRange(resumeTreeData.seed, `${branch.id}:twig:${i}`, -0.18, 0.18);
    const twigEnd = branch.endpoint.clone().add(new THREE.Vector3(
      Math.sin(twigAngle) * (0.32 + branch.weight * 0.22),
      0.22 + i * 0.04,
      Math.cos(twigAngle) * (0.18 + branch.weight * 0.08)
    ));

    addBranch(branchType, [branch.controlB.clone(), branch.endpoint.clone(), twigEnd], branch.radius * (0.26 + i * 0.04));
  }
}

function addBranches() {
  portfolioLayout.branchLayouts.forEach((branch) => {
    const path = [
      new THREE.Vector3(0, branch.startY, 0),
      branch.controlA,
      branch.controlB,
      branch.endpoint
    ];
    addBranch("experience", path, branch.radius * 0.86);
    addNode("experience", branch.endpoint, 0.028 + branch.weight * 0.026, materials.barkHighlight);
    createTextLabel(branch.label, branch.endpoint.clone().add(new THREE.Vector3(0, 0.28, 0)), {
      scale: 0.18 + branch.weight * 0.035,
      fontSize: 28,
      maxWidth: 340,
      background: branch.experienceType === "production" ? "rgba(255, 220, 147, 0.62)" : "rgba(255, 248, 216, 0.58)"
    });

    if (branch.weight > 0.62) {
      addTwigFork(branch, branch.id === "ai" || branch.id === "web" ? "projects" : "skills");
    }
  });
}

function addCanopyMasses() {
  const puffGeometry = new THREE.DodecahedronGeometry(1, 1);

  portfolioLayout.skillLayouts.forEach((cluster, clusterIndex) => {
    const puffCount = 3 + (cluster.weight > 0.82 ? 1 : 0);
    for (let i = 0; i < puffCount; i += 1) {
      const angle = (i / puffCount) * Math.PI * 2 + clusterIndex * 0.52;
      const offset = new THREE.Vector3(
        Math.cos(angle) * cluster.scale.x * 0.34,
        Math.sin(angle * 1.7) * cluster.scale.y * 0.16,
        Math.sin(angle) * cluster.scale.z * 0.24
      );
      const canopy = new THREE.Mesh(puffGeometry, (i + clusterIndex) % 2 === 0 ? materials.canopy : materials.canopyLight);
      canopy.position.copy(cluster.center).add(offset);
      canopy.scale.set(
        cluster.scale.x * (0.46 + i * 0.035),
        cluster.scale.y * (0.48 + (i % 2) * 0.04),
        cluster.scale.z * (0.46 + ((i + 1) % 2) * 0.05)
      );
      canopy.rotation.set(indexedAngle(clusterIndex, i, 0.23), indexedAngle(clusterIndex, i, 0.41), indexedAngle(clusterIndex, i, 0.17));
      canopy.userData.type = "skills";
      root.add(canopy);
    }
  });

  const crown = new THREE.Mesh(puffGeometry, materials.canopyLight);
  crown.position.set(0, 3.85, 0);
  crown.scale.set(0.7, 0.46, 0.58);
  crown.userData.type = "skills";
  root.add(crown);
}

function addSkillConnectors() {
  portfolioLayout.skillLayouts.forEach((cluster) => {
    const linkedBranches = cluster.linkedBranchIds
      .map((branchId) => portfolioLayout.branchById[branchId])
      .filter(Boolean);

    linkedBranches.forEach((branch, index) => {
      const attachPoint = cluster.center.clone().lerp(branch.endpoint, 0.26);
      attachPoint.y -= cluster.scale.y * 0.18;
      const sideBend = new THREE.Vector3(
        Math.sin(branch.angle + index * 0.18) * 0.12,
        0.08,
        Math.cos(branch.angle + index * 0.18) * 0.1
      );

      addBranch(
        "skills",
        [
          branch.endpoint.clone(),
          branch.endpoint.clone().lerp(attachPoint, 0.46).add(sideBend),
          attachPoint
        ],
        Math.max(0.012, branch.radius * 0.2)
      );
    });
  });
}

function addLeaves() {
  addSkillConnectors();
  addCanopyMasses();

  const leafGeometry = new THREE.SphereGeometry(0.075, 8, 6);
  const clusters = portfolioLayout.skillLayouts.map((cluster) => ({
    center: cluster.center,
    spread: [cluster.scale.x * 0.58, cluster.scale.y * 0.46, cluster.scale.z * 0.52],
    count: cluster.leafCount,
    id: cluster.id
  }));

  clusters.forEach((cluster, clusterIndex) => {
    for (let i = 0; i < cluster.count; i += 1) {
      const angle = (i * 2.399 + clusterIndex) % (Math.PI * 2);
      const radius = 0.35 + ((i * 37) % 100) / 100;
      const leaf = new THREE.Mesh(leafGeometry, i % 3 === 0 ? materials.leafDark : materials.leaf);
      leaf.position.set(
        cluster.center.x + Math.cos(angle) * radius * cluster.spread[0],
        cluster.center.y + (((i * 19) % 100) / 100 - 0.5) * cluster.spread[1],
        cluster.center.z + Math.sin(angle) * radius * cluster.spread[2]
      );
      leaf.scale.set(1.4, 0.52, 0.82);
      leaf.rotation.set(i * 0.11, i * 0.17, i * 0.07);
      leaf.userData.type = "skills";
      root.add(leaf);
    }
  });

  portfolioLayout.skillLayouts.forEach((cluster) => {
    createTextLabel(cluster.label, cluster.center.clone().add(new THREE.Vector3(0, cluster.scale.y * 0.62 + 0.18, cluster.scale.z * 0.72)), {
      scale: 0.15,
      fontSize: 26,
      maxWidth: 280,
      background: "rgba(236, 255, 204, 0.56)"
    });
  });
}

function indexedAngle(groupIndex, itemIndex, multiplier) {
  return (groupIndex * 1.31 + itemIndex * 0.73) * multiplier;
}

function addNode(type, position, radius, material) {
  const node = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), material);
  node.position.copy(position);
  node.userData.type = type;
  node.userData.baseScale = node.scale.clone();
  root.add(node);
  selectable.push(node);
  return node;
}

function addFruits() {
  portfolioLayout.fruits.forEach((fruit, index) => {
    const materialByType = {
      production: materials.fruitProduction,
      openSource: materials.fruitOpenSource,
      academic: materials.fruitAcademic,
      prototype: materials.fruitPrototype,
      personal: materials.fruitPersonal,
      internship: materials.fruitAlt
    };
    const branch = portfolioLayout.branchById[fruit.branch];
    if (branch) {
      const stemStart = branch.endpoint.clone().lerp(fruit.position, 0.6).add(new THREE.Vector3(0, 0.08, 0));
      const stemEnd = fruit.position.clone().add(new THREE.Vector3(0, fruit.radius * 0.95, 0));
      addBranch("projects", [stemStart, stemEnd], Math.max(0.01, fruit.radius * 0.1));
    }
    addFruitModel(fruit, materialByType[fruit.experienceType] || (index % 3 === 0 ? materials.fruitAlt : materials.fruit));
    createTextLabel(fruit.label, fruit.position.clone().add(new THREE.Vector3(0, -fruit.radius - 0.12, 0.16)), {
      scale: 0.12 + fruit.weight * 0.025,
      fontSize: 24,
      maxWidth: 330,
      background: fruit.experienceType === "openSource" ? "rgba(215, 247, 255, 0.56)" : "rgba(255, 248, 216, 0.52)"
    });
  });
}

function addFruitModel(fruit, material) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(fruit.radius, 14, 10), material);
  body.scale.set(0.92, 1.08, 0.92);
  group.add(body);

  const dimple = new THREE.Mesh(new THREE.SphereGeometry(fruit.radius * 0.22, 8, 6), materials.barkDark);
  dimple.position.y = fruit.radius * 0.78;
  dimple.scale.set(1, 0.35, 1);
  group.add(dimple);

  const fruitLeaf = new THREE.Mesh(new THREE.SphereGeometry(fruit.radius * 0.32, 8, 6), materials.leafDark);
  fruitLeaf.position.set(fruit.radius * 0.22, fruit.radius * 1.04, 0);
  fruitLeaf.scale.set(1.55, 0.34, 0.72);
  fruitLeaf.rotation.z = -0.7;
  group.add(fruitLeaf);

  group.position.copy(fruit.position);
  group.userData.type = "projects";
  root.add(group);
  selectable.push(body);
  body.userData.type = "projects";
  body.userData.baseScale = body.scale.clone();
  return group;
}

function addContactOrbits() {
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.008, 8, 128),
    new THREE.MeshBasicMaterial({ color: 0x8ee0a1, transparent: true, opacity: 0.36 })
  );
  orbit.position.y = 4.62;
  orbit.rotation.x = Math.PI / 2.8;
  orbit.userData.type = "contact";
  root.add(orbit);

  for (let i = 0; i < 3; i += 1) {
    const angle = i * ((Math.PI * 2) / 3) + 0.4;
    addNode("contact", new THREE.Vector3(Math.cos(angle) * 2.2, 4.75 + i * 0.08, Math.sin(angle) * 1.35), 0.11, materials.marker);
  }
}

// Interaction and animation
function focusNode(type) {
  const focus = focusTargets[type] || focusTargets.profile;
  desiredCamera = focus.position.clone();
  desiredTarget = focus.target.clone();
  isCameraAnimating = true;
}

function bindUi() {
  controls.addEventListener("start", () => {
    isCameraAnimating = false;
  });

  window.addEventListener("keydown", (event) => {
    const keyMap = {
      "1": "education",
      "2": "profile",
      "3": "experience",
      "4": "skills",
      "5": "projects",
      "6": "contact"
    };
    if (keyMap[event.key]) {
      focusNode(keyMap[event.key]);
    }
  });
}

function bindPicking() {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  window.addEventListener("pointerdown", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const hit = raycaster.intersectObjects(selectable, false)[0];
    if (!hit) return;

    selectedObject = hit.object;
    focusNode(selectedObject.userData.type);
  });
}

function handleResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function animate(time = 0) {
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(animate);
  }
  frameCount += 1;

  const seconds = time * 0.001;
  if (isCameraAnimating) {
    camera.position.lerp(desiredCamera, 0.045);
    controls.target.lerp(desiredTarget, 0.05);

    if (camera.position.distanceTo(desiredCamera) < 0.03 && controls.target.distanceTo(desiredTarget) < 0.03) {
      camera.position.copy(desiredCamera);
      controls.target.copy(desiredTarget);
      isCameraAnimating = false;
    }
  }

  selectable.forEach((node, index) => {
    const pulse = 1 + Math.sin(seconds * 2.6 + index) * 0.055;
    const selectedBoost = node === selectedObject ? 1.24 : 1;
    node.scale.copy(node.userData.baseScale || new THREE.Vector3(1, 1, 1)).multiplyScalar(pulse * selectedBoost);
  });

  controls.update();
  renderer.render(scene, camera);

window.__portfolioTreeDebug = {
    frameCount,
    sceneChildren: scene.children.length,
    rootChildren: root.children.length,
    selectableNodes: selectable.length,
    triangles: renderer.info.render.triangles,
    generator: useEzTreeSkeleton ? "ez-tree" : "portfolio-layout",
    ezTreeOptions
  };
}

// Scene bootstrap
addLights();
addGround();
addCloud(new THREE.Vector3(-3.8, 5.8, -3.4), 0.95);
addCloud(new THREE.Vector3(3.6, 5.2, -2.8), 0.72);
addCloud(new THREE.Vector3(0.7, 6.4, -4.2), 0.58);
addRoots();
if (useEzTreeSkeleton) {
  await addEzTreeSkeleton();
  addEzPortfolioDecorations();
} else {
  addTrunk();
  addBranches();
  addLeaves();
  addFruits();
}
bindUi();
bindPicking();

window.addEventListener("resize", handleResize);
animate();
