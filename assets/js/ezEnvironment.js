import * as THREE from "three";

const EZ_TREE_MEDIA_BASE = "https://media.githubusercontent.com/media/dgreenheck/ez-tree/main/src/app/public";

const TEXTURES = {
  grass: `${EZ_TREE_MEDIA_BASE}/textures/ground/grass.jpg`,
  dirt: `${EZ_TREE_MEDIA_BASE}/textures/ground/dirt_color.jpg`,
  dirtNormal: `${EZ_TREE_MEDIA_BASE}/textures/ground/dirt_normal.jpg`
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

function createPerlinNoise2D(seed) {
  const random = randomFactory(`${seed}:perlin`);
  const permutation = Array.from({ length: 256 }, (_, index) => index);

  for (let i = permutation.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random(0, i + 1));
    [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
  }

  const p = [...permutation, ...permutation];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (hash, x, y) => {
    switch (hash & 3) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      default:
        return -x - y;
    }
  };

  return (x, y) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = p[p[xi] + yi];
    const ab = p[p[xi] + yi + 1];
    const ba = p[p[xi + 1] + yi];
    const bb = p[p[xi + 1] + yi + 1];
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);

    return 0.5 + 0.5 * lerp(x1, x2, v);
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

function createTriangleGrass(seed, grassTexture) {
  const random = randomFactory(`${seed}:triangle-glsl-grass`);
  const grassHeightNoise = createPerlinNoise2D(`${seed}:grass-height`);
  const bladeCount = 400000;
  const patchRadius = 34;
  const positions = [];
  const colors = [];
  const uvs = [];
  const yaws = [];
  const origins = [];
  const heights = [];
  const shades = [];
  const yaw = new THREE.Vector3();

  for (let i = 0; i < bladeCount; i += 1) {
    const radius = patchRadius * Math.pow(random(), 2.25);
    const angle = random(0, Math.PI * 2);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const bladeYaw = random(0, Math.PI * 2);
    yaw.set(Math.sin(bladeYaw), 0, -Math.cos(bladeYaw));
    const nearScale = THREE.MathUtils.clamp(1 - radius / (patchRadius * 1.6), 0.34, 1);
    const tallZone = 1 - THREE.MathUtils.smoothstep(radius, 9, 18);
    const edgeFade = 1 - THREE.MathUtils.smoothstep(radius, 20, patchRadius);
    const shortMin = 0.14;
    const shortMax = 0.32;
    const tallMin = 0.4;
    const tallMax = 0.98;
    const broadNoise = grassHeightNoise(x * 0.16, z * 0.16);
    const detailNoise = grassHeightNoise(x * 0.48 + 37.2, z * 0.48 - 18.6);
    const heightVariation = THREE.MathUtils.clamp(broadNoise * 0.78 + detailNoise * 0.22, 0, 1);
    const coherentHeightScale = THREE.MathUtils.lerp(0.34, 1, heightVariation);
    const fieldHeight = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(shortMin, tallMin, tallZone),
      THREE.MathUtils.lerp(shortMax, tallMax, tallZone),
      heightVariation
    ) * coherentHeightScale * nearScale * Math.max(edgeFade, 0.18);
    const treeDistance = Math.hypot(x, z);
    const trunkGrassBlend = THREE.MathUtils.smoothstep(treeDistance, 1.15, 4.8);
    const height = THREE.MathUtils.lerp(0.15, fieldHeight, trunkGrassBlend);
    const shade = random(0, 1);
    const uv = [
      THREE.MathUtils.mapLinear(x, -patchRadius, patchRadius, 0, 1),
      THREE.MathUtils.mapLinear(z, -patchRadius, patchRadius, 0, 1)
    ];

    [
      { role: [0.1, 0, 0], bladeUv: [0, 0] },
      { role: [0, 0, 0.1], bladeUv: [1, 0] },
      { role: [1, 1, 1], bladeUv: [0.5, 1] }
    ].forEach((vertex) => {
      positions.push(x, -0.99, z);
      colors.push(...vertex.role);
      uvs.push(uv[0] + vertex.bladeUv[0] * 0.004, uv[1] + vertex.bladeUv[1] * 0.004);
      yaws.push(yaw.x, yaw.y, yaw.z);
      origins.push(x, -0.99, z);
      heights.push(height);
      shades.push(shade);
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aYaw", new THREE.Float32BufferAttribute(yaws, 3));
  geometry.setAttribute("aBladeOrigin", new THREE.Float32BufferAttribute(origins, 3));
  geometry.setAttribute("aBladeHeight", new THREE.Float32BufferAttribute(heights, 1));
  geometry.setAttribute("aGrassShade", new THREE.Float32BufferAttribute(shades, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDiffuseMap: { value: grassTexture },
        uBladeWidth: { value: 0.052 },
        uWindDirection: { value: Math.PI * 0.25 },
        uWindSpeed: { value: 1.15 },
        uWindNoiseScale: { value: 1.75 },
        uWindStrength: { value: 1 },
        uWindGust: { value: 1 }
      }
    ]),
    vertexShader: `
      attribute vec3 aYaw;
      attribute vec3 aBladeOrigin;
      attribute float aBladeHeight;
      attribute float aGrassShade;
      uniform float uTime;
      uniform float uBladeWidth;
      uniform float uWindDirection;
      uniform float uWindSpeed;
      uniform float uWindNoiseScale;
      uniform float uWindStrength;
      uniform float uWindGust;
      varying vec2 vUv;
      varying float vTip;
      varying float vShade;
      varying float vDistanceFade;
      #include <fog_pars_vertex>

      void main() {
        vec3 transformed = aBladeOrigin;
        float side = color.r > 0.05 ? 1.0 : (color.b > 0.05 ? -1.0 : 0.0);
        float tip = step(0.9, color.g);
        float height = aBladeHeight * (0.82 + aGrassShade * 0.34);
        float width = uBladeWidth * (0.72 + aGrassShade * 0.58);

        transformed += aYaw * side * width * 0.5;
        transformed.y += tip * height;

        float windA = sin(uTime * uWindSpeed + dot(aBladeOrigin.xz, vec2(0.61, 0.37)) * uWindNoiseScale);
        float windB = cos(uTime * uWindSpeed * 1.43 + dot(aBladeOrigin.xz, vec2(-0.29, 0.71)) * uWindNoiseScale);
        vec3 windDirection = vec3(cos(uWindDirection), 0.0, sin(uWindDirection));
        transformed += windDirection * tip * (windA * 0.5 + windB * 0.5) * height * 0.18 * uWindStrength * uWindGust;

        vUv = uv;
        vTip = tip;
        vShade = aGrassShade;
    // Soften distant blades a bit earlier so the yard wall never reveals bare ground.
        float distanceFromCenter = length(aBladeOrigin.xz);
        vDistanceFade = 1.0 - smoothstep(8.0, 22.0, distanceFromCenter);
        vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform sampler2D uDiffuseMap;
      varying vec2 vUv;
      varying float vTip;
      varying float vShade;
      varying float vDistanceFade;
      #include <fog_pars_fragment>

      void main() {
        vec3 sampled = texture2D(uDiffuseMap, vUv * 18.0).rgb;
        vec3 shadowGreen = vec3(0.18, 0.34, 0.10);
        vec3 midGreen = vec3(0.35, 0.58, 0.18);
        vec3 tipGreen = vec3(0.72, 0.86, 0.42);
        vec3 bladeColor = mix(shadowGreen, midGreen, vShade);
        bladeColor = mix(bladeColor, tipGreen, vTip * 0.42);
        bladeColor *= mix(vec3(0.82), sampled * 1.22, 0.36);
        bladeColor = mix(bladeColor * 0.78, bladeColor, vDistanceFade);
        gl_FragColor = vec4(bladeColor, 1.0);
        #include <fog_fragment>
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    update(time, wind = {}) {
      material.uniforms.uTime.value = time;
      material.uniforms.uWindDirection.value = wind.direction ?? material.uniforms.uWindDirection.value;
      material.uniforms.uWindSpeed.value = wind.speed ?? material.uniforms.uWindSpeed.value;
      material.uniforms.uWindNoiseScale.value = wind.noiseScale ?? material.uniforms.uWindNoiseScale.value;
      material.uniforms.uWindStrength.value = wind.strength ?? material.uniforms.uWindStrength.value;
      material.uniforms.uWindGust.value = wind.gust ?? material.uniforms.uWindGust.value;
    }
  };
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
    patchiness: 0.84,
    grassTexture,
    dirtTexture
  });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.035;
  scene.add(ground);

  const grass = createTriangleGrass(seed, grassTexture);
  root.add(grass.mesh);
  return grass;
}
