export function randRange(rng, a, b) {
  return a + (b - a) * rng.float();
}

export function randInt(rng, a, b) {
  return rng.int(a, b);
}

export function clampInt(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
