import * as THREE from "three";

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
  const paintTextures = {
    bark: createPaintTexture(["#8f643f", "#b98250", "#6f472d", "#d1a06a"], { repeat: 1.2, strokes: 130 }),
    leaves: createPaintTexture(["#81c96e", "#aee27f", "#5ea961", "#d7ef9a"], { repeat: 2.4, strokes: 180 }),
    grass: createPaintTexture(["#91d66d", "#c6ec84", "#6fbd60", "#eff6a8"], { repeat: 4.5, strokes: 210 }),
    soil: createPaintTexture(["#856142", "#aa7b50", "#6e4d34", "#d6aa73"], { repeat: 2.2, strokes: 130 })
  };

  const paintedMaterial = (options) => new THREE.MeshToonMaterial({
    gradientMap: toonGradient,
    ...options
  });

  return {
    bark: paintedMaterial({ color: 0xa36a43, map: paintTextures.bark }),
    barkDark: paintedMaterial({ color: 0x765034, map: paintTextures.bark }),
    barkGroove: paintedMaterial({ color: 0x5d3924, map: paintTextures.bark }),
    barkHighlight: paintedMaterial({ color: 0xd19a61, map: paintTextures.bark }),
    leaf: paintedMaterial({ color: 0x9bdc75, map: paintTextures.leaves }),
    leafDark: paintedMaterial({ color: 0x6fbd64, map: paintTextures.leaves }),
    canopy: paintedMaterial({ color: 0x98d86b, map: paintTextures.leaves }),
    canopyLight: paintedMaterial({ color: 0xb7e77d, map: paintTextures.leaves }),
    root: paintedMaterial({ color: 0xc98d55, map: paintTextures.bark }),
    fruit: paintedMaterial({ color: 0xf0a93a, emissive: 0x9b4b12, emissiveIntensity: 0.1 }),
    fruitAlt: paintedMaterial({ color: 0xe86988, emissive: 0x8d2441, emissiveIntensity: 0.08 }),
    fruitProduction: paintedMaterial({ color: 0xf2a236, emissive: 0x9f5013, emissiveIntensity: 0.1 }),
    fruitOpenSource: paintedMaterial({ color: 0x46b8d7, emissive: 0x18556d, emissiveIntensity: 0.08 }),
    fruitAcademic: paintedMaterial({ color: 0x8f78de, emissive: 0x382a85, emissiveIntensity: 0.08 }),
    fruitPrototype: paintedMaterial({ color: 0xd864ad, emissive: 0x7d245f, emissiveIntensity: 0.08 }),
    fruitPersonal: paintedMaterial({ color: 0xe5ad48, emissive: 0x7c4c13, emissiveIntensity: 0.08 }),
    marker: paintedMaterial({ color: 0xd19a61, map: paintTextures.bark }),
    ground: paintedMaterial({ color: 0xa8dc71, map: paintTextures.grass }),
    groundRing: paintedMaterial({ color: 0x6aa84a, map: paintTextures.grass }),
    grass: paintedMaterial({ color: 0xb3e86e, map: paintTextures.grass, side: THREE.DoubleSide }),
    grassDark: paintedMaterial({ color: 0x74bf5c, map: paintTextures.grass, side: THREE.DoubleSide }),
    soil: paintedMaterial({ color: 0x9c704a, map: paintTextures.soil }),
    cloud: paintedMaterial({ color: 0xfff6df }),
    flower: paintedMaterial({ color: 0xffc1d6, emissive: 0xff95bc, emissiveIntensity: 0.14 })
  };
}
