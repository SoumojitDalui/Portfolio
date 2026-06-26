import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const EZ_TREE_RAW_BASE = "https://raw.githubusercontent.com/dgreenheck/ez-tree/main/src/app/public";
const EZ_TREE_MEDIA_BASE = "https://media.githubusercontent.com/media/dgreenheck/ez-tree/main/src/app/public";

const TEXTURES = {
  grass: `${EZ_TREE_MEDIA_BASE}/textures/ground/grass.jpg`,
  dirt: `${EZ_TREE_MEDIA_BASE}/textures/ground/dirt_color.jpg`,
  dirtNormal: `${EZ_TREE_MEDIA_BASE}/textures/ground/dirt_normal.jpg`
};

const MODELS = {
  grass: `${EZ_TREE_RAW_BASE}/models/grass.glb`,
  whiteFlower: `${EZ_TREE_RAW_BASE}/models/flower_white.glb`,
  blueFlower: `${EZ_TREE_RAW_BASE}/models/flower_blue.glb`,
  yellowFlower: `${EZ_TREE_RAW_BASE}/models/flower_yellow.glb`
};

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFactory(seed) {
  let value = hashString(seed);
  return (min = 0, max = 1) => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return min + (max - min) * unit;
  };
}

function loadTexture(url, options = {}) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const texture = loader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(options.repeat || 1, options.repeat || 1);
  if (options.color !== false) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

function addGroundShader(material, options) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNoiseScale = { value: options.noiseScale };
    shader.uniforms.uPatchiness = { value: options.patchiness };
    shader.uniforms.uGrassTexture = { value: options.grassTexture };
    shader.uniforms.uDirtTexture = { value: options.dirtTexture };

    shader.vertexShader = `varying vec2 vTerrainUv;\n${shader.vertexShader}`;
    shader.fragmentShader = `
      varying vec2 vTerrainUv;
      uniform float uNoiseScale;
      uniform float uPatchiness;
      uniform sampler2D uGrassTexture;
      uniform sampler2D uDirtTexture;
      ${shader.fragmentShader}
    `;

    shader.vertexShader = shader.vertexShader.replace("void main() {", "void main() { vTerrainUv = uv * 180.0;");

    shader.fragmentShader = shader.fragmentShader.replace(
      "void main() {",
      `
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
      float simplex2d(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }
      void main() {`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
      vec2 terrainUv = vTerrainUv;
      vec3 grassColor = texture2D(uGrassTexture, terrainUv / 30.0).rgb;
      vec3 dirtColor = texture2D(uDirtTexture, terrainUv / 30.0).rgb;
      float n = 0.5 + 0.5 * simplex2d(terrainUv / uNoiseScale);
      float s = smoothstep(uPatchiness - 0.1, uPatchiness + 0.1, n);
      vec4 sampledDiffuseColor = vec4(mix(grassColor, dirtColor, s), 1.0);
      diffuseColor *= sampledDiffuseColor;`
    );
  };
}

async function loadModel(url) {
  const loader = new GLTFLoader();
  loader.setCrossOrigin("anonymous");
  const gltf = await loader.loadAsync(url);
  let mesh = null;
  gltf.scene.traverse((child) => {
    if (!mesh && child.isMesh) mesh = child;
  });
  return mesh;
}

function addInstancedGrass(root, mesh, seed) {
  const random = randomFactory(`${seed}:ez-real-grass`);
  const sourceMaterial = mesh.material || new THREE.MeshBasicMaterial({ color: 0x74b84a });
  const material = new THREE.MeshPhongMaterial({
    map: sourceMaterial.map || null,
    color: 0x78a94a,
    emissive: new THREE.Color(0x306f25),
    emissiveIntensity: 0.05,
    alphaTest: 0.5,
    side: THREE.DoubleSide
  });

  const maxInstances = 9200;
  const grass = new THREE.InstancedMesh(mesh.geometry, material, maxInstances);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let count = 0;

  for (let i = 0; i < maxInstances; i += 1) {
    const radius = random(0.8, 18);
    const angle = random(0, Math.PI * 2);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const path = Math.abs(x * 0.18 + z - 2.2) < 0.35 && z > 0.2;
    if (path && random() > 0.35) continue;

    dummy.position.set(x, -1.0, z);
    dummy.rotation.set(0, random(0, Math.PI * 2), 0);
    const nearScale = THREE.MathUtils.clamp(1 - radius / 22, 0.45, 1);
    dummy.scale.set(
      random(0.0007, 0.0018) * nearScale,
      random(path ? 0.0012 : 0.0022, path ? 0.003 : 0.007) * nearScale,
      random(0.0007, 0.0018) * nearScale
    );
    dummy.updateMatrix();
    grass.setMatrixAt(count, dummy.matrix);
    color.setHSL(random(0.22, 0.32), random(0.5, 0.75), random(0.33, 0.52));
    grass.setColorAt(count, color);
    count += 1;
  }

  grass.count = count;
  grass.instanceMatrix.needsUpdate = true;
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
  root.add(grass);
}

function addFlowers(root, flowerMeshes, seed) {
  const random = randomFactory(`${seed}:ez-real-flowers`);
  for (let i = 0; i < 72; i += 1) {
    const source = flowerMeshes[i % flowerMeshes.length];
    if (!source) continue;
    const flower = source.clone();
    const radius = random(1.2, 14);
    const angle = random(0, Math.PI * 2);
    flower.position.set(Math.cos(angle) * radius, -0.99, Math.sin(angle) * radius);
    flower.rotation.y = random(0, Math.PI * 2);
    const scale = random(0.012, 0.026);
    flower.scale.setScalar(scale);
    root.add(flower);
  }
}

export async function addEzEnvironment(scene, root, seed) {
  const grassTexture = loadTexture(TEXTURES.grass);
  const dirtTexture = loadTexture(TEXTURES.dirt);
  const dirtNormal = loadTexture(TEXTURES.dirtNormal, { color: false });

  const groundMaterial = new THREE.MeshPhongMaterial({
    normalMap: dirtNormal,
    shininess: 0.1,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.01
  });
  addGroundShader(groundMaterial, {
    noiseScale: 26,
    patchiness: 0.64,
    grassTexture,
    dirtTexture
  });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.035;
  scene.add(ground);

  const [grassMesh, whiteFlower, blueFlower, yellowFlower] = await Promise.all([
    loadModel(MODELS.grass),
    loadModel(MODELS.whiteFlower).catch(() => null),
    loadModel(MODELS.blueFlower).catch(() => null),
    loadModel(MODELS.yellowFlower).catch(() => null)
  ]);

  addInstancedGrass(root, grassMesh, seed);
  addFlowers(root, [whiteFlower, blueFlower, yellowFlower].filter(Boolean), seed);
}
