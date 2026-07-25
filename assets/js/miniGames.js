const SCORE_KEY = "portfolio-fridge-scores";

export function loadScores() {
  try {
    return { fruit: 0, veggie: 0, ...JSON.parse(localStorage.getItem(SCORE_KEY) || "{}") };
  } catch {
    return { fruit: 0, veggie: 0 };
  }
}

function saveScore(type, score) {
  const scores = loadScores();
  scores[type] = Math.max(scores[type] || 0, Math.round(score));
  localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
  return scores;
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  const context = canvas.getContext("2d");
  context.setTransform(scale, 0, 0, scale, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export function createMiniGameController({ panel, canvas, title, kicker, score, instruction, closeButton, onScoresChanged }) {
  let activeGame = null;
  let frame = 0;
  let cleanup = () => {};

  function setScore(value) {
    score.textContent = String(Math.round(value));
  }

  function finish(type, value, message) {
    const scores = saveScore(type, value);
    instruction.textContent = `${message} Best: ${scores[type]} pts.`;
    onScoresChanged(scores);
  }

  function close() {
    cancelAnimationFrame(frame);
    cleanup();
    cleanup = () => {};
    activeGame = null;
    panel.setAttribute("aria-hidden", "true");
  }

  function open(type) {
    close();
    activeGame = type;
    panel.setAttribute("aria-hidden", "false");
    kicker.textContent = type === "fruit" ? "Academic drawer" : "Experience drawer";
    title.textContent = type === "fruit" ? "Fruit Slice" : "Equal Cuts";
    setScore(0);
    requestAnimationFrame(() => {
      if (activeGame !== type) return;
      if (type === "fruit") startFruitGame();
      else startVegetableGame();
    });
  }

  function startFruitGame() {
    const { context, width, height } = resizeCanvas(canvas);
    const fruits = [];
    const trails = [];
    const colors = ["#ed5b4f", "#f3b447", "#79ad5b", "#c6679e", "#f07b3f"];
    let points = 0;
    let elapsed = 0;
    let spawnClock = 0;
    let previousTime = performance.now();
    let pointerDown = false;
    let finished = false;

    instruction.textContent = "Drag through the fruit. Avoid the grey spoiled fruit.";

    function spawnFruit() {
      const spoiled = Math.random() < 0.16;
      fruits.push({
        x: width * (0.15 + Math.random() * 0.7),
        y: height + 30,
        vx: (Math.random() - 0.5) * 90,
        vy: -(height * (0.82 + Math.random() * 0.28)),
        radius: 18 + Math.random() * 10,
        color: spoiled ? "#697278" : colors[Math.floor(Math.random() * colors.length)],
        spoiled,
        sliced: false,
        rotation: Math.random() * Math.PI
      });
    }

    function pointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    function sliceAt(event) {
      if (!pointerDown || finished) return;
      const point = pointerPosition(event);
      trails.push({ ...point, life: 0.18 });
      fruits.forEach((fruit) => {
        if (fruit.sliced || Math.hypot(point.x - fruit.x, point.y - fruit.y) > fruit.radius * 1.2) return;
        fruit.sliced = true;
        points += fruit.spoiled ? -35 : 20;
        points = Math.max(0, points);
        setScore(points);
      });
    }

    const onPointerDown = (event) => {
      pointerDown = true;
      canvas.setPointerCapture?.(event.pointerId);
      sliceAt(event);
    };
    const onPointerMove = (event) => sliceAt(event);
    const onPointerUp = () => { pointerDown = false; };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    cleanup = () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };

    function drawFruit(fruit) {
      context.save();
      context.translate(fruit.x, fruit.y);
      context.rotate(fruit.rotation);
      context.fillStyle = fruit.color;
      context.beginPath();
      context.arc(0, 0, fruit.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = fruit.spoiled ? "#454c50" : "#41744a";
      context.fillRect(-2, -fruit.radius - 8, 4, 10);
      context.fillStyle = "rgba(255,255,255,0.28)";
      context.beginPath();
      context.arc(-fruit.radius * 0.3, -fruit.radius * 0.34, fruit.radius * 0.2, 0, Math.PI * 2);
      context.fill();
      if (fruit.sliced) {
        context.strokeStyle = "rgba(255,255,255,0.88)";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(-fruit.radius, fruit.radius * 0.55);
        context.lineTo(fruit.radius, -fruit.radius * 0.55);
        context.stroke();
      }
      context.restore();
    }

    function tick(now) {
      if (activeGame !== "fruit") return;
      const delta = Math.min((now - previousTime) / 1000, 0.035);
      previousTime = now;
      elapsed += delta;
      spawnClock += delta;
      if (spawnClock > 0.56 && elapsed < 20) {
        spawnClock = 0;
        spawnFruit();
      }

      context.clearRect(0, 0, width, height);
      context.fillStyle = "#1c2a2f";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 16; i += 1) {
        context.fillRect((i * 83) % width, (i * 47) % height, 2, 2);
      }

      fruits.forEach((fruit) => {
        fruit.vy += height * 1.15 * delta;
        fruit.x += fruit.vx * delta;
        fruit.y += fruit.vy * delta;
        fruit.rotation += delta * 1.4;
        drawFruit(fruit);
      });
      for (let index = fruits.length - 1; index >= 0; index -= 1) {
        if (fruits[index].y > height + 80) fruits.splice(index, 1);
      }

      trails.forEach((trail) => { trail.life -= delta; });
      context.strokeStyle = "rgba(255,255,255,0.7)";
      context.lineWidth = 3;
      context.beginPath();
      trails.filter((trail) => trail.life > 0).forEach((trail, index) => {
        if (index === 0) context.moveTo(trail.x, trail.y);
        else context.lineTo(trail.x, trail.y);
      });
      context.stroke();

      const remaining = Math.max(0, Math.ceil(20 - elapsed));
      instruction.textContent = remaining > 0
        ? `${remaining}s · Drag through fruit. Grey fruit costs 35 points.`
        : instruction.textContent;

      if (elapsed >= 20 && !finished) {
        finished = true;
        finish("fruit", points, "Time. Academic fruit packed away.");
        return;
      }
      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
  }

  function startVegetableGame() {
    const { context, width, height } = resizeCanvas(canvas);
    let round = 1;
    let points = 0;
    let cut = null;
    let locked = false;
    let frameTimeout = 0;
    const vegetables = [
      { name: "cucumber", color: "#5da56a" },
      { name: "carrot", color: "#e9823b" },
      { name: "eggplant", color: "#76528c" },
      { name: "zucchini", color: "#4f8652" },
      { name: "pepper", color: "#d95845" }
    ];

    instruction.textContent = "Click where you would cut the vegetable into two equal parts.";

    function draw() {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#1c2a2f";
      context.fillRect(0, 0, width, height);
      const vegetable = vegetables[round - 1];
      const vegWidth = Math.min(width * 0.68, 520);
      const vegHeight = Math.min(90, height * 0.25);
      const left = (width - vegWidth) / 2;
      const top = (height - vegHeight) / 2;

      context.fillStyle = "rgba(255,255,255,0.78)";
      context.font = "700 16px system-ui";
      context.textAlign = "center";
      context.fillText(`Round ${round}/5 · ${vegetable.name}`, width / 2, top - 34);

      context.fillStyle = vegetable.color;
      roundedRect(context, left, top, vegWidth, vegHeight, vegHeight / 2);
      context.fill();
      context.fillStyle = "rgba(255,255,255,0.18)";
      roundedRect(context, left + 14, top + 12, vegWidth - 28, 16, 8);
      context.fill();

      if (cut !== null) {
        const cutX = left + cut * vegWidth;
        context.strokeStyle = "#fff7de";
        context.lineWidth = 4;
        context.beginPath();
        context.moveTo(cutX, top - 16);
        context.lineTo(cutX, top + vegHeight + 16);
        context.stroke();

        const accuracy = Math.max(0, 1 - Math.abs(cut - 0.5) * 2);
        context.fillStyle = "rgba(255,255,255,0.9)";
        context.font = "800 22px system-ui";
        context.fillText(`${Math.round(accuracy * 100)}% equal`, width / 2, top + vegHeight + 54);
      }
    }

    function onCut(event) {
      if (locked) return;
      const rect = canvas.getBoundingClientRect();
      const vegWidth = Math.min(width * 0.68, 520);
      const left = (width - vegWidth) / 2;
      const x = event.clientX - rect.left;
      cut = Math.max(0, Math.min(1, (x - left) / vegWidth));
      const roundScore = Math.round(Math.max(0, 1 - Math.abs(cut - 0.5) * 2) * 100);
      points += roundScore;
      setScore(points);
      locked = true;
      draw();

      frameTimeout = window.setTimeout(() => {
        if (activeGame !== "veggie") return;
        if (round === 5) {
          finish("veggie", points, "Prep complete. Five vegetables portioned.");
          return;
        }
        round += 1;
        cut = null;
        locked = false;
        draw();
      }, 850);
    }

    canvas.addEventListener("pointerdown", onCut);
    cleanup = () => {
      canvas.removeEventListener("pointerdown", onCut);
      clearTimeout(frameTimeout);
    };
    draw();
  }

  closeButton.addEventListener("click", close);
  window.addEventListener("resize", () => {
    if (activeGame) open(activeGame);
  });

  return { open, close };
}
