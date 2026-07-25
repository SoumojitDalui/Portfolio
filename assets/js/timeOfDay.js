const PALETTES = [
  {
    hour: 0,
    skyTop: "#16294b",
    skyMiddle: "#415b76",
    skyBottom: "#657882",
    skyGlow: "rgba(167, 189, 239, 0.22)",
    skyHaze: "rgba(103, 149, 158, 0.24)",
    fog: "#63747a",
    sun: "#b8c9ed",
    ground: "#506250",
    exposure: 0.78,
    sunIntensity: 0.45,
    ambientIntensity: 0.9,
    fogDensity: 0.065
  },
  {
    hour: 6,
    skyTop: "#6e9fc8",
    skyMiddle: "#f0b68c",
    skyBottom: "#d8ce9d",
    skyGlow: "rgba(255, 184, 111, 0.48)",
    skyHaze: "rgba(228, 225, 178, 0.32)",
    fog: "#c3c9ad",
    sun: "#ffca8f",
    ground: "#6e8d67",
    exposure: 0.88,
    sunIntensity: 1.25,
    ambientIntensity: 1.05,
    fogDensity: 0.073
  },
  {
    hour: 12,
    skyTop: "#9cdcf2",
    skyMiddle: "#d8f1d7",
    skyBottom: "#e5e7b4",
    skyGlow: "rgba(255, 228, 139, 0.34)",
    skyHaze: "rgba(159, 224, 181, 0.3)",
    fog: "#dff3d5",
    sun: "#ffefba",
    ground: "#8fcf79",
    exposure: 1.1,
    sunIntensity: 2.15,
    ambientIntensity: 1.8,
    fogDensity: 0.06
  },
  {
    hour: 18,
    skyTop: "#5a6fa6",
    skyMiddle: "#e79574",
    skyBottom: "#b98867",
    skyGlow: "rgba(255, 166, 101, 0.48)",
    skyHaze: "rgba(168, 117, 132, 0.27)",
    fog: "#a6948c",
    sun: "#ffad78",
    ground: "#68755d",
    exposure: 0.9,
    sunIntensity: 1.15,
    ambientIntensity: 1.05,
    fogDensity: 0.068
  },
  {
    hour: 24,
    skyTop: "#16294b",
    skyMiddle: "#415b76",
    skyBottom: "#657882",
    skyGlow: "rgba(167, 189, 239, 0.22)",
    skyHaze: "rgba(103, 149, 158, 0.24)",
    fog: "#63747a",
    sun: "#b8c9ed",
    ground: "#506250",
    exposure: 0.78,
    sunIntensity: 0.45,
    ambientIntensity: 0.9,
    fogDensity: 0.065
  }
];

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

function mixHex(left, right, amount) {
  const parse = (value) => Number.parseInt(value.slice(1), 16);
  const leftColor = parse(left);
  const rightColor = parse(right);
  const channel = (shift) => Math.round(
    ((leftColor >> shift) & 255) + (((rightColor >> shift) & 255) - ((leftColor >> shift) & 255)) * amount
  );
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, "0")).join("")}`;
}

function getHourInTimeZone(timeZone, date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) + Number(values.minute) / 60;
}

export function resolveTimeOfDay(search = "", date = new Date()) {
  const requestedTimeZone = new URLSearchParams(search).get("tz");
  const timeZone = requestedTimeZone && isValidTimeZone(requestedTimeZone)
    ? requestedTimeZone
    : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  return { timeZone, hour: getHourInTimeZone(timeZone, date) };
}

export function getTimePalette(hour) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const upperIndex = PALETTES.findIndex((palette) => palette.hour >= normalizedHour);
  const upper = upperIndex === -1 ? PALETTES.at(-1) : PALETTES[upperIndex];
  const lower = upperIndex <= 0 ? PALETTES[0] : PALETTES[upperIndex - 1];
  const range = Math.max(upper.hour - lower.hour, 1);
  const amount = (normalizedHour - lower.hour) / range;

  return {
    skyTop: mixHex(lower.skyTop, upper.skyTop, amount),
    skyMiddle: mixHex(lower.skyMiddle, upper.skyMiddle, amount),
    skyBottom: mixHex(lower.skyBottom, upper.skyBottom, amount),
    skyGlow: amount < 0.5 ? lower.skyGlow : upper.skyGlow,
    skyHaze: amount < 0.5 ? lower.skyHaze : upper.skyHaze,
    fog: mixHex(lower.skyMiddle, upper.skyMiddle, amount),
    sun: mixHex(lower.sun, upper.sun, amount),
    ground: mixHex(lower.ground, upper.ground, amount),
    exposure: lower.exposure + (upper.exposure - lower.exposure) * amount,
    sunIntensity: lower.sunIntensity + (upper.sunIntensity - lower.sunIntensity) * amount,
    ambientIntensity: lower.ambientIntensity + (upper.ambientIntensity - lower.ambientIntensity) * amount,
    fogDensity: lower.fogDensity + (upper.fogDensity - lower.fogDensity) * amount
  };
}
