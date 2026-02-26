// Fixed "INK" palette generator.
// All non-background colors stay in the blue family.

export const INK_PALETTE = {
  // warm paper-ish white (Canson-like)
  background: "#f6f1e6",

  // planets + nebulae range
  planetDark: "#00042e",
  planetLight: "#93ddfa",

  // traces (curves + constellations + rings) range
  traceDark: "#020d6e",
  traceLight: "#96a0f2",

  // stars
  star: "#0e044a",
};

export function lerpHex(a, b, t) {
  const A = hexToRgb01(a);
  const B = hexToRgb01(b);
  const x = clamp01(t);
  return rgbToHex(
    Math.round((A.r + (B.r - A.r) * x) * 255),
    Math.round((A.g + (B.g - A.g) * x) * 255),
    Math.round((A.b + (B.b - A.b) * x) * 255)
  );
}

export function pickPlanetColor(rng) {
  return lerpHex(INK_PALETTE.planetDark, INK_PALETTE.planetLight, rng.float());
}

export function pickTraceColor(rng) {
  return lerpHex(INK_PALETTE.traceDark, INK_PALETTE.traceLight, rng.float());
}

/**
 * 3 shades constrained in [dark..light] around a base t.
 * This is used by nebula sprays to keep every fill in the allowed range.
 */
export function pick3PlanetShades(rng) {
  const t = rng.float();
  const t0 = clamp01(t * 0.55);
  const t1 = clamp01(t);
  const t2 = clamp01(t + 0.28);
  return [
    lerpHex(INK_PALETTE.planetDark, INK_PALETTE.planetLight, t0),
    lerpHex(INK_PALETTE.planetDark, INK_PALETTE.planetLight, t1),
    lerpHex(INK_PALETTE.planetDark, INK_PALETTE.planetLight, t2),
  ];
}

// ---------- internals ----------

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hexToRgb01(hex) {
  const h = String(hex).replace("#", "").trim();
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(v, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

function rgbToHex(r, g, b) {
  const to = (x) => x.toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
