import { randInt, randRange } from "../utils/math.js";
import {
  pointInsideAnyPlanet,
  cubicBezierPoint,
  curveHitsAnyPlanet,
  pointOnEdge,
} from "../utils/geom.js";
import { Spray } from "./Spray.js";

/**
 * @typedef {Object} NebulaConfig
 * @property {(rng: { float: () => number, bool: (p?: number) => boolean }) => [string, string, string]} [pickShades]
 * @property {[number, number]} [cornerInnerDotsRange]
 */

/**
 * Single-nebula renderer used behind stars/planets.
 */
export class NebulaRenderer {
  /**
   * @param {NebulaConfig} [config]
   */
  constructor(config = {}) {
    this.pickShades = config.pickShades ?? (() => ["#444444", "#666666", "#888888"]);
    this.cornerInnerDotsRange = config.cornerInnerDotsRange ?? [2400, 4800];
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {number} width
   * @param {number} height
   * @param {Array<{ cx: number, cy: number, r: number }>} planets
   * @param {{ cx: number, cy: number, r: number }} mainPlanet
   * @param {number} nebulaChance
   */
  drawSingle(ctx, rng, width, height, planets, mainPlanet, nebulaChance) {
    if (!rng.bool(nebulaChance)) return;

    const shades = this.pickShades(rng);
    const kind = weightedPick(rng, [
      ["trail", 0.3],
      ["disk", 0.32],
      ["corner", 0.33],
      ["behindMain", 0.05],
    ]);

    if (kind === "trail") {
      this.#trailDense(ctx, rng, width, height, planets, shades);
      return;
    }

    if (kind === "disk") {
      const planet = planets[(rng.float() * planets.length) | 0];
      this.#accretionDiskDense(ctx, rng, planet, shades);
      return;
    }

    if (kind === "corner") {
      this.#cornerCloudDense(ctx, rng, width, height, planets, shades);
      return;
    }

    this.#behindMainGlowDense(ctx, rng, mainPlanet, shades);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {number} width
   * @param {number} height
   * @param {Array<{ cx: number, cy: number, r: number }>} planets
   * @param {{ cx: number, cy: number, r: number }} mainPlanet
   * @param {number} nebulaChance
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async drawSingleAsync(ctx, rng, width, height, planets, mainPlanet, nebulaChance, stepper) {
    if (!rng.bool(nebulaChance)) return;

    const shades = this.pickShades(rng);
    const kind = weightedPick(rng, [
      ["trail", 0.3],
      ["disk", 0.32],
      ["corner", 0.33],
      ["behindMain", 0.05],
    ]);

    if (kind === "trail") {
      await this.#trailDenseAsync(ctx, rng, width, height, planets, shades, stepper);
      return;
    }

    if (kind === "disk") {
      const planet = planets[(rng.float() * planets.length) | 0];
      await this.#accretionDiskDenseAsync(ctx, rng, planet, shades, stepper);
      return;
    }

    if (kind === "corner") {
      await this.#cornerCloudDenseAsync(ctx, rng, width, height, planets, shades, stepper);
      return;
    }

    await this.#behindMainGlowDenseAsync(ctx, rng, mainPlanet, shades, stepper);
  }

  #trailDense(ctx, rng, width, height, planets, shades) {
    const edgeIn = (rng.float() * 4) | 0;
    const edgeOut = (rng.float() * 4) | 0;

    const p0 = pointOnEdge(rng, width, height, edgeIn, true);
    const p3 = pointOnEdge(rng, width, height, edgeOut, false);

    const c1 = {
      x: randRange(rng, width * 0.15, width * 0.85),
      y: randRange(rng, height * 0.15, height * 0.85),
    };

    const c2 = {
      x: randRange(rng, width * 0.15, width * 0.85),
      y: randRange(rng, height * 0.15, height * 0.85),
    };

    for (let tries = 0; tries < 6; tries++) {
      if (!curveHitsAnyPlanet(p0, c1, c2, p3, planets, 1.1)) break;
      c1.x = randRange(rng, width * 0.15, width * 0.85);
      c1.y = randRange(rng, height * 0.15, height * 0.85);
      c2.x = randRange(rng, width * 0.15, width * 0.85);
      c2.y = randRange(rng, height * 0.15, height * 0.85);
    }

    const samples = randInt(rng, 32, 70);
    const baseRadius = randRange(rng, 12, 30);
    const every = randInt(rng, 4, 7);

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = cubicBezierPoint(p0, c1, c2, p3, t);

      const wobble = 0.75 + 0.65 * Math.sin(t * Math.PI);
      const radius = baseRadius * wobble;

      Spray.opaque(ctx, rng, point.x, point.y, radius, randInt(rng, 520, 1040), shades);

      if (i % every === 0) {
        Spray.blotch(ctx, rng, point.x, point.y, radius * randRange(rng, 0.6, 0.95), shades);
        Spray.chunkPixels(ctx, rng, point.x, point.y, radius * 0.55, randInt(rng, 18, 45), shades);
      }
    }
  }

  async #trailDenseAsync(ctx, rng, width, height, planets, shades, stepper) {
    const edgeIn = (rng.float() * 4) | 0;
    const edgeOut = (rng.float() * 4) | 0;

    const p0 = pointOnEdge(rng, width, height, edgeIn, true);
    const p3 = pointOnEdge(rng, width, height, edgeOut, false);

    const c1 = {
      x: randRange(rng, width * 0.15, width * 0.85),
      y: randRange(rng, height * 0.15, height * 0.85),
    };

    const c2 = {
      x: randRange(rng, width * 0.15, width * 0.85),
      y: randRange(rng, height * 0.15, height * 0.85),
    };

    for (let tries = 0; tries < 6; tries++) {
      if (!curveHitsAnyPlanet(p0, c1, c2, p3, planets, 1.1)) break;
      c1.x = randRange(rng, width * 0.15, width * 0.85);
      c1.y = randRange(rng, height * 0.15, height * 0.85);
      c2.x = randRange(rng, width * 0.15, width * 0.85);
      c2.y = randRange(rng, height * 0.15, height * 0.85);
    }

    const samples = randInt(rng, 32, 70);
    const baseRadius = randRange(rng, 12, 30);
    const every = randInt(rng, 4, 7);

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const point = cubicBezierPoint(p0, c1, c2, p3, t);

      const wobble = 0.75 + 0.65 * Math.sin(t * Math.PI);
      const radius = baseRadius * wobble;

      await Spray.opaqueAsync(ctx, rng, point.x, point.y, radius, randInt(rng, 220, 520), shades, stepper);

      if (i % every === 0) {
        await Spray.blotchAsync(
          ctx,
          rng,
          point.x,
          point.y,
          radius * randRange(rng, 0.6, 0.95),
          shades,
          stepper
        );

        await Spray.chunkPixelsAsync(
          ctx,
          rng,
          point.x,
          point.y,
          radius * 0.55,
          randInt(rng, 18, 45),
          shades,
          stepper
        );
      }

      await stepper.tick(1);
    }
  }

  #accretionDiskDense(ctx, rng, planet, shades) {
    const { cx, cy, r } = planet;

    const rx = r * randRange(rng, 1.25, 2.1);
    const ry = r * randRange(rng, 0.45, 0.95);
    const rotation = randRange(rng, -0.9, 0.9);

    const points = randInt(rng, 420, 900);
    const thickness = randRange(rng, 14, 34);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;

      const ellipseX = Math.cos(angle) * rx;
      const ellipseY = Math.sin(angle) * ry;

      const x = cx + ellipseX * Math.cos(rotation) - ellipseY * Math.sin(rotation);
      const y = cy + ellipseX * Math.sin(rotation) + ellipseY * Math.cos(rotation);

      const jitter = (rng.float() - 0.5) * thickness;
      const px = x + jitter * Math.cos(angle + rotation);
      const py = y + jitter * Math.sin(angle + rotation);

      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy < (r * 0.98) * (r * 0.98) && rng.bool(0.88)) continue;

      ctx.fillStyle = shades[(rng.int(0, 2)) | 0];
      ctx.fillRect(px | 0, py | 0, 1, 1);
    }

    const arcs = randInt(rng, 2, 4);
    for (let i = 0; i < arcs; i++) {
      const arcStart = randRange(rng, 0, Math.PI * 2);
      const arcSpan = randRange(rng, Math.PI * 0.25, Math.PI * 0.55);
      const steps = randInt(rng, 18, 34);

      for (let step = 0; step <= steps; step++) {
        const angle = arcStart + (arcSpan * step) / steps;

        const ellipseX = Math.cos(angle) * rx;
        const ellipseY = Math.sin(angle) * ry;

        const x = cx + ellipseX * Math.cos(rotation) - ellipseY * Math.sin(rotation);
        const y = cy + ellipseX * Math.sin(rotation) + ellipseY * Math.cos(rotation);

        Spray.blotch(ctx, rng, x, y, randRange(rng, 10, 22), [shades[1], shades[2], shades[2]]);
      }
    }

    ctx.restore();
  }

  async #accretionDiskDenseAsync(ctx, rng, planet, shades, stepper) {
    const { cx, cy, r } = planet;

    const rx = r * randRange(rng, 1.25, 2.1);
    const ry = r * randRange(rng, 0.45, 0.95);
    const rotation = randRange(rng, -0.9, 0.9);

    const points = randInt(rng, 420, 900);
    const thickness = randRange(rng, 14, 34);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;

      const ellipseX = Math.cos(angle) * rx;
      const ellipseY = Math.sin(angle) * ry;

      const x = cx + ellipseX * Math.cos(rotation) - ellipseY * Math.sin(rotation);
      const y = cy + ellipseX * Math.sin(rotation) + ellipseY * Math.cos(rotation);

      const jitter = (rng.float() - 0.5) * thickness;
      const px = x + jitter * Math.cos(angle + rotation);
      const py = y + jitter * Math.sin(angle + rotation);

      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy < (r * 0.98) * (r * 0.98) && rng.bool(0.88)) continue;

      ctx.fillStyle = shades[(rng.int(0, 2)) | 0];
      ctx.fillRect(px | 0, py | 0, 1, 1);
      await stepper.tick(1);
    }

    const arcs = randInt(rng, 2, 4);
    for (let i = 0; i < arcs; i++) {
      const arcStart = randRange(rng, 0, Math.PI * 2);
      const arcSpan = randRange(rng, Math.PI * 0.25, Math.PI * 0.55);
      const steps = randInt(rng, 18, 34);

      for (let step = 0; step <= steps; step++) {
        const angle = arcStart + (arcSpan * step) / steps;

        const ellipseX = Math.cos(angle) * rx;
        const ellipseY = Math.sin(angle) * ry;

        const x = cx + ellipseX * Math.cos(rotation) - ellipseY * Math.sin(rotation);
        const y = cy + ellipseX * Math.sin(rotation) + ellipseY * Math.cos(rotation);

        await Spray.blotchAsync(
          ctx,
          rng,
          x,
          y,
          randRange(rng, 10, 22),
          [shades[1], shades[2], shades[2]],
          stepper
        );
      }
    }

    ctx.restore();
  }

  #cornerCloudDense(ctx, rng, width, height, planets, shades) {
    const corner = (rng.float() * 4) | 0;

    const padX = width * 0.12;
    const padY = height * 0.12;

    let cx = padX;
    let cy = padY;

    if (corner === 1) {
      cx = width - padX;
      cy = padY;
    }
    if (corner === 2) {
      cx = padX;
      cy = height - padY;
    }
    if (corner === 3) {
      cx = width - padX;
      cy = height - padY;
    }

    cx += randRange(rng, -width * 0.05, width * 0.05);
    cy += randRange(rng, -height * 0.05, height * 0.05);

    if (pointInsideAnyPlanet(cx, cy, planets, 1.35)) return;

    const radius = Math.min(width, height) * randRange(rng, 0.16, 0.28);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    const lobes = randInt(rng, 2, 4);
    for (let i = 0; i < lobes; i++) {
      const ox = cx + randRange(rng, -radius * 0.4, radius * 0.4);
      const oy = cy + randRange(rng, -radius * 0.4, radius * 0.4);

      const rx = radius * randRange(rng, 0.45, 0.95);
      const ry = radius * randRange(rng, 0.35, 0.8);
      const rotation = randRange(rng, -0.9, 0.9);

      Spray.opaque(
        ctx,
        rng,
        ox,
        oy,
        Math.max(rx, ry) * 0.55,
        randInt(rng, this.cornerInnerDotsRange[0], this.cornerInnerDotsRange[1]),
        shades
      );

      Spray.opaqueEdgeFalloffEllipse(
        ctx,
        rng,
        ox,
        oy,
        rx,
        ry,
        rotation,
        randInt(rng, 16000, 32000),
        shades,
        {
          falloff: randRange(rng, 12, 26),
          maxDist: randRange(rng, 55, 140),
          tangentJitter: randRange(rng, 4, 10),
          inwardChance: randRange(rng, 0.12, 0.28),
        }
      );
    }

    if (rng.bool(0.6)) {
      const chunks = randInt(rng, 12, 28);
      for (let i = 0; i < chunks; i++) {
        const px = cx + randRange(rng, -radius * 0.45, radius * 0.45);
        const py = cy + randRange(rng, -radius * 0.45, radius * 0.45);
        Spray.chunkPixels(ctx, rng, px, py, radius * 0.2, randInt(rng, 6, 14), [shades[1], shades[2], shades[2]]);
      }
    }

    ctx.restore();
  }

  async #cornerCloudDenseAsync(ctx, rng, width, height, planets, shades, stepper) {
    const corner = (rng.float() * 4) | 0;

    const padX = width * 0.12;
    const padY = height * 0.12;

    let cx = padX;
    let cy = padY;

    if (corner === 1) {
      cx = width - padX;
      cy = padY;
    }
    if (corner === 2) {
      cx = padX;
      cy = height - padY;
    }
    if (corner === 3) {
      cx = width - padX;
      cy = height - padY;
    }

    cx += randRange(rng, -width * 0.05, width * 0.05);
    cy += randRange(rng, -height * 0.05, height * 0.05);

    if (pointInsideAnyPlanet(cx, cy, planets, 1.35)) return;

    const radius = Math.min(width, height) * randRange(rng, 0.16, 0.28);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    const lobes = randInt(rng, 2, 4);
    for (let i = 0; i < lobes; i++) {
      const ox = cx + randRange(rng, -radius * 0.4, radius * 0.4);
      const oy = cy + randRange(rng, -radius * 0.4, radius * 0.4);

      const rx = radius * randRange(rng, 0.45, 0.95);
      const ry = radius * randRange(rng, 0.35, 0.8);
      const rotation = randRange(rng, -0.9, 0.9);

      await Spray.opaqueAsync(
        ctx,
        rng,
        ox,
        oy,
        Math.max(rx, ry) * 0.55,
        randInt(rng, Math.max(900, this.cornerInnerDotsRange[0] / 2), this.cornerInnerDotsRange[1]),
        shades,
        stepper
      );

      await Spray.opaqueEdgeFalloffEllipseAsync(
        ctx,
        rng,
        ox,
        oy,
        rx,
        ry,
        rotation,
        randInt(rng, 16000, 32000),
        shades,
        stepper,
        {
          falloff: randRange(rng, 12, 26),
          maxDist: randRange(rng, 55, 140),
          tangentJitter: randRange(rng, 4, 10),
          inwardChance: randRange(rng, 0.12, 0.28),
          tickEvery: 64,
        }
      );

      await stepper.tick(1);
    }

    if (rng.bool(0.6)) {
      const chunks = randInt(rng, 12, 28);
      for (let i = 0; i < chunks; i++) {
        const px = cx + randRange(rng, -radius * 0.45, radius * 0.45);
        const py = cy + randRange(rng, -radius * 0.45, radius * 0.45);
        await Spray.chunkPixelsAsync(
          ctx,
          rng,
          px,
          py,
          radius * 0.2,
          randInt(rng, 6, 14),
          [shades[1], shades[2], shades[2]],
          stepper
        );
      }
    }

    ctx.restore();
  }

  #behindMainGlowDense(ctx, rng, mainPlanet, shades) {
    const { cx, cy, r } = mainPlanet;

    const gx = cx + randRange(rng, -r * 0.25, r * 0.25);
    const gy = cy + randRange(rng, -r * 0.25, r * 0.25);
    const glowRadius = r * randRange(rng, 1.25, 1.85);

    Spray.opaque(ctx, rng, gx, gy, glowRadius * 0.65, randInt(rng, 5200, 10400), shades);

    const rx = glowRadius * randRange(rng, 0.85, 1.1);
    const ry = glowRadius * randRange(rng, 0.65, 0.95);
    const rotation = randRange(rng, -0.9, 0.9);

    Spray.opaqueEdgeFalloffEllipse(ctx, rng, gx, gy, rx, ry, rotation, randInt(rng, 26000, 52000), shades, {
      falloff: randRange(rng, 14, 28),
      maxDist: randRange(rng, 70, 170),
      tangentJitter: randRange(rng, 5, 12),
      inwardChance: randRange(rng, 0.1, 0.22),
    });

    const subClouds = randInt(rng, 1, 3);
    for (let i = 0; i < subClouds; i++) {
      const sx = gx + randRange(rng, -glowRadius * 0.25, glowRadius * 0.25);
      const sy = gy + randRange(rng, -glowRadius * 0.25, glowRadius * 0.25);
      const srx = glowRadius * randRange(rng, 0.35, 0.7);
      const sry = glowRadius * randRange(rng, 0.25, 0.55);
      const srotation = rotation + randRange(rng, -0.6, 0.6);

      Spray.opaqueEdgeFalloffEllipse(
        ctx,
        rng,
        sx,
        sy,
        srx,
        sry,
        srotation,
        randInt(rng, 11000, 22000),
        [shades[1], shades[2], shades[2]],
        {
          falloff: randRange(rng, 10, 22),
          maxDist: randRange(rng, 45, 120),
          tangentJitter: randRange(rng, 3, 10),
          inwardChance: randRange(rng, 0.08, 0.2),
        }
      );
    }
  }

  async #behindMainGlowDenseAsync(ctx, rng, mainPlanet, shades, stepper) {
    const { cx, cy, r } = mainPlanet;

    const gx = cx + randRange(rng, -r * 0.25, r * 0.25);
    const gy = cy + randRange(rng, -r * 0.25, r * 0.25);
    const glowRadius = r * randRange(rng, 1.25, 1.85);

    await Spray.opaqueAsync(ctx, rng, gx, gy, glowRadius * 0.65, randInt(rng, 2200, 5200), shades, stepper);

    const rx = glowRadius * randRange(rng, 0.85, 1.1);
    const ry = glowRadius * randRange(rng, 0.65, 0.95);
    const rotation = randRange(rng, -0.9, 0.9);

    await Spray.opaqueEdgeFalloffEllipseAsync(
      ctx,
      rng,
      gx,
      gy,
      rx,
      ry,
      rotation,
      randInt(rng, 26000, 52000),
      shades,
      stepper,
      {
        falloff: randRange(rng, 14, 28),
        maxDist: randRange(rng, 70, 170),
        tangentJitter: randRange(rng, 5, 12),
        inwardChance: randRange(rng, 0.1, 0.22),
        tickEvery: 64,
      }
    );

    const subClouds = randInt(rng, 1, 3);
    for (let i = 0; i < subClouds; i++) {
      const sx = gx + randRange(rng, -glowRadius * 0.25, glowRadius * 0.25);
      const sy = gy + randRange(rng, -glowRadius * 0.25, glowRadius * 0.25);
      const srx = glowRadius * randRange(rng, 0.35, 0.7);
      const sry = glowRadius * randRange(rng, 0.25, 0.55);
      const srotation = rotation + randRange(rng, -0.6, 0.6);

      await Spray.opaqueEdgeFalloffEllipseAsync(
        ctx,
        rng,
        sx,
        sy,
        srx,
        sry,
        srotation,
        randInt(rng, 11000, 22000),
        [shades[1], shades[2], shades[2]],
        stepper,
        {
          falloff: randRange(rng, 10, 22),
          maxDist: randRange(rng, 45, 120),
          tangentJitter: randRange(rng, 3, 10),
          inwardChance: randRange(rng, 0.08, 0.2),
          tickEvery: 64,
        }
      );

      await stepper.tick(1);
    }
  }
}

/**
 * @template T
 * @param {{ float: () => number }} rng
 * @param {Array<[T, number]>} items
 * @returns {T}
 */
function weightedPick(rng, items) {
  let sum = 0;
  for (const [, weight] of items) sum += weight;

  let target = rng.float() * sum;
  for (const [value, weight] of items) {
    target -= weight;
    if (target <= 0) return value;
  }

  return items[items.length - 1][0];
}
