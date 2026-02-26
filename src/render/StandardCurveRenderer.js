import { randInt, randRange } from "../utils/math.js";
import { curveHitsAnyPlanet, pointOnEdge, segmentHitsAnyPlanet, cubicBezierPoint } from "../utils/geom.js";
import { hexToRgba } from "../color/colors.js";

export class CurveRenderer {
  draw(ctx, rng, W, H, planets, color, { count, arrowChance }) {
    for (let i = 0; i < count; i++) {
      const a = randRange(rng, 0.22, 0.62);
      const lw = randInt(rng, 2, 9);

      const mode = weightedPick(rng, [
        ["bezier", 0.82],
        ["line", 0.18],
      ]);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = hexToRgba(color, a);
      ctx.lineWidth = lw;
      ctx.lineCap = rng.bool(0.65) ? "round" : "butt";

      if (rng.bool(0.45)) {
        const d = randInt(rng, 6, 32);
        ctx.setLineDash([d, Math.max(6, d * randRange(rng, 0.35, 1.2))]);
      } else {
        ctx.setLineDash([]);
      }

      if (mode === "line") {
        this.#line(ctx, rng, W, H, planets, arrowChance);
      } else {
        this.#bezier(ctx, rng, W, H, planets, arrowChance);
      }

      ctx.restore();
    }
  }

  /**
   * Async variant for progressive/recorded rendering.
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async drawAsync(ctx, rng, W, H, planets, color, { count, arrowChance }, stepper) {
    for (let i = 0; i < count; i++) {
      const a = randRange(rng, 0.22, 0.62);
      const lw = randInt(rng, 2, 9);

      const mode = weightedPick(rng, [
        ["bezier", 0.82],
        ["line", 0.18],
      ]);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = hexToRgba(color, a);
      ctx.lineWidth = lw;
      ctx.lineCap = rng.bool(0.65) ? "round" : "butt";

      if (rng.bool(0.45)) {
        const d = randInt(rng, 6, 32);
        ctx.setLineDash([d, Math.max(6, d * randRange(rng, 0.35, 1.2))]);
      } else {
        ctx.setLineDash([]);
      }

      if (mode === "line") {
        await this.#lineAsync(ctx, rng, W, H, planets, arrowChance, stepper);
      } else {
        await this.#bezierAsync(ctx, rng, W, H, planets, arrowChance, stepper);
      }

      ctx.restore();
      await stepper.tick(1);
    }
  }

  async #lineAsync(ctx, rng, W, H, planets, arrowChance, stepper) {
    const horizontal = rng.bool(0.65);
    const x = randRange(rng, W * 0.08, W * 0.92);
    const y = randRange(rng, H * 0.08, H * 0.92);

    const p0 = horizontal ? { x: -W * 0.1, y } : { x, y: -H * 0.1 };
    const p1 = horizontal ? { x: W * 1.1, y } : { x, y: H * 1.1 };

    if (segmentHitsAnyPlanet(p0, p1, planets, 1.05)) return;

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    const pixelStep = 8;
    const steps = Math.max(2, Math.ceil(dist / pixelStep));

    let prev = { ...p0 };
    let drawn = 0;

    // Preserve dash continuity across incremental strokes.
    const hasDash = ctx.getLineDash().length > 0;

    const batchSegs = 48;
    let segInBatch = 0;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);

    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const nx = p0.x + dx * t;
      const ny = p0.y + dy * t;
      ctx.lineTo(nx, ny);

      const segLen = Math.hypot(nx - prev.x, ny - prev.y);
      drawn += segLen;
      prev = { x: nx, y: ny };

      segInBatch++;
      if (segInBatch >= batchSegs || s === steps) {
        if (hasDash) ctx.lineDashOffset = -drawn;
        ctx.stroke();
        segInBatch = 0;

        if (s !== steps) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          await stepper.yieldNow();
        }
      }
    }

    if (rng.bool(arrowChance)) drawArrow(ctx, rng, p0, p1, false);
  }

  async #bezierAsync(ctx, rng, W, H, planets, arrowChance, stepper) {
    for (let tries = 0; tries < 12; tries++) {
      const edgeIn = (rng.float() * 4) | 0;
      const edgeOut = (rng.float() * 4) | 0;

      const p0 = pointOnEdge(rng, W, H, edgeIn, true);
      const p3 = pointOnEdge(rng, W, H, edgeOut, false);

      const c1 = { x: randRange(rng, W * 0.10, W * 0.90), y: randRange(rng, H * 0.10, H * 0.90) };
      const c2 = { x: randRange(rng, W * 0.10, W * 0.90), y: randRange(rng, H * 0.10, H * 0.90) };

      if (curveHitsAnyPlanet(p0, c1, c2, p3, planets, 1.05)) continue;

      // Adaptive samples: enough to look like a traced stroke.
      const approx =
        Math.hypot(c1.x - p0.x, c1.y - p0.y) +
        Math.hypot(c2.x - c1.x, c2.y - c1.y) +
        Math.hypot(p3.x - c2.x, p3.y - c2.y);
      const samples = Math.max(90, Math.ceil(approx / 8));

      const batchSegs = 42;
      let segInBatch = 0;

      let prev = p0;
      let drawn = 0;
      const hasDash = ctx.getLineDash().length > 0;

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);

      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const pt = cubicBezierPoint(p0, c1, c2, p3, t);
        ctx.lineTo(pt.x, pt.y);

        const segLen = Math.hypot(pt.x - prev.x, pt.y - prev.y);
        drawn += segLen;
        prev = pt;

        segInBatch++;
        if (segInBatch >= batchSegs || i === samples) {
          if (hasDash) ctx.lineDashOffset = -drawn;
          ctx.stroke();
          segInBatch = 0;

          if (i !== samples) {
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            await stepper.yieldNow();
          }
        }
      }

      if (rng.bool(arrowChance)) drawBezierArrow(ctx, rng, p0, c1, c2, p3);
      break;
    }
  }

  #line(ctx, rng, W, H, planets, arrowChance) {
    const horizontal = rng.bool(0.65);
    const x = randRange(rng, W * 0.08, W * 0.92);
    const y = randRange(rng, H * 0.08, H * 0.92);

    const p0 = horizontal ? { x: -W * 0.1, y } : { x, y: -H * 0.1 };
    const p1 = horizontal ? { x: W * 1.1, y } : { x, y: H * 1.1 };
    let ctxStrokeStyle = ctx.strokeStyle;
    if (!segmentHitsAnyPlanet(p0, p1, planets, 1.05)) {
      if (rng.bool(arrowChance)) {
        const a = randRange(rng, 0.4, 0.92);
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        drawArrow(ctx, rng, p0, p1, false);
      } else {
        ctx.strokeStyle = ctxStrokeStyle;
      }
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }

  #bezier(ctx, rng, W, H, planets, arrowChance) {
    let ctxStrokeStyle = ctx.strokeStyle;
    for (let tries = 0; tries < 12; tries++) {
      const edgeIn = (rng.float() * 4) | 0;
      const edgeOut = (rng.float() * 4) | 0;

      const p0 = pointOnEdge(rng, W, H, edgeIn, true);
      const p3 = pointOnEdge(rng, W, H, edgeOut, false);

      const c1 = { x: randRange(rng, W * 0.10, W * 0.90), y: randRange(rng, H * 0.10, H * 0.90) };
      const c2 = { x: randRange(rng, W * 0.10, W * 0.90), y: randRange(rng, H * 0.10, H * 0.90) };

      if (curveHitsAnyPlanet(p0, c1, c2, p3, planets, 1.05)) continue;

      if (rng.bool(arrowChance)) {
        const a = randRange(rng, 0.4, 0.92);

        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        drawBezierArrow(ctx, rng, p0, c1, c2, p3);
      } else {
        ctx.strokeStyle = ctxStrokeStyle;
      }
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p3.x, p3.y);
      ctx.stroke();

      break;
    }
  }
}

function drawArrow(ctx, rng, p0, p1, curved) {
  const a = randRange(rng, 0.8, 1);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = `rgba(255,255,255,${a})`;
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);

  if (!curved && rng.bool(0.55)) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }

  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const headLen = randRange(rng, 10, 22);
  const headAng = randRange(rng, 0.45, 0.62);

  const hx = p1.x, hy = p1.y;

  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx - headLen * Math.cos(ang - headAng), hy - headLen * Math.sin(ang - headAng));
  ctx.lineTo(hx - headLen * Math.cos(ang + headAng), hy - headLen * Math.sin(ang + headAng));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawBezierArrow(ctx, rng, p0, c1, c2, p3) {
  const t = 0.85;
  const pA = cubicBezierPoint(p0, c1, c2, p3, t - 0.02);
  const pB = cubicBezierPoint(p0, c1, c2, p3, t);
  drawArrow(ctx, rng, pA, pB, true);
}

function weightedPick(rng, items) {
  let sum = 0;
  for (const [, w] of items) sum += w;
  let t = rng.float() * sum;
  for (const [v, w] of items) {
    t -= w;
    if (t <= 0) return v;
  }
  return items[items.length - 1][0];
}
