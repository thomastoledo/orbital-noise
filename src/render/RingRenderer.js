import { randInt, randRange } from "../utils/math.js";
import { hexToRgba } from "../color/colors.js";

export class RingRenderer {
  draw(ctx, rng, planet, color, count) {
    const { cx, cy, r } = planet;

    for (let i = 0; i < count; i++) {
      const rx = r * randRange(rng, 1.05, 2.45);
      const ry = r * randRange(rng, 0.65, 2.05);
      const rot = randRange(rng, -0.9, 0.9);

      const lw = randInt(rng, 2, 16);

      const style = weightedPick(rng, [
        ["solid", 0.25],
        ["dotted", 0.22],
        ["dashed", 0.28],
        ["long", 0.15],
        ["mixed", 0.10],
      ]);

      const alpha = randRange(rng, 0.22, 0.62);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = hexToRgba(color, alpha);
      ctx.lineWidth = lw;
      ctx.lineCap = rng.bool(0.6) ? "butt" : "round";

      const dashBase = randInt(rng, 4, 30);
      if (style === "solid") ctx.setLineDash([]);
      if (style === "dotted") ctx.setLineDash([1, dashBase]);
      if (style === "dashed") ctx.setLineDash([dashBase, dashBase]);
      if (style === "long") ctx.setLineDash([dashBase * 2.6, dashBase * 0.9]);
      if (style === "mixed")
        ctx.setLineDash([dashBase, Math.max(4, dashBase * 0.35), dashBase * 2.0, Math.max(6, dashBase * 0.85)]);

      const pieces = randInt(rng, 3, 8);
      for (let p = 0; p < pieces; p++) {
        if (rng.bool(0.18)) continue;
        const a0 = randRange(rng, 0, Math.PI * 2);
        const span = randRange(rng, Math.PI * 0.18, Math.PI * 0.78);
        const a1 = a0 + span;

        ctx.beginPath();
        ctx.ellipse(
          cx + randRange(rng, -2, 2),
          cy + randRange(rng, -2, 2),
          rx * randRange(rng, 0.98, 1.02),
          ry * randRange(rng, 0.98, 1.02),
          rot + randRange(rng, -0.08, 0.08),
          a0,
          a1
        );
        ctx.stroke();

        if (rng.bool(0.22)) {
          ctx.beginPath();
          ctx.ellipse(cx + randRange(rng, -8, 8), cy + randRange(rng, -8, 8), rx, ry, rot, a0, a1);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  /**
   * Async variant for progressive/recorded rendering.
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async drawAsync(ctx, rng, planet, color, count, stepper) {
    const { cx, cy, r } = planet;

    for (let i = 0; i < count; i++) {
      const rx = r * randRange(rng, 1.05, 2.45);
      const ry = r * randRange(rng, 0.65, 2.05);
      const rot = randRange(rng, -0.9, 0.9);

      const lw = randInt(rng, 2, 16);

      const style = weightedPick(rng, [
        ["solid", 0.25],
        ["dotted", 0.22],
        ["dashed", 0.28],
        ["long", 0.15],
        ["mixed", 0.10],
      ]);

      const alpha = randRange(rng, 0.22, 0.62);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = hexToRgba(color, alpha);
      ctx.lineWidth = lw;
      ctx.lineCap = rng.bool(0.6) ? "butt" : "round";

      const dashBase = randInt(rng, 4, 30);
      if (style === "solid") ctx.setLineDash([]);
      if (style === "dotted") ctx.setLineDash([1, dashBase]);
      if (style === "dashed") ctx.setLineDash([dashBase, dashBase]);
      if (style === "long") ctx.setLineDash([dashBase * 2.6, dashBase * 0.9]);
      if (style === "mixed")
        ctx.setLineDash([dashBase, Math.max(4, dashBase * 0.35), dashBase * 2.0, Math.max(6, dashBase * 0.85)]);

      const pieces = randInt(rng, 3, 8);
      for (let p = 0; p < pieces; p++) {
        if (rng.bool(0.18)) continue;
        const a0 = randRange(rng, 0, Math.PI * 2);
        const span = randRange(rng, Math.PI * 0.18, Math.PI * 0.78);
        const a1 = a0 + span;

        ctx.beginPath();
        ctx.ellipse(
          cx + randRange(rng, -2, 2),
          cy + randRange(rng, -2, 2),
          rx * randRange(rng, 0.98, 1.02),
          ry * randRange(rng, 0.98, 1.02),
          rot + randRange(rng, -0.08, 0.08),
          a0,
          a1
        );
        ctx.stroke();

        if (rng.bool(0.22)) {
          ctx.beginPath();
          ctx.ellipse(cx + randRange(rng, -8, 8), cy + randRange(rng, -8, 8), rx, ry, rot, a0, a1);
          ctx.stroke();
        }

        await stepper.tick(1);
      }

      ctx.restore();
      await stepper.tick(1);
    }
  }
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
