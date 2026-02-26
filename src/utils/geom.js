import { randRange } from "./math.js";

/**
 * Planet avoidance (for stars, nebula positioning heuristics, etc.)
 */
export function pointInsideAnyPlanet(x, y, planets, marginMul) {
  for (const p of planets) {
    const rr = (p.r * marginMul) ** 2;
    const dx = x - p.cx;
    const dy = y - p.cy;
    if (dx * dx + dy * dy <= rr) return true;
  }
  return false;
}

export function pickNonOverlappingPosition(rng, W, H, r, planets, { margin, tries }) {
  for (let i = 0; i < tries; i++) {
    const x = randRange(rng, W * 0.10, W * 0.90);
    const y = randRange(rng, H * 0.10, H * 0.90);

    let ok = true;
    for (const p of planets) {
      const dx = x - p.cx;
      const dy = y - p.cy;
      const minD = (p.r + r) * margin;
      if (dx * dx + dy * dy < minD * minD) {
        ok = false;
        break;
      }
    }
    if (ok) return { x, y };
  }

  return { x: randRange(rng, W * 0.10, W * 0.90), y: randRange(rng, H * 0.10, H * 0.90) };
}

export function cubicBezierPoint(p0, c1, c2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x: uuu * p0.x + 3 * uu * t * c1.x + 3 * u * tt * c2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * c1.y + 3 * u * tt * c2.y + ttt * p3.y,
  };
}

export function curveHitsAnyPlanet(p0, c1, c2, p3, planets, marginMul) {
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const p = cubicBezierPoint(p0, c1, c2, p3, t);
    for (const pl of planets) {
      const rr = (pl.r * marginMul) ** 2;
      const dx = p.x - pl.cx;
      const dy = p.y - pl.cy;
      if (dx * dx + dy * dy <= rr) return true;
    }
  }
  return false;
}

export function pointOnEdge(rng, W, H, edge, entering) {
  const pad = entering ? -Math.max(W, H) * 0.08 : Math.max(W, H) * 1.08;
  if (edge === 0) return { x: pad, y: randRange(rng, H * 0.05, H * 0.95) }; // left
  if (edge === 1) return { x: W - pad, y: randRange(rng, H * 0.05, H * 0.95) }; // right
  if (edge === 2) return { x: randRange(rng, W * 0.05, W * 0.95), y: pad }; // top
  return { x: randRange(rng, W * 0.05, W * 0.95), y: H - pad }; // bottom
}

export function segmentHitsAnyPlanet(a, b, planets, marginMul) {
  for (const p of planets) {
    if (segmentHitsPlanet(a, b, p, p.r * marginMul)) return true;
  }
  return false;
}

function segmentHitsPlanet(a, b, planet, r) {
  const cx = planet.cx, cy = planet.cy;
  const x1 = a.x, y1 = a.y, x2 = b.x, y2 = b.y;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const rr = r * r;

  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const d2 = (x1 - cx) * (x1 - cx) + (y1 - cy) * (y1 - cy);
    return d2 <= rr;
  }

  let t = ((cx - x1) * dx + (cy - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  const dist2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
  return dist2 <= rr;
}
