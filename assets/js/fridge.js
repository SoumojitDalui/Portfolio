import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { fridgePortfolio } from "./fridgeData.js?v=fridge-1";
import { createMiniGameController, loadScores } from "./miniGames.js?v=fridge-1";

const canvas = document.querySelector("#fridge-scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfc9c4);
scene.fog = new THREE.Fog(0xbfc9c4, 12, 27);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(5.8, 2.2, 8.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.15, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 4.7;
controls.maxDistance = 12;
controls.minPolarAngle = 0.65;
controls.maxPolarAngle = 1.72;

const materials = {
  shell: new THREE.MeshStandardMaterial({ color: 0xdfe4df, roughness: 0.58, metalness: 0.38 }),
  shellEdge: new THREE.MeshStandardMaterial({ color: 0x9da8a6, roughness: 0.44, metalness: 0.6 }),
  interior: new THREE.MeshStandardMaterial({ color: 0xf5f1e7, roughness: 0.78 }),
  interiorDark: new THREE.MeshStandardMaterial({ color: 0xabb7b2, roughness: 0.72 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xc6e0df, roughness: 0.12, metalness: 0.04, transparent: true, opacity: 0.42 }),
  drawer: new THREE.MeshStandardMaterial({ color: 0xc5e2dc, roughness: 0.2, transparent: true, opacity: 0.58 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x283337, roughness: 0.72 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x30383a, roughness: 0.88 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb5bdba, roughness: 0.34, metalness: 0.76 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf5f0e3, roughness: 0.8 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x477d4f, roughness: 0.82 }),
  carrot: new THREE.MeshStandardMaterial({ color: 0xe47e32, roughness: 0.82 }),
  broccoli: new THREE.MeshStandardMaterial({ color: 0x41744a, roughness: 0.9 }),
  apple: new THREE.MeshStandardMaterial({ color: 0xc94d3e, roughness: 0.66 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xe69034, roughness: 0.82 }),
  grape: new THREE.MeshStandardMaterial({ color: 0x765184, roughness: 0.7 })
};

const interactive = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(2, 2);
const fridge = new THREE.Group();
scene.add(fridge);

let doorOpen = false;
let hovered = null;
let pointerStart = null;
let leaderboardTexture = null;

const sceneHint = document.querySelector("#scene-hint");
const infoPanel = document.querySelector("#info-panel");
const panelKicker = document.querySelector("#panel-kicker");
const panelTitle = document.querySelector("#panel-title");
const panelContent = document.querySelector("#panel-content");
const panelActions = document.querySelector("#panel-actions");

const miniGames = createMiniGameController({
  panel: document.querySelector("#game-panel"),
  canvas: document.querySelector("#game-canvas"),
  title: document.querySelector("#game-title"),
  kicker: document.querySelector("#game-kicker"),
  score: document.querySelector("#game-score"),
  instruction: document.querySelector("#game-instruction"),
  closeButton: document.querySelector("#close-game"),
  onScoresChanged: updateLeaderboard
});

function addMesh(geometry, material, position, parent = fridge) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeInteractive(object, action, hint) {
  object.userData.action = action;
  object.userData.hint = hint;
  interactive.push(object);
  return object;
}

function wrapText(context, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function createCanvasLabel({ width = 512, height = 256, background = "#fff0a8", color = "#263238", title, lines = [], align = "left" }) {
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = width;
  labelCanvas.height = height;
  const context = labelCanvas.getContext("2d");
  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  function draw(nextTitle = title, nextLines = lines) {
    context.clearRect(0, 0, width, height);
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(44,49,49,0.08)";
    for (let y = 18; y < height; y += 28) context.fillRect(0, y, width, 1);
    context.textAlign = align;
    context.textBaseline = "top";
    const x = align === "center" ? width / 2 : 42;
    context.fillStyle = color;
    context.font = `800 ${Math.round(height * 0.17)}px system-ui`;
    wrapText(context, nextTitle, width - 84).slice(0, 2).forEach((line, index) => {
      context.fillText(line, x, 32 + index * height * 0.17);
    });
    context.font = `600 ${Math.round(height * 0.1)}px system-ui`;
    nextLines.slice(0, 4).forEach((line, index) => {
      context.fillText(line, x, height * 0.52 + index * height * 0.12);
    });
    texture.needsUpdate = true;
  }

  draw();
  return { texture, draw };
}

function createLabelPlane(options, size, position, parent, action, hint) {
  const label = createCanvasLabel(options);
  const plane = addMesh(
    new THREE.PlaneGeometry(size.x, size.y),
    new THREE.MeshStandardMaterial({ map: label.texture, roughness: 0.86, side: THREE.DoubleSide }),
    position,
    parent
  );
  plane.castShadow = false;
  if (action) makeInteractive(plane, action, hint);
  return { plane, label };
}

function addMagnet(parent, position, color, action, hint) {
  const magnet = addMesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.055, 24),
    new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.38 }),
    position,
    parent
  );
  magnet.rotation.x = Math.PI / 2;
  if (action) makeInteractive(magnet, action, hint);
  return magnet;
}

function addRoom() {
  const floor = addMesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshStandardMaterial({ color: 0xa66d4f, roughness: 0.92 }), new THREE.Vector3(0, -2.66, 0), scene);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const wall = addMesh(new THREE.PlaneGeometry(36, 16), new THREE.MeshStandardMaterial({ color: 0xc6d0c9, roughness: 0.9 }), new THREE.Vector3(0, 4.6, -2.8), scene);
  wall.receiveShadow = true;
  addMesh(new THREE.BoxGeometry(36, 0.18, 0.12), new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.8 }), new THREE.Vector3(0, -2.55, -2.65), scene);

  for (let index = 0; index < 5; index += 1) {
    const tile = addMesh(new THREE.BoxGeometry(2.5, 0.025, 5), new THREE.MeshStandardMaterial({ color: index % 2 ? 0x9b6146 : 0xb57959, roughness: 0.94 }), new THREE.Vector3((index - 2) * 2.5, -2.64, 0.8), scene);
    tile.rotation.x = 0;
    tile.receiveShadow = true;
  }
}

function addFridgeCase() {
  addMesh(new THREE.BoxGeometry(2.82, 5.28, 0.16), materials.shell, new THREE.Vector3(0, 0, -0.85));
  addMesh(new THREE.BoxGeometry(0.22, 5.28, 1.75), materials.shell, new THREE.Vector3(-1.3, 0, -0.05));
  addMesh(new THREE.BoxGeometry(0.22, 5.28, 1.75), materials.shell, new THREE.Vector3(1.3, 0, -0.05));
  addMesh(new THREE.BoxGeometry(2.42, 0.2, 1.75), materials.shell, new THREE.Vector3(0, 2.54, -0.05));
  addMesh(new THREE.BoxGeometry(2.42, 0.2, 1.75), materials.shell, new THREE.Vector3(0, -2.54, -0.05));
  addMesh(new THREE.BoxGeometry(2.42, 4.86, 0.08), materials.interior, new THREE.Vector3(0, 0, -0.72));
  addMesh(new THREE.BoxGeometry(2.36, 0.14, 1.42), materials.interiorDark, new THREE.Vector3(0, 2.35, 0.18));
  addMesh(new THREE.BoxGeometry(2.36, 0.14, 1.42), materials.interiorDark, new THREE.Vector3(0, -2.35, 0.18));
  addMesh(new THREE.BoxGeometry(0.12, 4.8, 1.42), materials.interiorDark, new THREE.Vector3(-1.2, 0, 0.18));
  addMesh(new THREE.BoxGeometry(0.12, 4.8, 1.42), materials.interiorDark, new THREE.Vector3(1.2, 0, 0.18));

  [1.55, 0.65, -0.25, -1.12].forEach((y) => {
    addMesh(new THREE.BoxGeometry(2.25, 0.06, 1.38), materials.glass, new THREE.Vector3(0, y, 0.18));
  });
}

function addVegetable(group, position, kind, scale = 1) {
  if (kind === "carrot") {
    const carrot = addMesh(new THREE.ConeGeometry(0.11 * scale, 0.6 * scale, 12), materials.carrot, position, group);
    carrot.rotation.z = Math.PI * 0.5;
    const leaf = addMesh(new THREE.ConeGeometry(0.11 * scale, 0.3 * scale, 8), materials.leaf, position.clone().add(new THREE.Vector3(-0.4 * scale, 0, 0)), group);
    leaf.rotation.z = -Math.PI * 0.5;
  } else if (kind === "broccoli") {
    addMesh(new THREE.CylinderGeometry(0.07 * scale, 0.1 * scale, 0.42 * scale, 10), materials.leaf, position, group);
    for (let index = 0; index < 5; index += 1) {
      addMesh(new THREE.SphereGeometry(0.16 * scale, 12, 8), materials.broccoli, position.clone().add(new THREE.Vector3((index - 2) * 0.08 * scale, 0.23 * scale + Math.abs(index - 2) * -0.025, 0)), group);
    }
  } else {
    const pepper = addMesh(new THREE.SphereGeometry(0.2 * scale, 16, 12), new THREE.MeshStandardMaterial({ color: 0xc84d3f, roughness: 0.76 }), position, group);
    pepper.scale.set(1, 0.88, 0.86);
    addMesh(new THREE.CylinderGeometry(0.025, 0.035, 0.12, 8), materials.leaf, position.clone().add(new THREE.Vector3(0, 0.22 * scale, 0)), group);
  }
}

function addFruit(group, position, kind, scale = 1) {
  const material = kind === "orange" ? materials.orange : kind === "grape" ? materials.grape : materials.apple;
  if (kind === "grape") {
    for (let index = 0; index < 9; index += 1) {
      const row = Math.floor(index / 3);
      addMesh(new THREE.SphereGeometry(0.075 * scale, 12, 8), material, position.clone().add(new THREE.Vector3((index % 3 - 1) * 0.12 * scale, -row * 0.1 * scale, 0)), group);
    }
  } else {
    const fruit = addMesh(new THREE.SphereGeometry(0.2 * scale, 18, 12), material, position, group);
    fruit.scale.set(0.94, 1, 0.94);
    addMesh(new THREE.CylinderGeometry(0.018, 0.024, 0.12, 8), materials.dark, position.clone().add(new THREE.Vector3(0, 0.22 * scale, 0)), group);
  }
}

function addDrawers() {
  const drawers = [
    { x: -0.59, type: "veggie", title: "WORK VEG", subtitle: "technical experience" },
    { x: 0.59, type: "fruit", title: "ACADEMIC FRUIT", subtitle: "degrees + certificates" }
  ];

  drawers.forEach((drawerData, drawerIndex) => {
    const group = new THREE.Group();
    group.position.set(drawerData.x, -1.78, 0.12);
    group.userData.closedZ = 0.12;
    group.userData.openZ = 1.05;
    group.userData.open = false;
    fridge.add(group);

    const body = addMesh(new THREE.BoxGeometry(1.08, 0.88, 1.24), materials.drawer, new THREE.Vector3(0, 0, 0), group);
    const front = addMesh(new THREE.BoxGeometry(1.12, 0.84, 0.08), materials.glass, new THREE.Vector3(0, 0, 0.66), group);
    makeInteractive(front, { type: "drawer", drawer: drawerData.type, group }, `Pull ${drawerData.title.toLowerCase()} drawer`);

    createLabelPlane(
      { width: 480, height: 190, background: drawerData.type === "fruit" ? "#f4d4a0" : "#c9dfaa", title: drawerData.title, lines: [drawerData.subtitle], align: "center" },
      new THREE.Vector2(0.9, 0.36),
      new THREE.Vector3(0, -0.05, 0.715),
      group,
      { type: "drawer", drawer: drawerData.type, group },
      `Pull ${drawerData.title.toLowerCase()} drawer`
    );

    if (drawerIndex === 0) {
      addVegetable(group, new THREE.Vector3(-0.25, 0.08, 0.05), "carrot", 0.8);
      addVegetable(group, new THREE.Vector3(0.16, 0.04, -0.05), "broccoli", 0.75);
      addVegetable(group, new THREE.Vector3(0.3, 0.04, 0.24), "pepper", 0.72);
    } else {
      addFruit(group, new THREE.Vector3(-0.25, 0.04, 0.04), "apple", 0.82);
      addFruit(group, new THREE.Vector3(0.2, 0.02, 0.1), "orange", 0.78);
      addFruit(group, new THREE.Vector3(0.18, 0.2, -0.24), "grape", 0.72);
    }
  });
}

function addProjectContainer(project, shelf, index, y) {
  const group = new THREE.Group();
  const x = (index - 1) * 0.7;
  group.position.set(x, y + 0.2, 0.3 - Math.abs(index - 1) * 0.08);
  fridge.add(group);

  let body;
  if (shelf.cuisine === "Indian tiffin") {
    body = addMesh(new THREE.CylinderGeometry(0.26, 0.26, 0.32, 20), materials.metal, new THREE.Vector3(), group);
  } else if (shelf.cuisine === "Chinese takeout") {
    body = addMesh(new THREE.BoxGeometry(0.5, 0.42, 0.42), materials.white, new THREE.Vector3(), group);
    body.scale.set(0.82, 1, 0.82);
  } else if (shelf.cuisine === "Italian meal prep") {
    body = addMesh(new THREE.BoxGeometry(0.56, 0.24, 0.46), new THREE.MeshStandardMaterial({ color: shelf.color, roughness: 0.72 }), new THREE.Vector3(), group);
    addMesh(new THREE.BoxGeometry(0.5, 0.035, 0.4), materials.glass, new THREE.Vector3(0, 0.14, 0), group);
  } else {
    body = addMesh(new THREE.BoxGeometry(0.56, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0x364348, roughness: 0.7 }), new THREE.Vector3(), group);
    for (let segment = -1; segment <= 1; segment += 1) {
      addMesh(new THREE.BoxGeometry(0.12, 0.05, 0.28), new THREE.MeshStandardMaterial({ color: segment === 0 ? 0xd3b45f : 0x70a06d, roughness: 0.8 }), new THREE.Vector3(segment * 0.16, 0.14, 0), group);
    }
  }

  makeInteractive(body, { type: "project", project, shelf }, `Inspect ${project.label}`);
  createLabelPlane(
    { width: 420, height: 160, background: "#f6efdb", title: project.label, lines: [shelf.cuisine], align: "center" },
    new THREE.Vector2(0.52, 0.2),
    new THREE.Vector3(0, -0.03, 0.25),
    group,
    { type: "project", project, shelf },
    `Inspect ${project.label}`
  );
}

function addProjectShelves() {
  const shelfHeights = [1.73, 0.83, -0.07, -0.94];
  fridgePortfolio.shelves.forEach((shelf, shelfIndex) => {
    const y = shelfHeights[shelfIndex];
    createLabelPlane(
      { width: 560, height: 180, background: shelf.color, color: "#ffffff", title: shelf.domain, lines: [shelf.cuisine], align: "center" },
      new THREE.Vector2(1.28, 0.32),
      new THREE.Vector3(0, y + 0.38, -0.58),
      fridge
    );
    shelf.projects.forEach((project, index) => addProjectContainer(project, shelf, index, y));
  });
}

function addDoorShelf(parent, y, label, width = 2.12) {
  addMesh(new THREE.BoxGeometry(width, 0.08, 0.42), materials.interiorDark, new THREE.Vector3(1.36, y, -0.28), parent);
  addMesh(new THREE.BoxGeometry(width, 0.36, 0.07), materials.glass, new THREE.Vector3(1.36, y + 0.18, -0.48), parent);
  createLabelPlane(
    { width: 540, height: 140, background: "#edf0e9", title: label, lines: [], align: "center" },
    new THREE.Vector2(1.15, 0.25),
    new THREE.Vector3(1.36, y + 0.2, -0.52),
    parent
  ).plane.rotation.y = Math.PI;
}

function addDoor() {
  const pivot = new THREE.Group();
  pivot.position.set(-1.38, 0, 0.88);
  fridge.add(pivot);
  fridge.userData.door = pivot;

  const panel = addMesh(new THREE.BoxGeometry(2.72, 5.18, 0.18), materials.shell, new THREE.Vector3(1.36, 0, 0), pivot);
  makeInteractive(panel, { type: "door" }, "Open the fridge");
  addMesh(new THREE.BoxGeometry(0.06, 5.02, 0.06), materials.rubber, new THREE.Vector3(0.05, 0, -0.12), pivot);
  addMesh(new THREE.BoxGeometry(0.06, 5.02, 0.06), materials.rubber, new THREE.Vector3(2.67, 0, -0.12), pivot);

  const handle = addMesh(new THREE.CapsuleGeometry(0.065, 1.05, 8, 16), materials.shellEdge, new THREE.Vector3(2.42, 0.2, 0.22), pivot);
  makeInteractive(handle, { type: "door" }, "Open the fridge");

  createLabelPlane(
    { width: 600, height: 360, background: "#fff0a8", title: fridgePortfolio.profile.name, lines: [fridgePortfolio.profile.role, fridgePortfolio.profile.location] },
    new THREE.Vector2(1.72, 1.03),
    new THREE.Vector3(1.36, 1.45, 0.105),
    pivot,
    { type: "profile" },
    "Read profile note"
  );
  addMagnet(pivot, new THREE.Vector3(1.36, 1.95, 0.18), 0xd85045, { type: "profile" }, "Read profile note");

  const blogNote = createLabelPlane(
    { width: 430, height: 300, background: "#b8d8e8", title: "BLOG", lines: ["engineering notes"] },
    new THREE.Vector2(1.0, 0.7),
    new THREE.Vector3(0.93, 0.33, 0.105),
    pivot,
    { type: "blog" },
    "Open blog note"
  );
  blogNote.plane.rotation.z = -0.055;
  addMagnet(pivot, new THREE.Vector3(0.95, 0.66, 0.18), 0x3979a8, { type: "blog" }, "Open blog note");

  const contactNote = createLabelPlane(
    { width: 430, height: 300, background: "#f5c8c0", title: "CONTACT", lines: ["email · github · tree"] },
    new THREE.Vector2(1.05, 0.72),
    new THREE.Vector3(1.72, -0.49, 0.105),
    pivot,
    { type: "contact" },
    "Open contact note"
  );
  contactNote.plane.rotation.z = 0.045;
  addMagnet(pivot, new THREE.Vector3(1.72, -0.13, 0.18), 0xe2a743, { type: "contact" }, "Open contact note");

  const scores = loadScores();
  const board = createLabelPlane(
    { width: 620, height: 360, background: "#eef0e8", title: "LEADERBOARD", lines: [`Fruit Slice  ${scores.fruit}`, `Equal Cuts  ${scores.veggie}`] },
    new THREE.Vector2(1.86, 1.08),
    new THREE.Vector3(1.36, -1.65, 0.105),
    pivot,
    { type: "leaderboard" },
    "View mini-game scores"
  );
  leaderboardTexture = board.label;
  addMagnet(pivot, new THREE.Vector3(0.65, -1.16, 0.18), 0x3f7d58, { type: "leaderboard" }, "View mini-game scores");
  addMagnet(pivot, new THREE.Vector3(2.07, -1.16, 0.18), 0xd85045, { type: "leaderboard" }, "View mini-game scores");

  addDoorShelf(pivot, 1.4, "ODDS & ENDS · GACHA");
  const capsuleColors = [0xd75845, 0x3979a8, 0xe1ae46, 0x4d8b60, 0x865b94];
  capsuleColors.forEach((color, index) => {
    const capsule = addMesh(new THREE.CapsuleGeometry(0.105, 0.12, 5, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.46 }), new THREE.Vector3(0.72 + index * 0.32, 1.68 + (index % 2) * 0.05, -0.34), pivot);
    capsule.rotation.z = Math.PI / 2;
    makeInteractive(capsule, { type: "gacha" }, "Pull a random hobby");
  });

  addDoorShelf(pivot, 0.28, "BUILD YOUR OWN");
  const repoCarton = addMesh(new THREE.BoxGeometry(0.88, 0.66, 0.34), new THREE.MeshStandardMaterial({ color: 0x4b6c82, roughness: 0.75 }), new THREE.Vector3(1.36, 0.66, -0.31), pivot);
  makeInteractive(repoCarton, { type: "github" }, "Open the portfolio generator repository");
  const repoLabel = createLabelPlane(
    { width: 460, height: 250, background: "#dbe8ed", title: "GITHUB", lines: ["fork the fridge"], align: "center" },
    new THREE.Vector2(0.72, 0.42),
    new THREE.Vector3(1.36, 0.66, -0.5),
    pivot,
    { type: "github" },
    "Open the portfolio generator repository"
  );
  repoLabel.plane.rotation.y = Math.PI;
}

function addLighting() {
  scene.add(new THREE.HemisphereLight(0xe8f1ef, 0x765344, 2.1));
  const key = new THREE.DirectionalLight(0xfff1cf, 3.2);
  key.position.set(4, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -5;
  scene.add(key);

  const interior = new THREE.PointLight(0xfff1c2, 0, 6, 2);
  interior.position.set(0, 1.6, 1.25);
  scene.add(interior);
  fridge.userData.interiorLight = interior;
}

function clearPanel() {
  infoPanel.setAttribute("aria-hidden", "true");
}

function addDetailRows(items) {
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "detail-row";
    const strong = document.createElement("strong");
    strong.textContent = item.label || item.title;
    const detail = document.createElement("span");
    detail.textContent = item.detail || item.summary;
    row.append(strong, detail);
    panelContent.append(row);
  });
}

function addPanelAction({ label, href, onClick, primary = false }) {
  const element = href ? document.createElement("a") : document.createElement("button");
  element.className = `panel-action${primary ? " primary" : ""}`;
  element.textContent = label;
  if (href) {
    element.href = href;
    if (href.startsWith("http")) {
      element.target = "_blank";
      element.rel = "noreferrer";
    }
  } else {
    element.type = "button";
    element.addEventListener("click", onClick);
  }
  panelActions.append(element);
}

function showPanel({ kicker, title, text, rows = [], actions = [] }) {
  panelKicker.textContent = kicker;
  panelTitle.textContent = title;
  panelContent.replaceChildren();
  panelActions.replaceChildren();
  if (text) {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    panelContent.append(paragraph);
  }
  addDetailRows(rows);
  actions.forEach(addPanelAction);
  infoPanel.setAttribute("aria-hidden", "false");
}

function updateLeaderboard(scores = loadScores()) {
  leaderboardTexture?.draw("LEADERBOARD", [`Fruit Slice  ${scores.fruit}`, `Equal Cuts  ${scores.veggie}`]);
}

function showProfile() {
  showPanel({
    kicker: "On the door",
    title: fridgePortfolio.profile.name,
    text: `${fridgePortfolio.profile.role} based in ${fridgePortfolio.profile.location}. I build backend systems, web products, data workflows, and playful interactive software.`,
    actions: [
      { label: "Original tree", href: fridgePortfolio.profile.tree },
      { label: "GitHub", href: fridgePortfolio.profile.github, primary: true }
    ]
  });
}

function showBlog() {
  showPanel({ kicker: "Engineering notes", title: "Blog", rows: fridgePortfolio.blog });
}

function showContact() {
  showPanel({
    kicker: "Say hello",
    title: "Contact",
    text: "Open to thoughtful engineering conversations, internships, and product work in New York or remote.",
    actions: [
      { label: "Email", href: `mailto:${fridgePortfolio.profile.email}`, primary: true },
      { label: "GitHub", href: fridgePortfolio.profile.github },
      { label: "Tree portfolio", href: fridgePortfolio.profile.tree }
    ]
  });
}

function showLeaderboard() {
  const scores = loadScores();
  showPanel({
    kicker: "Freezer-door records",
    title: "Leaderboard",
    rows: [
      { label: `${scores.fruit} pts`, detail: "Fruit Slice · academic and certification drawer" },
      { label: `${scores.veggie} pts`, detail: "Equal Cuts · technical experience drawer" }
    ],
    actions: [
      { label: "Play Fruit Slice", onClick: () => { clearPanel(); miniGames.open("fruit"); }, primary: true },
      { label: "Play Equal Cuts", onClick: () => { clearPanel(); miniGames.open("veggie"); } }
    ]
  });
}

function showDrawer(type, group) {
  const isFruit = type === "fruit";
  const rows = isFruit ? fridgePortfolio.academics : fridgePortfolio.experience;
  showPanel({
    kicker: isFruit ? "Academic fruit drawer" : "Technical vegetable drawer",
    title: isFruit ? "Degrees & certifications" : "Production experience",
    rows,
    actions: [
      {
        label: isFruit ? "Play Fruit Slice" : "Play Equal Cuts",
        primary: true,
        onClick: () => { clearPanel(); miniGames.open(type); }
      },
      {
        label: group.userData.open ? "Push drawer in" : "Pull drawer out",
        onClick: () => { group.userData.open = !group.userData.open; clearPanel(); }
      }
    ]
  });
}

function showProject(project, shelf) {
  showPanel({
    kicker: `${shelf.domain} · ${shelf.cuisine}`,
    title: project.label,
    text: project.detail,
    rows: [{ label: project.stack, detail: "Ingredients / stack" }],
    actions: [{ label: "Open repository", href: project.url, primary: true }]
  });
}

function showGacha() {
  const hobby = fridgePortfolio.hobbies[Math.floor(Math.random() * fridgePortfolio.hobbies.length)];
  showPanel({
    kicker: "Gacha pull",
    title: hobby.label,
    text: hobby.detail,
    actions: [{ label: "Pull again", onClick: showGacha, primary: true }]
  });
}

function showGithub() {
  showPanel({
    kicker: "Build your own",
    title: "Portfolio Fridge",
    text: "The scene is driven by structured profile data so the notes, drawers, shelves, projects, and games can be replaced for another person.",
    actions: [{ label: "Open source repository", href: fridgePortfolio.profile.source, primary: true }]
  });
}

function handleAction(action) {
  if (!action) return;
  if (action.type === "door") {
    doorOpen = !doorOpen;
    const doorHint = doorOpen ? "Close the fridge" : "Open the fridge";
    interactive.forEach((object) => {
      if (object.userData.action?.type === "door") object.userData.hint = doorHint;
    });
    sceneHint.textContent = doorHint;
    if (!doorOpen) clearPanel();
  } else if (action.type === "profile") showProfile();
  else if (action.type === "blog") showBlog();
  else if (action.type === "contact") showContact();
  else if (action.type === "leaderboard") showLeaderboard();
  else if (action.type === "drawer") {
    action.group.userData.open = !action.group.userData.open;
    showDrawer(action.drawer, action.group);
  } else if (action.type === "project") showProject(action.project, action.shelf);
  else if (action.type === "gacha") showGacha();
  else if (action.type === "github") showGithub();
}

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(interactive, false)[0]?.object || null;
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  pointerStart = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener("pointerup", (event) => {
  if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 7) return;
  handleAction(pick(event)?.userData.action);
});

renderer.domElement.addEventListener("pointermove", (event) => {
  hovered = pick(event);
  renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
  sceneHint.textContent = hovered?.userData.hint || (doorOpen ? "Inspect a shelf, drawer, or door item" : "Drag to orbit · scroll to zoom");
  sceneHint.dataset.visible = hovered ? "true" : "false";
});

renderer.domElement.addEventListener("pointerleave", () => {
  hovered = null;
  sceneHint.dataset.visible = "false";
});

document.querySelector("#info-panel .close-button").addEventListener("click", clearPanel);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearPanel();
    miniGames.close();
  }
  if (event.key.toLowerCase() === "o") doorOpen = !doorOpen;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  const door = fridge.userData.door;
  door.rotation.y = THREE.MathUtils.damp(door.rotation.y, doorOpen ? -1.72 : 0, 5.2, delta);
  fridge.userData.interiorLight.intensity = THREE.MathUtils.damp(fridge.userData.interiorLight.intensity, doorOpen ? 5 : 0, 4.5, delta);

  fridge.children.forEach((child) => {
    if (child.userData.closedZ === undefined) return;
    child.position.z = THREE.MathUtils.damp(child.position.z, child.userData.open ? child.userData.openZ : child.userData.closedZ, 6, delta);
  });

  interactive.forEach((object) => {
    if (!object.userData.baseScale) object.userData.baseScale = object.scale.clone();
    const target = object === hovered ? 1.035 : 1;
    object.scale.lerp(object.userData.baseScale.clone().multiplyScalar(target), Math.min(1, delta * 10));
  });

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

addRoom();
addFridgeCase();
addProjectShelves();
addDrawers();
addDoor();
addLighting();
updateLeaderboard();
animate();
