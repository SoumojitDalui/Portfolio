import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { focusTargets, resumeTreeData } from "./data.js?v=first-person";
import { buildPortfolioLayout, seededRange } from "./layout.js?v=first-person";
import { addEzEnvironment } from "./ezEnvironment.js?v=first-person";
import { createEzTreeFromResume, resumeToEzTreeOptions, getFruitAnchorForDomain } from "./ezTreeAdapter.js?v=first-person";
import { createTextLabel as createSpriteTextLabel } from "./labels.js?v=first-person";
import { createMaterials } from "./materials.js?v=first-person";
import { shouldUseEzTree } from "./sceneConfig.js?v=first-person";
import { getTimePalette, resolveTimeOfDay } from "./timeOfDay.js?v=first-person";
import { shouldFocusCameraAfterSelection } from "./interactionPolicy.js?v=first-person";

let activeTimeOfDay = resolveTimeOfDay(window.location.search);
let activeTimePalette = getTimePalette(activeTimeOfDay.hour);
let lastTimePaletteRefresh = 0;

// Renderer and camera setup
const canvas = document.querySelector("#tree-scene");
const walkHint = document.querySelector("#walk-hint");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = activeTimePalette.exposure;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(activeTimePalette.fog, activeTimePalette.fogDensity);

const PLAYER = {
  groundY: -1.035,
  eyeHeight: 1.62,
  speed: 3.35,
  sprintMultiplier: 1.55,
  bodyRadius: 0.32,
  trunkClearance: 0.72,
  lookPitchMin: -0.95,
  lookPitchMax: 0.85
};

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.08, 240);
camera.position.set(0, PLAYER.groundY + PLAYER.eyeHeight, 6.4);
camera.rotation.order = "YXZ";

const controls = new PointerLockControls(camera, renderer.domElement);

const YARD_BOUNDS = {
  softCameraRadius: 7.2,
  hardCameraRadius: 8.4,
  fogStart: 5.2,
  fogBoost: 0.72
};

const root = new THREE.Group();
scene.add(root);
const portfolioLayout = buildPortfolioLayout(resumeTreeData);
const ezTreeOptions = resumeToEzTreeOptions(resumeTreeData);
const useEzTreeSkeleton = shouldUseEzTree(window.location.search);

const selectable = [];
const labels = [];
let selectedObject = null;
let desiredPlayerPosition = new THREE.Vector3(camera.position.x, 0, camera.position.z);
let desiredLookAt = new THREE.Vector3(0, 0.55, 0);
let frameCount = 0;
let isPlayerNavigating = false;
let environmentController = null;
let ezTree = null;
let ezTreeAnchors = null;
let projectFruitPrototype = null;
let lastFrameTime = performance.now();
const treeWindUniforms = [];
const lightRig = {};
const fruitLoader = new GLTFLoader();
const moveKeys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false
};
const walkDirection = new THREE.Vector3();
const yardScratchDirection = new THREE.Vector3();

const materials = createMaterials();
const globalWind = {
  direction: Math.PI * 0.23,
  speed: 1.08,
  noiseScale: 1.7,
  strength: 0.82
};

function getGlobalWindState(seconds) {
  const slowGust = 0.5 + 0.5 * Math.sin(seconds * 0.42 + 1.6);
  const fastGust = 0.5 + 0.5 * Math.sin(seconds * 1.35 + 0.4);
  return {
    ...globalWind,
    gust: 0.72 + slowGust * 0.2 + fastGust * 0.08
  };
}

function clampToRadius(vector, radius) {
  const length = Math.hypot(vector.x, vector.z);
  if (length <= radius || length < 1e-6) return vector;
  const scale = radius / length;
  vector.x *= scale;
  vector.z *= scale;
  return vector;
}

function keepClearOfTrunk(position) {
  const radial = Math.hypot(position.x, position.z);
  if (radial >= PLAYER.trunkClearance || radial < 1e-6) return position;
  const scale = PLAYER.trunkClearance / radial;
  position.x *= scale;
  position.z *= scale;
  return position;
}

function setPlayerOnGround(x = camera.position.x, z = camera.position.z) {
  camera.position.set(x, PLAYER.groundY + PLAYER.eyeHeight, z);
  keepClearOfTrunk(camera.position);
  clampToRadius(camera.position, YARD_BOUNDS.hardCameraRadius);
  camera.position.y = PLAYER.groundY + PLAYER.eyeHeight;
}

function enforceYardBounds() {
  keepClearOfTrunk(camera.position);
  clampToRadius(camera.position, YARD_BOUNDS.hardCameraRadius);

  const cameraRadius = Math.hypot(camera.position.x, camera.position.z);
  if (cameraRadius > YARD_BOUNDS.softCameraRadius) {
    const pull = THREE.MathUtils.smoothstep(
      YARD_BOUNDS.softCameraRadius,
      YARD_BOUNDS.hardCameraRadius,
      cameraRadius
    );
    const softScale = 1 - pull * 0.1;
    camera.position.x *= softScale;
    camera.position.z *= softScale;
  }

  camera.position.y = PLAYER.groundY + PLAYER.eyeHeight;
}

function updateBoundaryFog() {
  if (!scene.fog) return;
  const cameraRadius = Math.hypot(camera.position.x, camera.position.z);
  const edgeFactor = THREE.MathUtils.smoothstep(
    YARD_BOUNDS.fogStart,
    YARD_BOUNDS.hardCameraRadius,
    cameraRadius
  );
  const lookOut = Math.max(0, -camera.getWorldDirection(yardScratchDirection).y);
  const horizonFactor = THREE.MathUtils.smoothstep(0.02, 0.22, lookOut) * 0.35;
  const veil = Math.max(edgeFactor, horizonFactor * edgeFactor);
  scene.fog.density = activeTimePalette.fogDensity * (1 + veil * YARD_BOUNDS.fogBoost);
}

function updatePlayerMovement(deltaSeconds) {
  if (isPlayerNavigating) {
    const current = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    current.lerp(desiredPlayerPosition, Math.min(1, deltaSeconds * 2.4));
    setPlayerOnGround(current.x, current.z);
    camera.lookAt(desiredLookAt);
    camera.rotation.order = "YXZ";
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x, PLAYER.lookPitchMin, PLAYER.lookPitchMax);

    if (current.distanceTo(desiredPlayerPosition) < 0.08) {
      setPlayerOnGround(desiredPlayerPosition.x, desiredPlayerPosition.z);
      camera.lookAt(desiredLookAt);
      camera.rotation.order = "YXZ";
      isPlayerNavigating = false;
    }
    return;
  }

  if (!controls.isLocked) return;

  const speed = PLAYER.speed * (moveKeys.sprint ? PLAYER.sprintMultiplier : 1);
  walkDirection.set(0, 0, 0);
  if (moveKeys.forward) walkDirection.z += 1;
  if (moveKeys.backward) walkDirection.z -= 1;
  if (moveKeys.left) walkDirection.x -= 1;
  if (moveKeys.right) walkDirection.x += 1;

  if (walkDirection.lengthSq() > 0) {
    walkDirection.normalize();
    controls.moveRight(walkDirection.x * speed * deltaSeconds);
    controls.moveForward(walkDirection.z * speed * deltaSeconds);
  }

  setPlayerOnGround(camera.position.x, camera.position.z);
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x, PLAYER.lookPitchMin, PLAYER.lookPitchMax);
}

async function addEzTreeSkeleton() {
  ezTree = await createEzTreeFromResume(resumeTreeData);
  applyTreeWindShader(ezTree);
  root.add(ezTree);
  root.updateMatrixWorld(true);
  ezTreeAnchors = collectEzTreeAnchors(ezTree);
  return ezTree;
}

async function loadProjectFruitModel() {
  const gltf = await fruitLoader.loadAsync("./assets/models/pomegranate.glb");
  projectFruitPrototype = gltf.scene;
  projectFruitPrototype.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function collectEzTreeAnchors(tree) {
  const leaves = [];
  const bark = [];
  const point = new THREE.Vector3();

  tree.traverse((child) => {
    if (!child.isMesh || !child.geometry?.attributes?.position) return;

    const materialList = Array.isArray(child.material) ? child.material : [child.material];
    const isLeaf = materialList.some((material) => material?.alphaTest > 0 || material?.transparent);
    const destination = isLeaf ? leaves : bark;
    const positions = child.geometry.attributes.position;
    const stride = Math.max(1, Math.floor(positions.count / 180));

    for (let index = 0; index < positions.count; index += stride) {
      point.fromBufferAttribute(positions, index);
      child.localToWorld(point);
      root.worldToLocal(point);
      destination.push(point.clone());
    }
  });

  const bounds = leaves.reduce((result, point) => ({
    minY: Math.min(result.minY, point.y),
    maxY: Math.max(result.maxY, point.y)
  }), { minY: Infinity, maxY: -Infinity });

  return { leaves, bark, bounds };
}

function getEzCanopyAnchor(index, project) {
  const candidates = ezTreeAnchors?.leaves || [];
  if (candidates.length === 0) {
    const scale = ezTree?.userData.adapter?.scale || 0.13;
    return project.position.clone().multiplyScalar(scale).add(new THREE.Vector3(0, -1.02, 0));
  }

  const { minY, maxY } = ezTreeAnchors.bounds;
  const projectBranchIds = [...new Set(portfolioLayout.fruits.map((fruit) => fruit.branch))];
  const branchIndex = Math.max(projectBranchIds.indexOf(project.branch), 0);
  const projectsOnBranch = portfolioLayout.fruits.filter((fruit) => fruit.branch === project.branch);
  const projectIndex = Math.max(projectsOnBranch.findIndex((fruit) => fruit.id === project.id), 0);
  const branchProgress = projectBranchIds.length > 1 ? branchIndex / (projectBranchIds.length - 1) : 0.5;
  const projectProgress = projectsOnBranch.length > 1 ? projectIndex / (projectsOnBranch.length - 1) - 0.5 : 0;
  const angle = THREE.MathUtils.lerp(-1.22, 1.22, branchProgress) + projectProgress * 0.3;
  const heightProgress = 0.3 + ((projectIndex + branchIndex) % 3) * 0.2;
  const desired = new THREE.Vector3(
    Math.sin(angle) * (0.5 + project.weight * 0.22),
    THREE.MathUtils.lerp(minY, maxY, heightProgress),
    Math.cos(angle) * (0.38 + project.weight * 0.18)
  );

  let bestPoint = candidates[0];
  let bestScore = Infinity;
  candidates.forEach((point) => {
    const radialDifference = Math.abs(Math.hypot(point.x, point.z) - Math.hypot(desired.x, desired.z));
    const angleDifference = Math.abs(Math.atan2(point.x, point.z) - Math.atan2(desired.x, desired.z));
    const normalizedAngle = Math.min(angleDifference, Math.PI * 2 - angleDifference);
    const score = point.distanceToSquared(desired) + radialDifference * 0.5 + normalizedAngle * 0.32;
    if (score < bestScore) {
      bestScore = score;
      bestPoint = point;
    }
  });

  return bestPoint.clone();
}

function getEzBranchAttachment(canopyPoint) {
  const candidates = (ezTreeAnchors?.bark || []).filter((point) => Math.hypot(point.x, point.z) > 0.55);
  if (candidates.length === 0) return canopyPoint.clone();
  const lateralCandidates = candidates.filter((point) => Math.abs(point.x) > 0.65);
  const branchCandidates = lateralCandidates.length > 0 ? lateralCandidates : candidates;

  return branchCandidates.reduce((closest, point) => (
    point.distanceToSquared(canopyPoint) < closest.distanceToSquared(canopyPoint) ? point : closest
  ), candidates[0]).clone();
}

function getEzTrunkCenter(targetY) {
  const candidates = ezTreeAnchors?.bark || [];
  if (candidates.length === 0) return new THREE.Vector3(0, targetY, 0);

  const nearby = candidates.filter((point) => (
    Math.abs(point.y - targetY) < 0.14 && Math.hypot(point.x, point.z) < 0.7
  ));
  if (nearby.length > 0) {
    const center = nearby.reduce((sum, point) => sum.add(point), new THREE.Vector3());
    center.multiplyScalar(1 / nearby.length);
    return new THREE.Vector3(center.x, targetY, center.z);
  }

  const point = candidates.reduce((best, candidate) => (
    Math.abs(candidate.y - targetY) < Math.abs(best.y - targetY) ? candidate : best
  ), candidates[0]);

  return new THREE.Vector3(point.x, targetY, point.z);
}

function getEzTrunkLabelAnchor(targetY, fallback) {
  if (!useEzTreeSkeleton) return fallback;
  const center = getEzTrunkCenter(targetY);
  return center.add(new THREE.Vector3(0, 0, 0.25));
}

// Environment
function addLights() {
  lightRig.hemisphere = new THREE.HemisphereLight(0xffffe6, 0x8fcf79, 2.05);
  scene.add(lightRig.hemisphere);

  lightRig.key = new THREE.DirectionalLight(0xffefba, 2.35);
  scene.add(lightRig.key);
  applyTimeOfDay();
}

function applyTimeOfDay() {
  activeTimeOfDay = resolveTimeOfDay(window.location.search);
  activeTimePalette = getTimePalette(activeTimeOfDay.hour);
  const sunProgress = Math.max(0, Math.sin(((activeTimeOfDay.hour - 6) / 12) * Math.PI));
  const sunAngle = ((activeTimeOfDay.hour - 6) / 24) * Math.PI * 2;

  renderer.toneMappingExposure = activeTimePalette.exposure;
  scene.fog.color.set(activeTimePalette.fog);
  scene.fog.density = activeTimePalette.fogDensity;
  document.documentElement.style.setProperty("--sky-top", activeTimePalette.skyTop);
  document.documentElement.style.setProperty("--sky-middle", activeTimePalette.skyMiddle);
  document.documentElement.style.setProperty("--sky-bottom", activeTimePalette.skyBottom);
  document.documentElement.style.setProperty("--sky-glow", activeTimePalette.skyGlow);
  document.documentElement.style.setProperty("--sky-haze", activeTimePalette.skyHaze);

  if (!lightRig.hemisphere) return;
  lightRig.hemisphere.color.set(activeTimePalette.sun);
  lightRig.hemisphere.groundColor.set(activeTimePalette.ground);
  lightRig.hemisphere.intensity = activeTimePalette.ambientIntensity;
  lightRig.key.color.set(activeTimePalette.sun);
  lightRig.key.intensity = activeTimePalette.sunIntensity;
  lightRig.key.position.set(Math.cos(sunAngle) * 6, 1.8 + sunProgress * 7.5, Math.sin(sunAngle) * 5);
}

async function addGround() {
  environmentController = await addEzEnvironment(scene, root, resumeTreeData.seed);
}

function applyTreeWindShader(tree) {
  tree.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const materialsToPatch = Array.isArray(child.material) ? child.material : [child.material];
    const patchedMaterials = materialsToPatch.map((material) => {
      const patched = material.clone();
      const previousOnBeforeCompile = patched.onBeforeCompile;

      patched.onBeforeCompile = (shader) => {
        if (typeof previousOnBeforeCompile === "function") {
          previousOnBeforeCompile(shader);
        }

        shader.uniforms.uTreeWindDirection = { value: globalWind.direction };
        shader.uniforms.uTreeWindPhase = { value: 0 };
        shader.uniforms.uTreeWindStrength = { value: 0.055 };
        shader.uniforms.uTreeWindGust = { value: 1 };
        treeWindUniforms.push(shader.uniforms);

        shader.vertexShader = `
          uniform float uTreeWindDirection;
          uniform float uTreeWindPhase;
          uniform float uTreeWindStrength;
          uniform float uTreeWindGust;
        ${shader.vertexShader}`;

        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          `
          #include <begin_vertex>
          float treeWindHeight = smoothstep(1.15, 4.6, transformed.y);
          float treeWindOutward = smoothstep(0.48, 1.05, length(transformed.xz));
          float branchLeafResponse = treeWindHeight * treeWindOutward;
          float windWave = sin(uTreeWindPhase + transformed.y * 1.5 + transformed.x * 0.32 + transformed.z * 0.27);
          vec2 treeWindDirection = vec2(cos(uTreeWindDirection), sin(uTreeWindDirection));
          transformed.xz += treeWindDirection * windWave * branchLeafResponse * uTreeWindStrength * uTreeWindGust;
          `
        );
      };

      patched.needsUpdate = true;
      return patched;
    });

    child.material = Array.isArray(child.material) ? patchedMaterials : patchedMaterials[0];
  });
}

function updateTreeWind(seconds, wind) {
  treeWindUniforms.forEach((uniforms) => {
    uniforms.uTreeWindDirection.value = wind.direction;
    uniforms.uTreeWindPhase.value = seconds * wind.speed;
    uniforms.uTreeWindStrength.value = 0.055 * wind.strength;
    uniforms.uTreeWindGust.value = wind.gust;
  });
}

function addDirtPatches() {
  const patchGeometry = new THREE.CircleGeometry(1, 48);
  const patches = [
    { position: [0, -1.018, 3.0], scale: [1.9, 0.5, 1], rotation: 0.04 },
    { position: [-0.22, -1.017, 1.72], scale: [1.2, 0.34, 1], rotation: -0.18 },
    { position: [0.46, -1.016, 0.42], scale: [0.82, 0.26, 1], rotation: 0.22 },
    { position: [-2.2, -1.017, -1.72], scale: [0.95, 0.38, 1], rotation: 0.55 },
    { position: [2.25, -1.017, -1.94], scale: [1.02, 0.38, 1], rotation: -0.32 },
    { position: [-4.9, -1.018, 3.8], scale: [2.4, 0.62, 1], rotation: -0.42 },
    { position: [5.4, -1.018, 3.15], scale: [2.2, 0.52, 1], rotation: 0.28 }
  ];

  patches.forEach((patch) => {
    const mesh = new THREE.Mesh(patchGeometry, materials.soil);
    mesh.position.set(...patch.position);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = patch.rotation;
    mesh.scale.set(...patch.scale);
    root.add(mesh);
  });
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

function attachDiscoveryLabel(node, label) {
  node.userData.discoveryLabel = label;
}

function revealDiscoveryLabel(node) {
  labels.forEach((label) => {
    if (!label.userData.alwaysVisible) label.visible = false;
  });

  if (node?.userData.discoveryLabel) {
    node.userData.discoveryLabel.visible = true;
  }
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

    const rootNode = addNode("education", end.clone().add(new THREE.Vector3(0, 0.08, 0)), 0.07 + rootItem.weight * 0.065, materials.marker);
    const label = createTextLabel(rootItem.label, end.clone().add(new THREE.Vector3(0, 0.32, 0)), {
      scale: 0.24,
      fontSize: 34,
      maxWidth: 300,
      background: "rgba(255, 246, 219, 0.78)",
      visible: false
    });
    attachDiscoveryLabel(rootNode, label);
  });
}

function addTrunk() {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, 2.65, 11), materials.bark);
  trunk.position.y = 0.38;
  trunk.userData.type = "profile";
  root.add(trunk);

  addNaturalBarkLines();
  addTrunkSignboard();
}

function createSignboardFaceTexture(profile) {
  const width = 1024;
  const height = 640;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  const wood = context.createLinearGradient(0, 0, width, height);
  wood.addColorStop(0, "#e8c58a");
  wood.addColorStop(0.45, "#d2a66a");
  wood.addColorStop(1, "#b9844c");
  context.fillStyle = wood;
  context.fillRect(0, 0, width, height);

  for (let i = 0; i < 28; i += 1) {
    const y = 18 + i * 22;
    context.strokeStyle = `rgba(108, 68, 28, ${0.05 + (i % 3) * 0.025})`;
    context.lineWidth = 2 + (i % 2);
    context.beginPath();
    context.moveTo(20, y + Math.sin(i * 1.3) * 3);
    context.bezierCurveTo(width * 0.35, y + 4, width * 0.65, y - 4, width - 20, y + Math.cos(i) * 3);
    context.stroke();
  }

  context.strokeStyle = "rgba(78, 48, 22, 0.55)";
  context.lineWidth = 10;
  context.strokeRect(18, 18, width - 36, height - 36);

  context.fillStyle = "rgba(255, 244, 214, 0.22)";
  context.fillRect(42, 42, width - 84, height - 84);

  const lines = [
    { text: profile.name, size: 78, weight: 800, color: "#2d1c0f" },
    { text: profile.profession, size: 46, weight: 650, color: "#4a3218" },
    { text: profile.experienceLabel, size: 40, weight: 600, color: "#5b3a1c" },
    { text: profile.latestCompany, size: 44, weight: 700, color: "#3a2410" }
  ];

  let cursorY = 168;
  lines.forEach((line, index) => {
    context.font = `${line.weight} ${line.size}px "Segoe UI", "Helvetica Neue", sans-serif`;
    context.fillStyle = line.color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(line.text, width / 2, cursorY);
    cursorY += index === 0 ? 92 : 78;

    if (index === 0) {
      context.strokeStyle = "rgba(92, 58, 28, 0.35)";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(width * 0.22, cursorY - 42);
      context.lineTo(width * 0.78, cursorY - 42);
      context.stroke();
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
  return texture;
}

function getTrunkSignboardPlacement() {
  const scale = ezTree?.userData?.adapter?.scale || 0.13;
  const trunk = ezTree?.userData?.adapter?.skeletonBranches?.find((branch) => branch.level === 0);
  const sections = trunk?.sections || [];

  if (sections.length > 1) {
    const trunkBase = ezLocalToRoot(sections[0].origin);
    const trunkTip = ezLocalToRoot(sections[sections.length - 1].origin);
    // Domain laterals begin near 34% up the trunk. Keep the board on clear bark below that.
    const targetY = THREE.MathUtils.lerp(trunkBase.y, trunkTip.y, 0.28);
    let bestSection = sections[0];
    let bestDistance = Infinity;

    sections.forEach((section) => {
      const point = ezLocalToRoot(section.origin);
      const distance = Math.abs(point.y - targetY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSection = section;
      }
    });

    const center = ezLocalToRoot(bestSection.origin);
    const radius = Math.max(bestSection.radius * scale * 0.72, 0.08);
    return {
      center: new THREE.Vector3(center.x, targetY, center.z),
      attachPoint: new THREE.Vector3(center.x, targetY, center.z + radius),
      facing: new THREE.Vector3(0, 0, 1),
      debug: {
        targetY,
        trunkBaseY: trunkBase.y,
        trunkTipY: trunkTip.y,
        radius,
        sectionCount: sections.length
      }
    };
  }

  const boardY = 0.18;
  const center = getEzTrunkCenter(boardY);
  const radius = Math.max(trunkRadiusAt(boardY) * 0.7, 0.1);
  return {
    center: new THREE.Vector3(center.x, boardY, center.z),
    attachPoint: new THREE.Vector3(center.x, boardY, center.z + radius),
    facing: new THREE.Vector3(0, 0, 1),
    debug: { targetY: boardY, radius, fallback: true }
  };
}

function addTrunkSignboard() {
  const profile = resumeTreeData.profile;
  const placement = getTrunkSignboardPlacement();
  const boardWidth = useEzTreeSkeleton ? 0.5 : 0.95;
  const boardHeight = useEzTreeSkeleton ? 0.32 : 0.58;
  const boardDepth = 0.03;

  const faceTexture = createSignboardFaceTexture(profile);
  const faceMaterial = materials.signboard.clone();
  faceMaterial.map = faceTexture;
  faceMaterial.color.set(0xffffff);
  faceMaterial.needsUpdate = true;

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(boardWidth, boardHeight, boardDepth),
    [
      materials.signboardEdge,
      materials.signboardEdge,
      materials.signboardEdge,
      materials.signboardEdge,
      faceMaterial,
      materials.signboardEdge
    ]
  );

  const facing = placement.facing.clone().normalize();
  board.position.copy(placement.attachPoint).addScaledVector(facing, boardDepth * 0.5);
  board.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), facing);
  board.userData.type = "profile";
  board.userData.baseScale = board.scale.clone();
  board.userData.pulse = false;
  board.userData.signboard = true;
  board.userData.placementDebug = placement.debug;
  root.add(board);
  selectable.push(board);

  const nailGeometry = new THREE.CylinderGeometry(0.009, 0.013, 0.048, 10);
  const nailOffsets = [
    [-boardWidth * 0.34, boardHeight * 0.3, 0.01],
    [boardWidth * 0.34, boardHeight * 0.3, 0.01]
  ];

  nailOffsets.forEach(([x, y, z]) => {
    const localOffset = new THREE.Vector3(x, y, z).applyQuaternion(board.quaternion);
    const nail = new THREE.Mesh(nailGeometry, materials.nail);
    nail.quaternion.copy(board.quaternion);
    nail.rotateX(Math.PI / 2);
    nail.position.copy(board.position).add(localOffset);
    nail.userData.type = "profile";
    root.add(nail);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), materials.nail);
    head.position.copy(nail.position).addScaledVector(facing, 0.01);
    head.userData.type = "profile";
    root.add(head);
  });
}

function ezLocalToRoot(point) {
  if (!ezTree || !point) return new THREE.Vector3();
  const world = ezTree.localToWorld(point.clone());
  return root.worldToLocal(world);
}

function addEzDomainLabels() {
  const bindings = ezTree?.userData?.adapter?.domainBindings || [];
  bindings.forEach((binding) => {
    if (!binding.branch?.tip || !binding.domain) return;
    const tip = ezLocalToRoot(binding.branch.tip);
    const outward = tip.clone();
    outward.y = 0;
    if (outward.lengthSq() > 1e-6) outward.normalize();
    else outward.set(0, 0, 1);
    const labelPosition = tip.clone()
      .addScaledVector(outward, 0.22)
      .add(new THREE.Vector3(0, 0.14, 0));

    createTextLabel(binding.domain.label, labelPosition, {
      scale: 0.13 + binding.domain.weight * 0.05,
      fontSize: 26,
      maxWidth: 340,
      background: binding.domain.experienceType === "production"
        ? "rgba(255, 220, 147, 0.72)"
        : "rgba(255, 248, 216, 0.7)"
    });
  });
}

function addEzPortfolioDecorations() {
  addTrunkSignboard();
  addEzDomainLabels();
  addEzProjectPods();
}

function addEzProjectPods() {
  const bindings = ezTree?.userData?.adapter?.domainBindings || [];
  const bindingByDomain = new Map(bindings.map((binding) => [binding.domain.id, binding]));
  const fruitsByDomain = new Map();

  portfolioLayout.fruits.forEach((fruit) => {
    if (!fruitsByDomain.has(fruit.branch)) fruitsByDomain.set(fruit.branch, []);
    fruitsByDomain.get(fruit.branch).push(fruit);
  });

  portfolioLayout.fruits.forEach((fruit, index) => {
    const binding = bindingByDomain.get(fruit.branch);
    const siblings = fruitsByDomain.get(fruit.branch) || [fruit];
    const fruitIndex = Math.max(siblings.findIndex((entry) => entry.id === fruit.id), 0);
    const domainAnchor = getFruitAnchorForDomain(binding, fruitIndex, siblings.length);

    let hangPoint;
    let localAttachment;
    if (domainAnchor) {
      hangPoint = ezLocalToRoot(domainAnchor.position);
      localAttachment = ezLocalToRoot(domainAnchor.attachment);
    } else {
      hangPoint = getEzCanopyAnchor(index, fruit);
      localAttachment = getEzBranchAttachment(hangPoint);
    }

    const fruitHeight = THREE.MathUtils.clamp(fruit.radius * 2.15, 0.18, 0.27);
    const project = {
      ...fruit,
      height: fruitHeight,
      position: hangPoint.clone().add(new THREE.Vector3(0, -fruitHeight * 0.28, 0))
    };
    const podTop = project.position.clone().add(new THREE.Vector3(0, fruitHeight * 0.48, 0));

    if (localAttachment.distanceTo(podTop) <= 0.45) {
      const stemBend = localAttachment.clone().lerp(podTop, 0.5);
      addBranch(
        "projects",
        [localAttachment, stemBend, podTop],
        0.0045 + fruit.weight * 0.0018,
        getEzBranchMaterial()
      );
    }

    const fruitMeshes = addProjectFruitModel(project, index);
    const label = createTextLabel(project.label, project.position.clone().add(new THREE.Vector3(0, -fruitHeight * 0.64, 0.16)), {
      scale: 0.1 + fruit.weight * 0.018,
      fontSize: 22,
      maxWidth: 320,
      background: fruit.experienceType === "openSource" ? "rgba(215, 247, 255, 0.68)" : "rgba(255, 248, 216, 0.68)",
      visible: false
    });
    fruitMeshes.forEach((mesh) => attachDiscoveryLabel(mesh, label));
  });
}

function trunkRadiusAt(y) {
  const normalized = (y + 0.945) / 2.65;
  const radius = 0.46 + (0.38 - 0.46) * THREE.MathUtils.clamp(normalized, 0, 1);
  return useEzTreeSkeleton ? radius * (ezTree?.userData.adapter?.scale || 0.13) : radius;
}

function getTrunkSurfaceRadius(y, center = new THREE.Vector3()) {
  if (!useEzTreeSkeleton || !ezTreeAnchors?.bark?.length) {
    return Math.max(trunkRadiusAt(y), 0.18);
  }

  const nearby = ezTreeAnchors.bark.filter((point) => Math.abs(point.y - y) < 0.16);
  const samples = nearby.length > 0 ? nearby : ezTreeAnchors.bark;
  const radii = samples.map((point) => Math.hypot(point.x - center.x, point.z - center.z));
  const average = radii.reduce((sum, value) => sum + value, 0) / radii.length;
  return Math.max(average, trunkRadiusAt(y), 0.16);
}

function makeBarkRing(job, options = {}) {
  const points = [];
  const pointCount = 90;
  const baseRadius = trunkRadiusAt(job.y) + (options.offset || 0.026);
  const amplitude = options.amplitude || 0.018;
  const center = options.center || new THREE.Vector3();

  for (let i = 0; i < pointCount; i += 1) {
    const angle = (i / pointCount) * Math.PI * 2;
    const wobble = Math.sin(angle * 3 + job.weight * 5.1) * amplitude
      + Math.sin(angle * 7 + job.angle) * amplitude * 0.42;
    points.push(new THREE.Vector3(
      center.x + Math.cos(angle) * (baseRadius + wobble),
      job.y + Math.sin(angle * 2 + job.angle) * 0.018,
      center.z + Math.sin(angle) * (baseRadius * 0.78 + wobble * 0.5)
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
  const center = options.center || new THREE.Vector3();

  for (let i = 0; i < pointCount; i += 1) {
    const t = i / (pointCount - 1);
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, t);
    const wobble = Math.sin(t * Math.PI * 5 + job.angle) * 0.014;
    points.push(new THREE.Vector3(
      center.x + Math.cos(angle) * (baseRadius + wobble),
      job.y + Math.sin(t * Math.PI * 2 + job.weight) * 0.025,
      center.z + Math.sin(angle) * (baseRadius * 0.8)
    ));
  }

  const groove = tubeFromPoints(points, options.thickness || 0.018, options.material || materials.barkGroove, 34);
  groove.userData.type = "experience";
  root.add(groove);
  return groove;
}

function addNaturalBarkLines() {
  if (useEzTreeSkeleton) return;

  for (let i = 0; i < 8; i += 1) {
    const y = -0.72 + i * 0.27;
    const jobLike = {
      y,
      angle: i * 0.6,
      weight: 0.28 + i * 0.04
    };
    const center = getEzTrunkCenter(y);
    if (!useEzTreeSkeleton) {
      makeBarkRing(jobLike, {
        thickness: 0.005,
        amplitude: 0.01,
        offset: 0.014,
        material: i % 2 === 0 ? materials.barkDark : materials.barkHighlight,
        center
      });
    }

    if (i % 2 === 0) {
      makeFrontGroove(jobLike, {
        thickness: 0.006,
        offset: 0.038,
        material: materials.barkDark,
        center
      });
    }
  }
}

function addExperienceRings() {
  if (useEzTreeSkeleton) return;

  resumeTreeData.trunk.jobs.forEach((job) => {
    const ringThickness = 0.01 + job.weight * 0.017;
    const center = getEzTrunkCenter(job.y);
    if (!useEzTreeSkeleton) {
      makeBarkRing(job, {
        thickness: ringThickness,
        amplitude: 0.016 + job.weight * 0.012,
        offset: 0.035,
        material: job.id === "ltimindtree" ? materials.barkGroove : materials.barkDark,
        center
      });
      makeFrontGroove(job, {
        thickness: 0.016 + job.weight * 0.02,
        offset: 0.058,
        material: job.id === "ltimindtree" ? materials.barkGroove : materials.barkDark,
        center
      });

      makeFrontGroove(
        { ...job, y: job.y - 0.055, angle: job.angle + 0.9 },
        {
          thickness: 0.005 + job.weight * 0.006,
          offset: 0.062,
          material: materials.barkHighlight,
          center: getEzTrunkCenter(job.y - 0.055)
        }
      );
    }

    const frontRadius = trunkRadiusAt(job.y) + 0.12;
    const labelPosition = new THREE.Vector3(center.x, job.y + 0.08, center.z + frontRadius * 0.82);
    const label = createTextLabel(`${job.period} ${job.label}`, labelPosition, {
      scale: 0.12 + job.weight * 0.035,
      fontSize: 24,
      maxWidth: job.id === "ltimindtree" ? 430 : 340,
      color: "#3c2415",
      background: "rgba(255, 232, 177, 0.72)",
      border: "rgba(92, 55, 30, 0.12)",
      visible: false
    });

    const ringNode = addNode(
      "experience",
      new THREE.Vector3(
        center.x,
        job.y + 0.02,
        center.z + frontRadius * 0.78
      ),
      0.035 + job.weight * 0.055,
      job.id === "ltimindtree" ? materials.barkHighlight : materials.barkDark
    );
    attachDiscoveryLabel(ringNode, label);
  });

  const mainJob = resumeTreeData.trunk.jobs.find((job) => job.id === "ltimindtree") || resumeTreeData.trunk.jobs.at(-1);
  resumeTreeData.trunk.accomplishmentMarks.forEach((mark, index) => {
    const y = mainJob.y - 0.18 + index * 0.08;
    const radius = trunkRadiusAt(y) + 0.075;
    const center = getEzTrunkCenter(y);
    addNode(
      "profile",
      new THREE.Vector3(
        center.x,
        y,
        center.z + radius * 0.78
      ),
      0.035 + mark.weight * 0.035,
      materials.marker
    );
  });
}

let ezBranchStemMaterial = null;

function getEzBranchMaterial() {
  if (ezBranchStemMaterial) return ezBranchStemMaterial;
  const source = ezTree?.branchesMesh?.material;
  if (!source) return materials.bark;
  ezBranchStemMaterial = source.clone();
  ezBranchStemMaterial.side = THREE.DoubleSide;
  return ezBranchStemMaterial;
}

function addBranch(type, points, radius, material = materials.bark) {
  const branch = tubeFromPoints(points, radius, material, 42);
  branch.userData.type = type;
  root.add(branch);
  return branch;
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
      addBranch("projects", [stemStart, stemEnd], Math.max(0.01, fruit.radius * 0.1), getEzBranchMaterial());
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

function addProjectFruitModel(project, index) {
  const group = new THREE.Group();
  const fruit = projectFruitPrototype.clone(true);
  const bounds = new THREE.Box3().setFromObject(fruit);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const scale = project.height / Math.max(size.y, 0.001);
  fruit.position.copy(center).multiplyScalar(-scale);
  fruit.scale.setScalar(scale);
  fruit.rotation.y = index * 1.73;
  group.add(fruit);

  group.position.copy(project.position);
  group.userData.type = "projects";
  root.add(group);
  const meshes = [];
  fruit.traverse((child) => {
    if (!child.isMesh) return;
    child.userData.type = "projects";
    child.userData.baseScale = child.scale.clone();
    selectable.push(child);
    meshes.push(child);
  });
  return meshes;
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
  desiredPlayerPosition.set(focus.position.x, 0, focus.position.z);
  keepClearOfTrunk(desiredPlayerPosition);
  clampToRadius(desiredPlayerPosition, YARD_BOUNDS.softCameraRadius);
  desiredLookAt.copy(focus.lookAt || focus.target || focus.position);
  isPlayerNavigating = true;
}

function selectNode(node, source = "pointer") {
  selectedObject = node;
  revealDiscoveryLabel(selectedObject);
  if (shouldFocusCameraAfterSelection(source)) {
    focusNode(selectedObject.userData.type);
  }
}

function setWalkHintVisible(visible) {
  if (!walkHint) return;
  walkHint.dataset.visible = visible ? "true" : "false";
}

function bindUi() {
  setWalkHintVisible(true);

  controls.addEventListener("lock", () => {
    setWalkHintVisible(false);
    isPlayerNavigating = false;
  });

  controls.addEventListener("unlock", () => {
    setWalkHintVisible(true);
    Object.keys(moveKeys).forEach((key) => {
      moveKeys[key] = false;
    });
  });

  canvas.addEventListener("click", () => {
    if (!controls.isLocked) {
      controls.lock();
    }
  });

  window.addEventListener("keydown", (event) => {
    const key = event.code;
    if (key === "KeyW" || key === "ArrowUp") moveKeys.forward = true;
    if (key === "KeyS" || key === "ArrowDown") moveKeys.backward = true;
    if (key === "KeyA" || key === "ArrowLeft") moveKeys.left = true;
    if (key === "KeyD" || key === "ArrowRight") moveKeys.right = true;
    if (key === "ShiftLeft" || key === "ShiftRight") moveKeys.sprint = true;

    const keyMap = {
      Digit1: "education",
      Digit2: "profile",
      Digit3: "experience",
      Digit4: "skills",
      Digit5: "projects",
      Digit6: "contact"
    };
    if (keyMap[key]) {
      focusNode(keyMap[key]);
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(key)) {
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    const key = event.code;
    if (key === "KeyW" || key === "ArrowUp") moveKeys.forward = false;
    if (key === "KeyS" || key === "ArrowDown") moveKeys.backward = false;
    if (key === "KeyA" || key === "ArrowLeft") moveKeys.left = false;
    if (key === "KeyD" || key === "ArrowRight") moveKeys.right = false;
    if (key === "ShiftLeft" || key === "ShiftRight") moveKeys.sprint = false;
  });
}

function bindPicking() {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(0, 0);

  window.addEventListener("pointerdown", (event) => {
    if (!controls.isLocked) return;
    if (event.button !== 0) return;

    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(selectable, false)[0];
    if (!hit) return;
    selectNode(hit.object);
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

  const deltaSeconds = Math.min(0.05, (time - lastFrameTime) * 0.001 || 0.016);
  lastFrameTime = time;
  const seconds = time * 0.001;
  const wind = getGlobalWindState(seconds);
  if (seconds - lastTimePaletteRefresh >= 60) {
    applyTimeOfDay();
    lastTimePaletteRefresh = seconds;
  }
  if (environmentController) {
    environmentController.update(seconds, wind);
  }
  updateTreeWind(seconds, wind);
  updatePlayerMovement(deltaSeconds);

  selectable.forEach((node, index) => {
    if (node.userData.pulse === false) return;
    const pulse = node.userData.type === "projects" ? 1 : 1 + Math.sin(seconds * 2.6 + index) * 0.055;
    const selectedBoost = node === selectedObject ? 1.24 : 1;
    node.scale.copy(node.userData.baseScale || new THREE.Vector3(1, 1, 1)).multiplyScalar(pulse * selectedBoost);
  });

  enforceYardBounds();
  updateBoundaryFog();
  renderer.render(scene, camera);

  window.__portfolioTreeDebug = {
    frameCount,
    sceneChildren: scene.children.length,
    rootChildren: root.children.length,
    selectableNodes: selectable.length,
    triangles: renderer.info.render.triangles,
    generator: useEzTreeSkeleton ? "ez-tree" : "portfolio-layout",
    wind,
    ezTreeOptions,
    player: {
      locked: controls.isLocked,
      position: camera.position.toArray()
    },
    signboard: (() => {
      const board = root.children.find((child) => child.userData?.signboard);
      if (!board) return null;
      return {
        position: board.position.toArray(),
        placement: board.userData.placementDebug || null
      };
    })()
  };
}

// Scene bootstrap
addLights();
await addGround();
addCloud(new THREE.Vector3(-3.8, 5.8, -3.4), 0.95);
addCloud(new THREE.Vector3(3.6, 5.2, -2.8), 0.72);
addCloud(new THREE.Vector3(0.7, 6.4, -4.2), 0.58);
addRoots();
if (useEzTreeSkeleton) {
  await addEzTreeSkeleton();
  await loadProjectFruitModel();
  addEzPortfolioDecorations();
} else {
  addTrunk();
  addBranches();
  addLeaves();
  addFruits();
}
bindUi();
bindPicking();
setPlayerOnGround(0, 6.4);
camera.lookAt(0, 0.55, 0);
camera.rotation.order = "YXZ";

window.addEventListener("resize", handleResize);
animate();
