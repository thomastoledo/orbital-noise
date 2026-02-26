import { starOverlaps, gridInsert } from "../utils/spatialHash.js";
import { pointInsideAnyPlanet } from "../utils/geom.js";

/**
 * @typedef {Object} StarGlowConfig
 * @property {boolean} [enabled]
 * @property {string} [color]
 * @property {number} [chance]
 * @property {number} [blur]
 * @property {number} [pad]
 *
 * @typedef {Object} StarfieldConfig
 * @property {number} [gridCell]
 * @property {number} [maxAttemptsMultiplier]
 * @property {string} [color]
 * @property {{ tiny: [number, number], small: [number, number], medium: [number, number], large: [number, number] }} [sizeRanges]
 * @property {[number, number, number]} [thresholds]
 * @property {number} [brightMinSize]
 * @property {number} [largeMinSize]
 * @property {StarGlowConfig} [glow]
 */

/** @type {Map<string, HTMLCanvasElement | OffscreenCanvas>} */
const haloSpriteCache = new Map();

export class Starfield {
  /**
   * @param {StarfieldConfig} [config]
   */
  constructor(config = {}) {
    this.gridCell = config.gridCell ?? 24;
    this.maxAttemptsMultiplier = config.maxAttemptsMultiplier ?? 30;
    this.color = config.color ?? "#FFFFFF";

    this.thresholds = config.thresholds ?? [0.7, 0.92, 0.985];
    this.sizeRanges = config.sizeRanges ?? {
      tiny: [1, 2],
      small: [3, 6],
      medium: [7, 10],
      large: [11, 16],
    };

    this.brightMinSize = config.brightMinSize ?? 7;
    this.largeMinSize = config.largeMinSize ?? this.sizeRanges.large[0];

    this.glow = {
      enabled: config.glow?.enabled ?? false,
      color: config.glow?.color ?? "#FFFFFF",
      chance: config.glow?.chance ?? 0.55,
      blur: config.glow?.blur ?? 4,
      pad: config.glow?.pad ?? 10,
    };
  }

  /**
   * Draws stars synchronously and returns the placed-star list.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {number} width
   * @param {number} height
   * @param {number} count
   * @param {Array<{ cx: number, cy: number, r: number }>} planets
   * @param {{ avoidMargin: number, color?: string }} options
   * @returns {Array<{ x: number, y: number, size: number, bright: boolean }>}
   */
  placeAndDraw(ctx, rng, width, height, count, planets, { avoidMargin, color }) {
    const starColor = color ?? this.color;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = starColor;

    const grid = new Map();
    const stars = [];
    const glows = [];

    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * this.maxAttemptsMultiplier;

    while (placed < count && attempts < maxAttempts) {
      attempts++;

      let x = (rng.float() * width) | 0;
      let y = (rng.float() * height) | 0;

      if (pointInsideAnyPlanet(x, y, planets, avoidMargin)) continue;

      const size = this.#pickStarSize(rng);
      if (x + size >= width) x = width - size - 1;
      if (y + size >= height) y = height - size - 1;

      if (starOverlaps(x, y, size, grid, stars, this.gridCell)) continue;

      ctx.fillRect(x, y, size, size);

      if (this.glow.enabled && (size >= this.largeMinSize || rng.bool(this.glow.chance))) {
        glows.push({ x, y, size });
      }

      const star = { x, y, size, bright: size >= this.brightMinSize };
      stars.push(star);
      gridInsert(grid, this.gridCell, stars.length - 1, star);

      placed++;
    }

    this.#drawGlows(ctx, glows);

    ctx.restore();
    return stars;
  }

  /**
   * Draws stars asynchronously for progressive rendering/recording.
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ float: () => number, int: (a: number, b: number) => number, bool: (p?: number) => boolean }} rng
   * @param {number} width
   * @param {number} height
   * @param {number} count
   * @param {Array<{ cx: number, cy: number, r: number }>} planets
   * @param {{ avoidMargin: number, batch?: number, color?: string }} options
   * @param {import("../utils/stepper.js").Stepper} stepper
   * @returns {Promise<Array<{ x: number, y: number, size: number, bright: boolean }>>}
   */
  async placeAndDrawAsync(ctx, rng, width, height, count, planets, { avoidMargin, batch = 1, color }, stepper) {
    const starColor = color ?? this.color;

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = starColor;

    const grid = new Map();
    const stars = [];
    const glows = [];

    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * this.maxAttemptsMultiplier;
    const batchSize = Math.max(1, batch | 0);

    while (placed < count && attempts < maxAttempts) {
      attempts++;

      let x = (rng.float() * width) | 0;
      let y = (rng.float() * height) | 0;

      if (pointInsideAnyPlanet(x, y, planets, avoidMargin)) continue;

      const size = this.#pickStarSize(rng);
      if (x + size >= width) x = width - size - 1;
      if (y + size >= height) y = height - size - 1;

      if (starOverlaps(x, y, size, grid, stars, this.gridCell)) continue;

      ctx.fillRect(x, y, size, size);

      if (this.glow.enabled && (size >= this.largeMinSize || rng.bool(this.glow.chance))) {
        glows.push({ x, y, size });
      }

      const star = { x, y, size, bright: size >= this.brightMinSize };
      stars.push(star);
      gridInsert(grid, this.gridCell, stars.length - 1, star);

      placed++;
      if (placed % batchSize === 0) await stepper.yieldNow();
    }

    if (glows.length > 0) {
      await stepper.yieldNow();
      this.#drawGlows(ctx, glows);
    }

    ctx.restore();
    return stars;
  }

  /**
   * @param {{ float: () => number, int: (a: number, b: number) => number }} rng
   * @returns {number}
   */
  #pickStarSize(rng) {
    const roll = rng.float();
    const [tinyThreshold, smallThreshold, mediumThreshold] = this.thresholds;

    if (roll < tinyThreshold) return rng.int(this.sizeRanges.tiny[0], this.sizeRanges.tiny[1]);
    if (roll < smallThreshold) return rng.int(this.sizeRanges.small[0], this.sizeRanges.small[1]);
    if (roll < mediumThreshold) return rng.int(this.sizeRanges.medium[0], this.sizeRanges.medium[1]);
    return rng.int(this.sizeRanges.large[0], this.sizeRanges.large[1]);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array<{ x: number, y: number, size: number }>} glows
   */
  #drawGlows(ctx, glows) {
    if (!this.glow.enabled || glows.length === 0) return;

    for (const glow of glows) {
      const sprite = getHaloSprite(glow.size, this.glow.color, this.glow.blur, this.glow.pad);
      const pad = (sprite.width - glow.size) >> 1;
      ctx.drawImage(sprite, glow.x - pad, glow.y - pad);
    }
  }
}

/**
 * @param {number} size
 * @param {string} color
 * @param {number} blur
 * @param {number} pad
 * @returns {HTMLCanvasElement | OffscreenCanvas}
 */
function getHaloSprite(size, color, blur, pad) {
  const key = `${size}|${color}|${blur}|${pad}`;
  const cached = haloSpriteCache.get(key);
  if (cached) return cached;

  const width = size + pad * 2;
  const height = size + pad * 2;

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.filter = `blur(${blur}px)`;
  ctx.fillRect(pad - 1, pad - 1, size + 2, size + 2);
  ctx.filter = "none";

  haloSpriteCache.set(key, canvas);
  return canvas;
}
