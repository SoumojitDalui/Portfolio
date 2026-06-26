import * as THREE from "three";

const EZ_TREE_ASSET_BASE = "https://media.githubusercontent.com/media/dgreenheck/ez-tree/main/src/app/public/textures";
const EZ_TREE_TEXTURES = {
  barkColor: `${EZ_TREE_ASSET_BASE}/bark/Bark002_1K-JPG/Bark002_1K-JPG_Color.jpg`,
  barkNormal: `${EZ_TREE_ASSET_BASE}/bark/Bark002_1K-JPG/Bark002_1K-JPG_NormalGL.jpg`,
  barkRoughness: `${EZ_TREE_ASSET_BASE}/bark/Bark002_1K-JPG/Bark002_1K-JPG_Roughness.jpg`,
  dirtColor: `${EZ_TREE_ASSET_BASE}/ground/dirt_color.jpg`,
  dirtNormal: `${EZ_TREE_ASSET_BASE}/ground/dirt_normal.jpg`,
  grass: `${EZ_TREE_ASSET_BASE}/ground/grass.jpg`,
  leafOak: `${EZ_TREE_ASSET_BASE}/leaves/oak.png`
};

function createToonGradient() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1;

  const context = canvas.getContext("2d");
  ["#5f6f48", "#a4c66f", "#e5efaf", "#fff7cb"].forEach((color, index) => {
    context.fillStyle = color;
    context.fillRect(index, 0, 1, 1);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function loadEzTreeTexture(url, options = {}) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const texture = loader.load(url);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(options.repeatX || options.repeat || 1, options.repeatY || options.repeat || 1);
  if (options.color !== false) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  return texture;
}

function createPaintTexture(colors, options = {}) {
  const size = options.size || 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  context.fillStyle = colors[0];
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < (options.strokes || 180); i += 1) {
    const color = colors[1 + (i % (colors.length - 1))];
    const x = (i * 73) % size;
    const y = (i * 41) % size;
    const width = 10 + ((i * 29) % 44);
    const height = 2 + ((i * 17) % 9);
    const angle = ((i * 19) % 360) * (Math.PI / 180);

    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.globalAlpha = 0.14 + ((i * 7) % 28) / 100;
    context.fillStyle = color;
    context.beginPath();
    context.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  const image = context.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = (((i / 4) * 37) % 18) - 9;
    image.data[i] = Math.max(0, Math.min(255, image.data[i] + grain));
    image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + grain));
    image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + grain));
  }
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(options.repeat || 1, options.repeat || 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createMaterials() {
  const toonGradient = createToonGradient();
  const ezTextures = {
    barkColor: loadEzTreeTexture(EZ_TREE_TEXTURES.barkColor, { repeatX: 1.4, repeatY: 3.4 }),
    barkNormal: loadEzTreeTexture(EZ_TREE_TEXTURES.barkNormal, { color: false, repeatX: 1.4, repeatY: 3.4 }),
    barkRoughness: loadEzTreeTexture(EZ_TREE_TEXTURES.barkRoughness, { color: false, repeatX: 1.4, repeatY: 3.4 }),
    dirtColor: loadEzTreeTexture(EZ_TREE_TEXTURES.dirtColor, { repeat: 2.8 }),
    dirtNormal: loadEzTreeTexture(EZ_TREE_TEXTURES.dirtNormal, { color: false, repeat: 2.8 }),
    grass: loadEzTreeTexture(EZ_TREE_TEXTURES.grass, { repeat: 4.2 }),
    grassDense: loadEzTreeTexture(EZ_TREE_TEXTURES.grass, { repeat: 8 }),
    leafOak: loadEzTreeTexture(EZ_TREE_TEXTURES.leafOak, { repeat: 1 })
  };
  const paintTextures = {
    fruit: createPaintTexture(["#f5b247", "#ffd782", "#df8732", "#fff0a8"], { repeat: 1.6, strokes: 130 }),
    flower: createPaintTexture(["#ffc1d6", "#fff0f5", "#ff95bc", "#ffd8e8"], { repeat: 1.4, strokes: 90 })
  };

  const paintedMaterial = (options) => new THREE.MeshToonMaterial({
    gradientMap: toonGradient,
    ...options
  });
  const naturalMaterial = (options) => new THREE.MeshStandardMaterial({
    roughness: 0.86,
    metalness: 0,
    ...options
  });
  const barkMaterial = (color, options = {}) => naturalMaterial({
    color,
    map: ezTextures.barkColor,
    normalMap: ezTextures.barkNormal,
    roughnessMap: ezTextures.barkRoughness,
    normalScale: new THREE.Vector2(0.45, 0.45),
    ...options
  });

  return {
    bark: barkMaterial(0xffffff),
    barkDark: barkMaterial(0x7f6248),
    barkGroove: barkMaterial(0x6b4c36),
    barkHighlight: barkMaterial(0xd3a979),
    leaf: naturalMaterial({ color: 0xb8e879, map: ezTextures.leafOak, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide }),
    leafDark: naturalMaterial({ color: 0x86c96b, map: ezTextures.leafOak, transparent: true, alphaTest: 0.45, side: THREE.DoubleSide }),
    canopy: naturalMaterial({ color: 0xa8db72, map: ezTextures.leafOak }),
    canopyLight: naturalMaterial({ color: 0xc2ee82, map: ezTextures.leafOak }),
    root: barkMaterial(0xc98d55),
    fruit: paintedMaterial({ color: 0xf0a93a, emissive: 0x9b4b12, emissiveIntensity: 0.1 }),
    fruitAlt: paintedMaterial({ color: 0xe86988, emissive: 0x8d2441, emissiveIntensity: 0.08 }),
    fruitProduction: paintedMaterial({ color: 0xf2a236, emissive: 0x9f5013, emissiveIntensity: 0.1 }),
    fruitOpenSource: paintedMaterial({ color: 0x46b8d7, emissive: 0x18556d, emissiveIntensity: 0.08 }),
    fruitAcademic: paintedMaterial({ color: 0x8f78de, emissive: 0x382a85, emissiveIntensity: 0.08 }),
    fruitPrototype: paintedMaterial({ color: 0xd864ad, emissive: 0x7d245f, emissiveIntensity: 0.08 }),
    fruitPersonal: paintedMaterial({ color: 0xe5ad48, emissive: 0x7c4c13, emissiveIntensity: 0.08 }),
    marker: barkMaterial(0xd19a61),
    ground: naturalMaterial({ color: 0xe3efbb, map: ezTextures.grass, roughness: 0.92 }),
    groundRing: naturalMaterial({ color: 0x86b957, map: ezTextures.grass, roughness: 0.9 }),
    grass: naturalMaterial({
      color: 0xffffff,
      map: ezTextures.grassDense,
      side: THREE.DoubleSide,
      roughness: 0.96,
      vertexColors: true,
      emissive: 0x204816,
      emissiveIntensity: 0.04
    }),
    grassDark: naturalMaterial({
      color: 0xffffff,
      map: ezTextures.grassDense,
      side: THREE.DoubleSide,
      roughness: 0.96,
      vertexColors: true,
      emissive: 0x102c0a,
      emissiveIntensity: 0.03
    }),
    soil: naturalMaterial({ color: 0xffffff, map: ezTextures.dirtColor, normalMap: ezTextures.dirtNormal, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.94 }),
    cloud: paintedMaterial({ color: 0xfff6df }),
    flower: paintedMaterial({ color: 0xffc1d6, map: paintTextures.flower, emissive: 0xff95bc, emissiveIntensity: 0.14 }),
    flowerYellow: paintedMaterial({ color: 0xffdb62, emissive: 0xe9a300, emissiveIntensity: 0.14 })
  };
}
