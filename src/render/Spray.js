import { hexToRgba } from "../color/colors.js";
import { randInt, randRange } from "../utils/math.js";

/**
 * Spray primitives:
 * - alpha spray: for planet shading only
 * - opaque spray: for nebula (no transparency requirement)
 * - blotch/chunks: to create true dense “fills” in nebula
 */
export class Spray {
  static alpha(ctx, rng, cx, cy, radius, dots, hex, alpha) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = hexToRgba(hex, alpha);

    for (let i = 0; i < dots; i++) {
      const t = rng.float() * Math.PI * 2;
      const rr = Math.sqrt(rng.float()) * radius;
      const x = (cx + Math.cos(t) * rr) | 0;
      const y = (cy + Math.sin(t) * rr) | 0;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }

  /**
   * Async variant for progressive/recorded rendering.
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  static async alphaAsync(ctx, rng, cx, cy, radius, dots, hex, alpha, stepper) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = hexToRgba(hex, alpha);

    for (let i = 0; i < dots; i++) {
      const t = rng.float() * Math.PI * 2;
      const rr = Math.sqrt(rng.float()) * radius;
      const x = (cx + Math.cos(t) * rr) | 0;
      const y = (cy + Math.sin(t) * rr) | 0;
      ctx.fillRect(x, y, 1, 1);
      // group by a few pixels per frame (stepper decides)
      await stepper.tick(1);
    }
    ctx.restore();
  }

  static alphaClippedToCircle(ctx, rng, cx, cy, radius, dots, hex, alpha, clipCx, clipCy, clipR) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(clipCx, clipCy, clipR, 0, Math.PI * 2);
    ctx.clip();
    Spray.alpha(ctx, rng, cx, cy, radius, dots, hex, alpha);
    ctx.restore();
  }

  /**
   * Async variant for progressive/recorded rendering.
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  static async alphaClippedToCircleAsync(ctx, rng, cx, cy, radius, dots, hex, alpha, clipCx, clipCy, clipR, stepper) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(clipCx, clipCy, clipR, 0, Math.PI * 2);
    ctx.clip();
    await Spray.alphaAsync(ctx, rng, cx, cy, radius, dots, hex, alpha, stepper);
    ctx.restore();
  }

  static opaque(ctx, rng, cx, cy, radius, dots, shades) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < dots; i++) {
      const t = rng.float() * Math.PI * 2;
      const rr = Math.sqrt(rng.float()) * radius;
      const x = (cx + Math.cos(t) * rr) | 0;
      const y = (cy + Math.sin(t) * rr) | 0;
      ctx.fillStyle = shades[(rng.int(0, shades.length - 1)) | 0];
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  }

  /**
   * Async variant for progressive/recorded rendering.
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  static async opaqueAsync(ctx, rng, cx, cy, radius, dots, shades, stepper) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < dots; i++) {
      const t = rng.float() * Math.PI * 2;
      const rr = Math.sqrt(rng.float()) * radius;
      const x = (cx + Math.cos(t) * rr) | 0;
      const y = (cy + Math.sin(t) * rr) | 0;
      ctx.fillStyle = shades[(rng.int(0, shades.length - 1)) | 0];
      ctx.fillRect(x, y, 1, 1);
      await stepper.tick(1);
    }
    ctx.restore();
  }

  static chunkPixels(ctx, rng, cx, cy, radius, chunks, shades) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < chunks; i++) {
      const t = rng.float() * Math.PI * 2;
      const rr = Math.sqrt(rng.float()) * radius;
      const x = (cx + Math.cos(t) * rr) | 0;
      const y = (cy + Math.sin(t) * rr) | 0;
      const s = randInt(rng, 2, 6);
      ctx.fillStyle = shades[(rng.int(0, shades.length - 1)) | 0];
      ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }

  /**
   * Async variant for progressive/recorded rendering.
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  static async chunkPixelsAsync(ctx, rng, cx, cy, radius, chunks, shades, stepper) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < chunks; i++) {
      const t = rng.float() * Math.PI * 2;
      const rr = Math.sqrt(rng.float()) * radius;
      const x = (cx + Math.cos(t) * rr) | 0;
      const y = (cy + Math.sin(t) * rr) | 0;
      const s = randInt(rng, 2, 6);
      ctx.fillStyle = shades[(rng.int(0, shades.length - 1)) | 0];
      ctx.fillRect(x, y, s, s);
      await stepper.tick(1);
    }
    ctx.restore();
  }

  static blotch(ctx, rng, cx, cy, radius, shades) {
    const rx = radius * randRange(rng, 0.75, 1.15);
    const ry = radius * randRange(rng, 0.60, 1.10);
    const rot = randRange(rng, -0.8, 0.8);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = shades[(rng.int(0, shades.length - 1)) | 0];

    ctx.beginPath();
    ctx.ellipse(cx + randRange(rng, -2, 2), cy + randRange(rng, -2, 2), rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();

    const edgeDots = randInt(rng, 80, 220);
    for (let i = 0; i < edgeDots; i++) {
      const a = rng.float() * Math.PI * 2;
      const j = randRange(rng, -6, 10);
      const x = (cx + Math.cos(a) * (Math.max(rx, ry) + j)) | 0;
      const y = (cy + Math.sin(a) * (Math.max(rx, ry) + j)) | 0;
      const s = rng.bool(0.85) ? 1 : 2;
      ctx.fillRect(x, y, s, s);
    }

    ctx.restore();
  }

  /**
   * Async variant for progressive/recorded rendering.
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  static async blotchAsync(ctx, rng, cx, cy, radius, shades, stepper) {
    const rx = radius * randRange(rng, 0.75, 1.15);
    const ry = radius * randRange(rng, 0.60, 1.10);
    const rot = randRange(rng, -0.8, 0.8);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = shades[(rng.int(0, shades.length - 1)) | 0];

    ctx.beginPath();
    ctx.ellipse(cx + randRange(rng, -2, 2), cy + randRange(rng, -2, 2), rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
    await stepper.tick(1);

    const edgeDots = randInt(rng, 80, 220);
    for (let i = 0; i < edgeDots; i++) {
      const a = rng.float() * Math.PI * 2;
      const j = randRange(rng, -6, 10);
      const x = (cx + Math.cos(a) * (Math.max(rx, ry) + j)) | 0;
      const y = (cy + Math.sin(a) * (Math.max(rx, ry) + j)) | 0;
      const s = rng.bool(0.85) ? 1 : 2;
      ctx.fillRect(x, y, s, s);
      await stepper.tick(1);
    }

    ctx.restore();
  }

    /**
   * Opaque spray concentrated on an ellipse boundary, decaying with distance (exponential falloff).
   * Produces a "cloud rim" look (dense contour, sparse outside).
   */
  static opaqueEdgeFalloffEllipse(
    ctx,
    rng,
    cx,
    cy,
    rx,
    ry,
    rot,
    dots,
    shades,
    {
      falloff = 18,     // px: higher = wider cloud
      maxDist = 90,     // px: clamp distance from rim
      tangentJitter = 6, // px: smear along tangent
      inwardChance = 0.22, // some dots go slightly inside the ellipse
    } = {}
  ) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);

    for (let i = 0; i < dots; i++) {
      // pick a point on ellipse boundary (angle param)
      const a = rng.float() * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);

      // boundary point before rotation
      const bx0 = ca * rx;
      const by0 = sa * ry;

      // rotate boundary point
      const bx = cx + bx0 * cosR - by0 * sinR;
      const by = cy + bx0 * sinR + by0 * cosR;

      // outward normal approximation (gradient of implicit ellipse x^2/rx^2 + y^2/ry^2 = 1)
      // in local (unrotated) space: n0 = (ca/rx, sa/ry)
      let nx0 = ca / Math.max(rx, 1e-6);
      let ny0 = sa / Math.max(ry, 1e-6);

      // rotate normal
      let nx = nx0 * cosR - ny0 * sinR;
      let ny = nx0 * sinR + ny0 * cosR;

      // normalize
      const nLen = Math.hypot(nx, ny) || 1;
      nx /= nLen;
      ny /= nLen;

      // tangent (perpendicular)
      const tx = -ny;
      const ty = nx;

      // distance from rim: exponential distribution -> lots near 0, fewer far away
      // dist = -ln(U) * falloff, clamped
      const u = Math.max(1e-6, rng.float());
      let dist = -Math.log(u) * falloff;
      if (dist > maxDist) dist = maxDist;

      // sometimes go slightly inside
      if (rng.float() < inwardChance) dist *= -randRange(rng, 0.05, 0.45);

      const tJ = (rng.float() - 0.5) * 2 * tangentJitter;

      const x = (bx + nx * dist + tx * tJ) | 0;
      const y = (by + ny * dist + ty * tJ) | 0;

      ctx.fillStyle = shades[(rng.int(0, shades.length - 1)) | 0];
      ctx.fillRect(x, y, 1, 1);
    }

    ctx.restore();
  }

  /**
   * Async variant for progressive/recorded rendering.
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  static async opaqueEdgeFalloffEllipseAsync(
    ctx,
    rng,
    cx,
    cy,
    rx,
    ry,
    rot,
    dots,
    shades,
    stepper,
    {
      falloff = 18,
      maxDist = 90,
      tangentJitter = 6,
      inwardChance = 0.22,
      tickEvery = 64, // avoid await per pixel
    } = {}
  ) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);

    for (let i = 0; i < dots; i++) {
      const a = rng.float() * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);

      const bx0 = ca * rx;
      const by0 = sa * ry;

      const bx = cx + bx0 * cosR - by0 * sinR;
      const by = cy + bx0 * sinR + by0 * cosR;

      let nx0 = ca / Math.max(rx, 1e-6);
      let ny0 = sa / Math.max(ry, 1e-6);

      let nx = nx0 * cosR - ny0 * sinR;
      let ny = nx0 * sinR + ny0 * cosR;

      const nLen = Math.hypot(nx, ny) || 1;
      nx /= nLen;
      ny /= nLen;

      const tx = -ny;
      const ty = nx;

      const u = Math.max(1e-6, rng.float());
      let dist = -Math.log(u) * falloff;
      if (dist > maxDist) dist = maxDist;

      if (rng.float() < inwardChance) dist *= -randRange(rng, 0.05, 0.45);

      const tJ = (rng.float() - 0.5) * 2 * tangentJitter;

      const x = (bx + nx * dist + tx * tJ) | 0;
      const y = (by + ny * dist + ty * tJ) | 0;

      ctx.fillStyle = shades[(rng.int(0, shades.length - 1)) | 0];
      ctx.fillRect(x, y, 1, 1);

      if ((i & (tickEvery - 1)) === 0) await stepper.tick(1);
    }

    ctx.restore();
  }

}
