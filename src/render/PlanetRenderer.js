import { randInt, randRange } from "../utils/math.js";
import { hexToHue, neonHsl, hexToRgba } from "../color/colors.js";
import { lerpHex } from "../palette/inkPalette.js";
import { Spray } from "./Spray.js";

/**
 * @typedef {Object} PlanetTheme
 * @property {"neon" | "ink"} [type]
 * @property {"standard" | "batched"} [asyncSprayMode]
 * @property {{ planetDark: string, planetLight: string }} [inkPalette]
 */

/**
 * @typedef {Object} PlanetRendererConfig
 * @property {PlanetTheme} [theme]
 */

/**
 * Planet renderer with two theme families:
 * - `neon`: hue-derived accents (normal / gold)
 * - `ink`: constrained palette (blue-ink)
 */
export class PlanetRenderer {
  /**
   * @param {PlanetRendererConfig} [config]
   */
  constructor(config = {}) {
    const theme = config.theme ?? {};
    this.theme = {
      type: theme.type ?? "neon",
      asyncSprayMode: theme.asyncSprayMode ?? "standard",
      inkPalette: theme.inkPalette ?? null,
    };
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {{ cx: number, cy: number, r: number, color: string }} planet
   */
  draw(ctx, rng, planet) {
    const { cx, cy, r, color } = planet;

    Spray.alpha(
      ctx,
      rng,
      cx + randRange(rng, -r * 0.1, r * 0.1),
      cy + randRange(rng, -r * 0.1, r * 0.1),
      r * 1.22,
      randInt(rng, 1200, 3800),
      color,
      randRange(rng, 0.03, 0.07)
    );

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color;

    const wobble = randRange(rng, 0.6, 3.0);
    const rotation = randRange(rng, -0.3, 0.3);

    ctx.beginPath();
    ctx.ellipse(
      cx + randRange(rng, -wobble, wobble),
      cy + randRange(rng, -wobble, wobble),
      r,
      r * randRange(rng, 0.97, 1.03),
      rotation,
      0,
      Math.PI * 2
    );
    ctx.fill();

    this.#shadow(ctx, rng, cx, cy, r, color);
    this.#motifs(ctx, rng, cx, cy, r, color);
    this.#rim(ctx, rng, cx, cy, r, color);

    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {{ cx: number, cy: number, r: number, color: string }} planet
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async drawAsync(ctx, rng, planet, stepper) {
    const { cx, cy, r, color } = planet;

    await this.#alphaSprayAsync(
      ctx,
      rng,
      cx + randRange(rng, -r * 0.1, r * 0.1),
      cy + randRange(rng, -r * 0.1, r * 0.1),
      r * 1.22,
      randInt(rng, 1200, 3800),
      color,
      randRange(rng, 0.03, 0.07),
      stepper
    );

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color;

    const wobble = randRange(rng, 0.6, 3.0);
    const rotation = randRange(rng, -0.3, 0.3);

    ctx.beginPath();
    ctx.ellipse(
      cx + randRange(rng, -wobble, wobble),
      cy + randRange(rng, -wobble, wobble),
      r,
      r * randRange(rng, 0.97, 1.03),
      rotation,
      0,
      Math.PI * 2
    );
    ctx.fill();
    await stepper.tick(1);

    await this.#shadowAsync(ctx, rng, cx, cy, r, color, stepper);
    await this.#motifsAsync(ctx, rng, cx, cy, r, color, stepper);
    await this.#rimAsync(ctx, rng, cx, cy, r, color, stepper);

    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   * @param {string} baseColor
   */
  #shadow(ctx, rng, cx, cy, r, baseColor) {
    const direction = rng.float() * Math.PI * 2;
    const sx = cx + Math.cos(direction) * r * randRange(rng, -0.55, 0.35);
    const sy = cy + Math.sin(direction) * r * randRange(rng, -0.55, 0.35);

    const shadowColor = this.#shadowHex(baseColor);
    const layers = randInt(rng, 3, 6);

    for (let i = 0; i < layers; i++) {
      const alpha = randRange(rng, 0.05, 0.12) * (1 - i / layers);
      Spray.alphaClippedToCircle(
        ctx,
        rng,
        sx,
        sy,
        r * randRange(rng, 0.7, 1.05),
        randInt(rng, 1200, 4200),
        shadowColor,
        alpha,
        cx,
        cy,
        r
      );
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = hexToRgba(shadowColor, 0.24);

    const offset = randRange(rng, -r * 0.45, r * 0.3);
    const rotation = randRange(rng, -0.55, 0.55);

    ctx.beginPath();
    ctx.ellipse(cx + offset, cy, r * 1.05, r * 0.98, rotation, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   * @param {string} baseColor
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async #shadowAsync(ctx, rng, cx, cy, r, baseColor, stepper) {
    const direction = rng.float() * Math.PI * 2;
    const sx = cx + Math.cos(direction) * r * randRange(rng, -0.55, 0.35);
    const sy = cy + Math.sin(direction) * r * randRange(rng, -0.55, 0.35);

    const shadowColor = this.#shadowHex(baseColor);
    const layers = randInt(rng, 3, 6);

    for (let i = 0; i < layers; i++) {
      const alpha = randRange(rng, 0.05, 0.12) * (1 - i / layers);
      await this.#alphaSprayClippedAsync(
        ctx,
        rng,
        sx,
        sy,
        r * randRange(rng, 0.7, 1.05),
        randInt(rng, 1200, 4200),
        shadowColor,
        alpha,
        cx,
        cy,
        r,
        stepper
      );
      await stepper.tick(1);
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = hexToRgba(shadowColor, 0.24);

    const offset = randRange(rng, -r * 0.45, r * 0.3);
    const rotation = randRange(rng, -0.55, 0.55);

    ctx.beginPath();
    ctx.ellipse(cx + offset, cy, r * 1.05, r * 0.98, rotation, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.restore();

    await stepper.tick(1);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   * @param {string} baseColor
   */
  #motifs(ctx, rng, cx, cy, r, baseColor) {
    const { motifA, motifB, craterBase } = this.#motifPalette(baseColor, rng);

    const bands = randInt(rng, 2, 6);
    for (let i = 0; i < bands; i++) {
      const y = cy + randRange(rng, -r * 0.7, r * 0.7);
      const bandWidth = r * randRange(rng, 0.55, 1.15);
      const bandHeight = r * randRange(rng, 0.05, 0.2);

      ctx.strokeStyle = hexToRgba(rng.bool(0.55) ? motifA : motifB, randRange(rng, 0.06, 0.14));
      ctx.lineWidth = randInt(rng, 1, 4);

      ctx.beginPath();
      ctx.ellipse(
        cx + randRange(rng, -r * 0.1, r * 0.1),
        y,
        bandWidth,
        bandHeight,
        randRange(rng, -0.35, 0.35),
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }

    const craters = randInt(rng, 20, 90);
    for (let i = 0; i < craters; i++) {
      const t = rng.float() * Math.PI * 2;
      const radial = Math.sqrt(rng.float()) * r * 0.95;
      const x = (cx + Math.cos(t) * radial) | 0;
      const y = (cy + Math.sin(t) * radial) | 0;

      const size = rng.float() < 0.78 ? 1 : rng.float() < 0.95 ? 2 : 3;
      ctx.fillStyle = hexToRgba(craterBase, randRange(rng, 0.1, 0.24));
      ctx.fillRect(x, y, size, size);

      if (rng.bool(0.18)) {
        ctx.fillStyle = hexToRgba(rng.bool(0.5) ? motifA : motifB, randRange(rng, 0.1, 0.22));
        ctx.fillRect(x + randInt(rng, -2, 2), y + randInt(rng, -2, 2), 1, 1);
      }
    }

    const scratches = randInt(rng, 8, 22);
    for (let i = 0; i < scratches; i++) {
      const x = cx + randRange(rng, -r * 0.75, r * 0.75);
      const y = cy + randRange(rng, -r * 0.75, r * 0.75);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;

      const length = randInt(rng, 8, 44);
      const horizontal = rng.bool(0.5);

      ctx.strokeStyle = hexToRgba(rng.bool(0.5) ? motifA : motifB, randRange(rng, 0.05, 0.12));
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(horizontal ? x + length : x, horizontal ? y : y + length);
      ctx.stroke();
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   * @param {string} baseColor
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async #motifsAsync(ctx, rng, cx, cy, r, baseColor, stepper) {
    const { motifA, motifB, craterBase } = this.#motifPalette(baseColor, rng);

    const bands = randInt(rng, 2, 6);
    for (let i = 0; i < bands; i++) {
      const y = cy + randRange(rng, -r * 0.7, r * 0.7);
      const bandWidth = r * randRange(rng, 0.55, 1.15);
      const bandHeight = r * randRange(rng, 0.05, 0.2);

      ctx.strokeStyle = hexToRgba(rng.bool(0.55) ? motifA : motifB, randRange(rng, 0.06, 0.14));
      ctx.lineWidth = randInt(rng, 1, 4);

      ctx.beginPath();
      ctx.ellipse(
        cx + randRange(rng, -r * 0.1, r * 0.1),
        y,
        bandWidth,
        bandHeight,
        randRange(rng, -0.35, 0.35),
        0,
        Math.PI * 2
      );
      ctx.stroke();
      await stepper.tick(1);
    }

    const craters = randInt(rng, 20, 90);
    for (let i = 0; i < craters; i++) {
      const t = rng.float() * Math.PI * 2;
      const radial = Math.sqrt(rng.float()) * r * 0.95;
      const x = (cx + Math.cos(t) * radial) | 0;
      const y = (cy + Math.sin(t) * radial) | 0;

      const size = rng.float() < 0.78 ? 1 : rng.float() < 0.95 ? 2 : 3;
      ctx.fillStyle = hexToRgba(craterBase, randRange(rng, 0.1, 0.24));
      ctx.fillRect(x, y, size, size);

      if (rng.bool(0.18)) {
        ctx.fillStyle = hexToRgba(rng.bool(0.5) ? motifA : motifB, randRange(rng, 0.1, 0.22));
        ctx.fillRect(x + randInt(rng, -2, 2), y + randInt(rng, -2, 2), 1, 1);
      }

      if ((i & 7) === 0) await stepper.tick(1);
    }

    const scratches = randInt(rng, 8, 22);
    for (let i = 0; i < scratches; i++) {
      const x = cx + randRange(rng, -r * 0.75, r * 0.75);
      const y = cy + randRange(rng, -r * 0.75, r * 0.75);
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r * r) continue;

      const length = randInt(rng, 8, 44);
      const horizontal = rng.bool(0.5);

      ctx.strokeStyle = hexToRgba(rng.bool(0.5) ? motifA : motifB, randRange(rng, 0.05, 0.12));
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(horizontal ? x + length : x, horizontal ? y : y + length);
      ctx.stroke();
      await stepper.tick(1);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   * @param {string} baseColor
   */
  #rim(ctx, rng, cx, cy, r, baseColor) {
    const highlight = this.#rimHighlight(baseColor, rng);

    ctx.save();
    ctx.strokeStyle = hexToRgba(highlight, randRange(rng, 0.18, 0.38));
    ctx.lineWidth = randInt(rng, 2, 7);

    const arcs = randInt(rng, 2, 4);
    for (let i = 0; i < arcs; i++) {
      const start = randRange(rng, 0, Math.PI * 2);
      const end = start + randRange(rng, Math.PI * 0.22, Math.PI * 0.7);

      ctx.beginPath();
      ctx.arc(cx, cy, r * randRange(rng, 0.98, 1.03), start, end);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} r
   * @param {string} baseColor
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async #rimAsync(ctx, rng, cx, cy, r, baseColor, stepper) {
    const highlight = this.#rimHighlight(baseColor, rng);

    ctx.save();
    ctx.strokeStyle = hexToRgba(highlight, randRange(rng, 0.18, 0.38));
    ctx.lineWidth = randInt(rng, 2, 7);

    const arcs = randInt(rng, 2, 4);
    for (let i = 0; i < arcs; i++) {
      const start = randRange(rng, 0, Math.PI * 2);
      const end = start + randRange(rng, Math.PI * 0.22, Math.PI * 0.7);

      ctx.beginPath();
      ctx.arc(cx, cy, r * randRange(rng, 0.98, 1.03), start, end);
      ctx.stroke();
      await stepper.tick(1);
    }

    ctx.restore();
  }

  /**
   * @param {string} baseColor
   * @param {{ float: () => number }} rng
   * @returns {{ motifA: string, motifB: string, craterBase: string }}
   */
  #motifPalette(baseColor, rng) {
    if (this.theme.type === "ink" && this.theme.inkPalette) {
      const palette = this.theme.inkPalette;
      const motifA = lerpHex(baseColor, palette.planetLight, randRange(rng, 0.35, 0.72));
      const motifB = lerpHex(baseColor, palette.planetDark, randRange(rng, 0.25, 0.55));
      return { motifA, motifB, craterBase: palette.planetDark };
    }

    const hue = hexToHue(baseColor);
    const motifA = neonHsl((hue + 40) % 360, 100, 58);
    const motifB = neonHsl((hue + 200) % 360, 100, 58);
    return { motifA, motifB, craterBase: "#000000" };
  }

  /**
   * @param {string} baseColor
   * @param {{ float: () => number }} rng
   * @returns {string}
   */
  #rimHighlight(baseColor, rng) {
    if (this.theme.type === "ink" && this.theme.inkPalette) {
      return lerpHex(baseColor, this.theme.inkPalette.planetLight, randRange(rng, 0.72, 0.92));
    }

    const hue = hexToHue(baseColor);
    return neonHsl((hue + 20) % 360, 100, 70);
  }

  /**
   * @param {string} baseColor
   * @returns {string}
   */
  #shadowHex(baseColor) {
    if (this.theme.type === "ink" && this.theme.inkPalette) {
      return this.theme.inkPalette.planetDark;
    }
    return "#000000";
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {number} dots
   * @param {string} hex
   * @param {number} alpha
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async #alphaSprayAsync(ctx, rng, cx, cy, radius, dots, hex, alpha, stepper) {
    if (this.theme.asyncSprayMode === "batched") {
      await this.#alphaSprayAsyncBatched(ctx, rng, cx, cy, radius, dots, hex, alpha, stepper);
      return;
    }
    await Spray.alphaAsync(ctx, rng, cx, cy, radius, dots, hex, alpha, stepper);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {number} dots
   * @param {string} hex
   * @param {number} alpha
   * @param {number} clipCx
   * @param {number} clipCy
   * @param {number} clipRadius
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async #alphaSprayClippedAsync(
    ctx,
    rng,
    cx,
    cy,
    radius,
    dots,
    hex,
    alpha,
    clipCx,
    clipCy,
    clipRadius,
    stepper
  ) {
    if (this.theme.asyncSprayMode === "batched") {
      await this.#alphaSprayClippedAsyncBatched(
        ctx,
        rng,
        cx,
        cy,
        radius,
        dots,
        hex,
        alpha,
        clipCx,
        clipCy,
        clipRadius,
        stepper
      );
      return;
    }

    await Spray.alphaClippedToCircleAsync(
      ctx,
      rng,
      cx,
      cy,
      radius,
      dots,
      hex,
      alpha,
      clipCx,
      clipCy,
      clipRadius,
      stepper
    );
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {number} dots
   * @param {string} hex
   * @param {number} alpha
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async #alphaSprayAsyncBatched(ctx, rng, cx, cy, radius, dots, hex, alpha, stepper) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = hexToRgba(hex, alpha);

    const batch = 512;
    const tau = Math.PI * 2;

    for (let i = 0; i < dots; i++) {
      const angle = rng.float() * tau;
      const radial = Math.sqrt(rng.float()) * radius;
      const x = (cx + Math.cos(angle) * radial) | 0;
      const y = (cy + Math.sin(angle) * radial) | 0;
      ctx.fillRect(x, y, 1, 1);

      if ((i & (batch - 1)) === 0) {
        await stepper.yieldNow();
      }
    }

    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number }} rng
   * @param {number} cx
   * @param {number} cy
   * @param {number} radius
   * @param {number} dots
   * @param {string} hex
   * @param {number} alpha
   * @param {number} clipCx
   * @param {number} clipCy
   * @param {number} clipRadius
   * @param {import("../utils/stepper.js").Stepper} stepper
   */
  async #alphaSprayClippedAsyncBatched(
    ctx,
    rng,
    cx,
    cy,
    radius,
    dots,
    hex,
    alpha,
    clipCx,
    clipCy,
    clipRadius,
    stepper
  ) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    ctx.beginPath();
    ctx.arc(clipCx, clipCy, clipRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = hexToRgba(hex, alpha);

    const batch = 512;
    const tau = Math.PI * 2;

    for (let i = 0; i < dots; i++) {
      const angle = rng.float() * tau;
      const radial = Math.sqrt(rng.float()) * radius;
      const x = (cx + Math.cos(angle) * radial) | 0;
      const y = (cy + Math.sin(angle) * radial) | 0;
      ctx.fillRect(x, y, 1, 1);

      if ((i & (batch - 1)) === 0) {
        await stepper.yieldNow();
      }
    }

    ctx.restore();
  }
}
