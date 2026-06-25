import * as THREE from "three";

function wrapLabelText(context, text, maxWidth) {
  return text.split("\n").flatMap((paragraph) => {
    const words = paragraph.split(" ");
    const lines = [];
    let line = "";

    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });

    if (line) {
      lines.push(line);
    }

    return lines;
  });
}

export function createTextLabel(root, labels, text, position, options = {}) {
  const fontSize = options.fontSize || 44;
  const paddingX = options.paddingX || 22;
  const paddingY = options.paddingY || 14;
  const maxWidth = options.maxWidth || 420;
  const color = options.color || "#2a2618";
  const background = options.background || "rgba(255, 248, 216, 0.84)";
  const border = options.border || "rgba(112, 83, 43, 0.22)";
  const scale = options.scale || 0.36;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;

  const lines = wrapLabelText(context, text, maxWidth);
  const measuredWidth = Math.max(...lines.map((value) => context.measureText(value).width));
  const textWidth = Math.min(maxWidth, measuredWidth);
  canvas.width = Math.ceil(textWidth + paddingX * 2);
  canvas.height = Math.ceil(lines.length * fontSize * 1.2 + paddingY * 2);

  context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.fillStyle = background;
  context.strokeStyle = border;
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(1.5, 1.5, canvas.width - 3, canvas.height - 3, 18);
  context.fill();
  context.stroke();

  context.fillStyle = color;
  lines.forEach((value, index) => {
    context.fillText(value, canvas.width / 2, paddingY + fontSize * 0.64 + index * fontSize * 1.2);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);
  sprite.scale.set((canvas.width / canvas.height) * scale, scale, 1);
  sprite.renderOrder = 20;

  root.add(sprite);
  labels.push(sprite);
  return sprite;
}
