import { randInt, randRange } from "../utils/math.js";
import {
  curveHitsAnyPlanet,
  pointOnEdge,
  segmentHitsAnyPlanet,
  cubicBezierPoint,
} from "../utils/geom.js";
import { hexToRgba } from "../color/colors.js";

export class CurveRenderer {
  static #INDIGO_INTERFERENCE = "#a683f7";
  static #INDIGO_GLOW = "#a683f7";
  static #INDIGO_GLOW_BLUR = 10;
  static #INDIGO_GLOW_ALPHA = 1;

  static #MIN_ALPHA = 0.22;
  static #MAX_ALPHA = 0.62;
  static #MIN_LINE_WIDTH = 2;
  static #MAX_LINE_WIDTH = 9;

  static #BEZIER_WEIGHT = 0.82;
  static #LINE_WEIGHT = 0.18;

  static #EDGE_PADDING = 0.08;

  static #ROUND_CAP_CHANCE = 0.65;
  static #DASH_CHANCE = 0.45;

  static #DASH_MIN = 10;
  static #DASH_MAX = 22;
  static #DASH_GAP_RATIO = 0.9;
  static #DASH_MIN_FALLBACK = 8;

  static #DASH_MIN_REGULAR = 6;
  static #DASH_RANGE_MIN = 0.35;
  static #DASH_RANGE_MAX = 1.2;

  static #PLANET_COLLISION_BUFFER = 1.05;

  static #FALLBACK_MAX_TRIES = 24;
  static #FALLBACK_EDGE_PADDING_MIN = 0.15;
  static #FALLBACK_EDGE_PADDING_MAX = 0.85;
  static #FALLBACK_DASH = [14, 12];
  static #FALLBACK_LINE_WIDTH = 3;

  // regular curve self-glow (1 out of 5, excluding interference)
  static #REGULAR_GLOW_CHANCE = 0.2; // 1/5
  static #REGULAR_GLOW_SPREAD_PX = 10; // "10px glow"
  static #REGULAR_GLOW_BLUR = 4; // "4px blur"
  static #REGULAR_GLOW_ALPHA_FACTOR = 0.28; // under-stroke intensity

  draw(ctx, rng, canvasWidth, canvasHeight, planets, baseColor, { count, arrowChance }) {
    let hasPlacedInterferencePattern = false;
    let hasDrawnArrowChance = false;

    for (let curveIndex = 0; curveIndex < count; curveIndex++) {
      const curveAlpha = randRange(rng, CurveRenderer.#MIN_ALPHA, CurveRenderer.#MAX_ALPHA);
      const curveLineWidth = randInt(rng, CurveRenderer.#MIN_LINE_WIDTH, CurveRenderer.#MAX_LINE_WIDTH);

      const curveMode = weightedPick(rng, [
        ["bezier", CurveRenderer.#BEZIER_WEIGHT],
        ["line", CurveRenderer.#LINE_WEIGHT],
      ]);

      const shouldDrawInterference = !hasPlacedInterferencePattern;
      const shouldGlowRegular =
        !shouldDrawInterference && rng.bool(CurveRenderer.#REGULAR_GLOW_CHANCE);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";

      if (shouldDrawInterference) {
        this.#applyInterferenceStyle(ctx, curveLineWidth, rng);
      } else {
        this.#applyRegularStyle(ctx, rng, baseColor, curveAlpha, curveLineWidth);
      }

      let wasDrawnSuccessfully = false;
      const effectiveArrowChance = shouldDrawInterference ? 0 : ((arrowChance && !hasDrawnArrowChance) ?? 0);

      if (curveMode === "line") {
        wasDrawnSuccessfully = this.#line(
          ctx,
          rng,
          canvasWidth,
          canvasHeight,
          planets,
          effectiveArrowChance,
          shouldGlowRegular
        );
      } else {
        wasDrawnSuccessfully = this.#bezier(
          ctx,
          rng,
          canvasWidth,
          canvasHeight,
          planets,
          effectiveArrowChance,
          shouldGlowRegular
        );
      }

      hasDrawnArrowChance = hasDrawnArrowChance || !!effectiveArrowChance && wasDrawnSuccessfully;
      hasPlacedInterferencePattern = hasPlacedInterferencePattern || shouldDrawInterference && wasDrawnSuccessfully;
      ctx.restore();
    }

    if (!hasPlacedInterferencePattern) {
      this.#forceInterferenceFallback(ctx, rng, canvasWidth, canvasHeight, planets);
    }
  }

  async drawAsync(ctx, rng, canvasWidth, canvasHeight, planets, baseColor, { count, arrowChance }, stepper) {
    let hasPlacedInterferencePattern = false;
    let hasDrawnArrowChance = false;

    for (let curveIndex = 0; curveIndex < count; curveIndex++) {
      const curveAlpha = randRange(rng, CurveRenderer.#MIN_ALPHA, CurveRenderer.#MAX_ALPHA);
      const curveLineWidth = randInt(rng, CurveRenderer.#MIN_LINE_WIDTH, CurveRenderer.#MAX_LINE_WIDTH);

      const curveMode = weightedPick(rng, [
        ["bezier", CurveRenderer.#BEZIER_WEIGHT],
        ["line", CurveRenderer.#LINE_WEIGHT],
      ]);

      const shouldDrawInterference = !hasPlacedInterferencePattern;
      const shouldGlowRegular =
        !shouldDrawInterference && rng.bool(CurveRenderer.#REGULAR_GLOW_CHANCE);

      ctx.save();
      ctx.globalCompositeOperation = "source-over";

      if (shouldDrawInterference) {
        this.#applyInterferenceStyle(ctx, curveLineWidth, rng);
      } else {
        this.#applyRegularStyle(ctx, rng, baseColor, curveAlpha, curveLineWidth);
      }

      let wasDrawnSuccessfully = false;
      const effectiveArrowChance = shouldDrawInterference ? 0 : ((arrowChance && !hasDrawnArrowChance) ?? 0);

      if (curveMode === "line") {
        wasDrawnSuccessfully = await this.#lineAsync(
          ctx,
          rng,
          canvasWidth,
          canvasHeight,
          planets,
          effectiveArrowChance,
          shouldGlowRegular,
          stepper
        );
      } else {
        wasDrawnSuccessfully = await this.#bezierAsync(
          ctx,
          rng,
          canvasWidth,
          canvasHeight,
          planets,
          effectiveArrowChance,
          shouldGlowRegular,
          stepper
        );
      }

      hasDrawnArrowChance = hasDrawnArrowChance || !!effectiveArrowChance && wasDrawnSuccessfully;
      hasPlacedInterferencePattern = hasPlacedInterferencePattern || shouldDrawInterference && wasDrawnSuccessfully;

      ctx.restore();
      await stepper.tick(1);
    }

    if (!hasPlacedInterferencePattern) {
      await this.#forceInterferenceFallbackAsync(ctx, rng, canvasWidth, canvasHeight, planets, stepper);
    }
  }

  #applyInterferenceStyle(ctx, baseLineWidth, rng) {
    ctx.strokeStyle = hexToRgba(CurveRenderer.#INDIGO_INTERFERENCE, 0.62);
    ctx.lineWidth = Math.max(CurveRenderer.#MIN_LINE_WIDTH, baseLineWidth | 0);
    ctx.lineCap = "round";

    ctx.shadowColor = hexToRgba(CurveRenderer.#INDIGO_GLOW, CurveRenderer.#INDIGO_GLOW_ALPHA);
    ctx.shadowBlur = CurveRenderer.#INDIGO_GLOW_BLUR;

    const dashLength = randInt(rng, CurveRenderer.#DASH_MIN, CurveRenderer.#DASH_MAX);
    const dashGap = Math.max(
      CurveRenderer.#DASH_MIN_FALLBACK,
      (dashLength * CurveRenderer.#DASH_GAP_RATIO) | 0
    );
    ctx.setLineDash([dashLength, dashGap]);
  }

  #applyRegularStyle(ctx, rng, curveColor, curveAlpha, baseLineWidth) {
    ctx.strokeStyle = hexToRgba(curveColor, curveAlpha);
    ctx.lineWidth = baseLineWidth;
    ctx.lineCap = rng.bool(CurveRenderer.#ROUND_CAP_CHANCE) ? "round" : "butt";

    if (rng.bool(CurveRenderer.#DASH_CHANCE)) {
      const dashLength = randInt(rng, CurveRenderer.#DASH_MIN_REGULAR, 32);
      const dashGap = Math.max(
        CurveRenderer.#DASH_MIN_REGULAR,
        dashLength * randRange(rng, CurveRenderer.#DASH_RANGE_MIN, CurveRenderer.#DASH_RANGE_MAX)
      );
      ctx.setLineDash([dashLength, dashGap]);
    } else {
      ctx.setLineDash([]);
    }

    // Ensure next strokes/markers aren't impacted by leftover state
    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.globalAlpha = 1;
  }

  async #lineAsync(ctx, rng, canvasWidth, canvasHeight, planets, arrowChance, glowSelf, stepper) {
    const isArrow = rng.bool(arrowChance ?? 0);

    // Arrow/satellite trajectory: starts at border, ends inside opposite quarters
    if (isArrow) {
      const { start, end } = pickBorderToOppositeQuarterTarget(rng, canvasWidth, canvasHeight, MARKER_BASE_PAD_PX);
      if (segmentHitsAnyPlanet(start, end, planets, CurveRenderer.#PLANET_COLLISION_BUFFER)) return false;

      ctx.shadowBlur = 0;
      ctx.shadowColor = "rgba(0,0,0,0)";
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      drawArrowOrSatellite(ctx, rng, start, end, canvasWidth, canvasHeight);
      await stepper.yieldNow();
      return true;
    }

    // Regular line mode (full span), avoid planets using extended segment
    const isHorizontal = rng.bool(0.65);
    const randomX = randRange(
      rng,
      canvasWidth * CurveRenderer.#EDGE_PADDING,
      canvasWidth * (1 - CurveRenderer.#EDGE_PADDING)
    );
    const randomY = randRange(
      rng,
      canvasHeight * CurveRenderer.#EDGE_PADDING,
      canvasHeight * (1 - CurveRenderer.#EDGE_PADDING)
    );

    const p0 = isHorizontal ? { x: -canvasWidth * 0.1, y: randomY } : { x: randomX, y: -canvasHeight * 0.1 };
    const p1 = isHorizontal ? { x: canvasWidth * 1.1, y: randomY } : { x: randomX, y: canvasHeight * 1.1 };

    if (segmentHitsAnyPlanet(p0, p1, planets, CurveRenderer.#PLANET_COLLISION_BUFFER)) return false;

    if (glowSelf) {
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = CurveRenderer.#REGULAR_GLOW_BLUR;
    }

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(2, Math.ceil(dist / 8));

    let prev = { ...p0 };
    let drawnLen = 0;
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
      drawnLen += segLen;
      prev = { x: nx, y: ny };

      segInBatch++;
      if (segInBatch >= batchSegs || s === steps) {
        if (hasDash) ctx.lineDashOffset = -drawnLen;
        ctx.stroke();
        segInBatch = 0;

        if (s !== steps) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          await stepper.yieldNow();
        }
      }
    }

    return true;
  }

  async #bezierAsync(ctx, rng, canvasWidth, canvasHeight, planets, arrowChance, glowSelf, stepper) {
    const isArrow = rng.bool(arrowChance ?? 0);

    // Arrow/satellite trajectory: p0 on border, p3 inside opposite quarters
    if (isArrow) {
      for (let attempt = 0; attempt < 16; attempt++) {
        const { start, end } = pickBorderToOppositeQuarterTarget(rng, canvasWidth, canvasHeight, MARKER_BASE_PAD_PX);

        const c1 = {
          x: randRange(rng, canvasWidth * 0.10, canvasWidth * 0.90),
          y: randRange(rng, canvasHeight * 0.10, canvasHeight * 0.90),
        };
        const c2 = {
          x: randRange(rng, canvasWidth * 0.10, canvasWidth * 0.90),
          y: randRange(rng, canvasHeight * 0.10, canvasHeight * 0.90),
        };

        if (curveHitsAnyPlanet(start, c1, c2, end, planets, CurveRenderer.#PLANET_COLLISION_BUFFER)) continue;

        ctx.shadowBlur = 0;
        ctx.shadowColor = "rgba(0,0,0,0)";
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255,255,255,0.55)";

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
        ctx.stroke();

        // tangent at end for marker orientation
        const tA = 0.98;
        const pA = cubicBezierPoint(start, c1, c2, end, tA);
        drawArrowOrSatellite(ctx, rng, pA, end, canvasWidth, canvasHeight);

        await stepper.yieldNow();
        return true;
      }
      return false;
    }

    for (let attempt = 0; attempt < 12; attempt++) {
      const edgeIn = (rng.float() * 4) | 0;
      const edgeOut = (rng.float() * 4) | 0;

      const p0 = pointOnEdge(rng, canvasWidth, canvasHeight, edgeIn, true);
      const p3 = pointOnEdge(rng, canvasWidth, canvasHeight, edgeOut, false);

      const c1 = {
        x: randRange(rng, canvasWidth * 0.10, canvasWidth * 0.90),
        y: randRange(rng, canvasHeight * 0.10, canvasHeight * 0.90),
      };
      const c2 = {
        x: randRange(rng, canvasWidth * 0.10, canvasWidth * 0.90),
        y: randRange(rng, canvasHeight * 0.10, canvasHeight * 0.90),
      };

      if (curveHitsAnyPlanet(p0, c1, c2, p3, planets, CurveRenderer.#PLANET_COLLISION_BUFFER)) continue;

      if (glowSelf) {
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = CurveRenderer.#REGULAR_GLOW_BLUR;
      }

      const approx =
        Math.hypot(c1.x - p0.x, c1.y - p0.y) +
        Math.hypot(c2.x - c1.x, c2.y - c1.y) +
        Math.hypot(p3.x - c2.x, p3.y - c2.y);
      const samples = Math.max(90, Math.ceil(approx / 8));

      const batchSegs = 42;
      let segInBatch = 0;

      let prev = p0;
      let drawnLen = 0;
      const hasDash = ctx.getLineDash().length > 0;

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);

      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        const pt = cubicBezierPoint(p0, c1, c2, p3, t);
        ctx.lineTo(pt.x, pt.y);

        const segLen = Math.hypot(pt.x - prev.x, pt.y - prev.y);
        drawnLen += segLen;
        prev = pt;

        segInBatch++;
        if (segInBatch >= batchSegs || i === samples) {
          if (hasDash) ctx.lineDashOffset = -drawnLen;
          ctx.stroke();
          segInBatch = 0;

          if (i !== samples) {
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            await stepper.yieldNow();
          }
        }
      }

      return true;
    }
    return false;
  }

  #line(ctx, rng, canvasWidth, canvasHeight, planets, arrowChance, glowSelf) {
    const isArrow = rng.bool(arrowChance ?? 0);

    if (isArrow) {
      const { start, end } = pickBorderToOppositeQuarterTarget(rng, canvasWidth, canvasHeight, MARKER_BASE_PAD_PX);
      if (segmentHitsAnyPlanet(start, end, planets, CurveRenderer.#PLANET_COLLISION_BUFFER)) return false;

      ctx.shadowBlur = 0;
      ctx.shadowColor = "rgba(0,0,0,0)";
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      drawArrowOrSatellite(ctx, rng, start, end, canvasWidth, canvasHeight);
      return true;
    }

    const isHorizontal = rng.bool(0.65);
    const randomX = randRange(
      rng,
      canvasWidth * CurveRenderer.#EDGE_PADDING,
      canvasWidth * (1 - CurveRenderer.#EDGE_PADDING)
    );
    const randomY = randRange(
      rng,
      canvasHeight * CurveRenderer.#EDGE_PADDING,
      canvasHeight * (1 - CurveRenderer.#EDGE_PADDING)
    );

    const p0 = isHorizontal ? { x: -canvasWidth * 0.1, y: randomY } : { x: randomX, y: -canvasHeight * 0.1 };
    const p1 = isHorizontal ? { x: canvasWidth * 1.1, y: randomY } : { x: randomX, y: canvasHeight * 1.1 };

    if (segmentHitsAnyPlanet(p0, p1, planets, CurveRenderer.#PLANET_COLLISION_BUFFER)) return false;

    if (glowSelf) {
      const baseStroke = ctx.strokeStyle;
      const baseLW = ctx.lineWidth;

      ctx.save();
      ctx.strokeStyle = baseStroke;
      ctx.shadowColor = baseStroke;
      ctx.shadowBlur = CurveRenderer.#REGULAR_GLOW_BLUR;
      ctx.globalAlpha = CurveRenderer.#REGULAR_GLOW_ALPHA_FACTOR;
      ctx.lineWidth = baseLW + CurveRenderer.#REGULAR_GLOW_SPREAD_PX;

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.shadowColor = "rgba(0,0,0,0)";
    ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();

    return true;
  }

  #bezier(ctx, rng, canvasWidth, canvasHeight, planets, arrowChance, glowSelf) {
    const isArrow = rng.bool(arrowChance ?? 0);

    if (isArrow) {
      for (let attempt = 0; attempt < 16; attempt++) {
        const { start, end } = pickBorderToOppositeQuarterTarget(rng, canvasWidth, canvasHeight, MARKER_BASE_PAD_PX);

        const c1 = {
          x: randRange(rng, canvasWidth * 0.10, canvasWidth * 0.90),
          y: randRange(rng, canvasHeight * 0.10, canvasHeight * 0.90),
        };
        const c2 = {
          x: randRange(rng, canvasWidth * 0.10, canvasWidth * 0.90),
          y: randRange(rng, canvasHeight * 0.10, canvasHeight * 0.90),
        };

        if (curveHitsAnyPlanet(start, c1, c2, end, planets, CurveRenderer.#PLANET_COLLISION_BUFFER)) continue;

        ctx.shadowBlur = 0;
        ctx.shadowColor = "rgba(0,0,0,0)";
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(255,255,255,0.55)";

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y);
        ctx.stroke();

        const pA = cubicBezierPoint(start, c1, c2, end, 0.98);
        drawArrowOrSatellite(ctx, rng, pA, end, canvasWidth, canvasHeight);
        return true;
      }
      return false;
    }

    for (let attempt = 0; attempt < 12; attempt++) {
      const edgeIn = (rng.float() * 4) | 0;
      const edgeOut = (rng.float() * 4) | 0;

      const p0 = pointOnEdge(rng, canvasWidth, canvasHeight, edgeIn, true);
      const p3 = pointOnEdge(rng, canvasWidth, canvasHeight, edgeOut, false);

      const c1 = {
        x: randRange(rng, canvasWidth * 0.10, canvasWidth * 0.90),
        y: randRange(rng, canvasHeight * 0.10, canvasHeight * 0.90),
      };
      const c2 = {
        x: randRange(rng, canvasWidth * 0.10, canvasWidth * 0.90),
        y: randRange(rng, canvasHeight * 0.10, canvasHeight * 0.90),
      };

      if (curveHitsAnyPlanet(p0, c1, c2, p3, planets, CurveRenderer.#PLANET_COLLISION_BUFFER)) continue;

      if (glowSelf) {
        const baseStroke = ctx.strokeStyle;
        const baseLW = ctx.lineWidth;

        ctx.save();
        ctx.strokeStyle = baseStroke;
        ctx.shadowColor = baseStroke;
        ctx.shadowBlur = CurveRenderer.#REGULAR_GLOW_BLUR;
        ctx.globalAlpha = CurveRenderer.#REGULAR_GLOW_ALPHA_FACTOR;
        ctx.lineWidth = baseLW + CurveRenderer.#REGULAR_GLOW_SPREAD_PX;

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p3.x, p3.y);
        ctx.stroke();
        ctx.restore();
      }

      ctx.shadowBlur = 0;
      ctx.shadowColor = "rgba(0,0,0,0)";
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p3.x, p3.y);
      ctx.stroke();

      return true;
    }
    return false;
  }

  #forceInterferenceFallback(ctx, rng, canvasWidth, canvasHeight, planets) {
    for (let attempt = 0; attempt < CurveRenderer.#FALLBACK_MAX_TRIES; attempt++) {
      const y = canvasHeight * randRange(rng, CurveRenderer.#FALLBACK_EDGE_PADDING_MIN, CurveRenderer.#FALLBACK_EDGE_PADDING_MAX);
      const p0 = { x: -canvasWidth * 0.1, y };
      const p1 = { x: canvasWidth * 1.1, y };

      if (segmentHitsAnyPlanet(p0, p1, planets, CurveRenderer.#PLANET_COLLISION_BUFFER)) continue;

      this.#drawFallbackInterferenceLine(ctx, p0, p1);
      return;
    }

    const y = canvasHeight * 0.5;
    this.#drawFallbackInterferenceLine(
      ctx,
      { x: -canvasWidth * 0.1, y },
      { x: canvasWidth * 1.1, y }
    );
  }

  /**
   * Draws a fallback interference line with indigo color, glow, and dashed styling.
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} startPoint - Line start point {x, y}
   * @param {Object} endPoint - Line end point {x, y}
   */
  #drawFallbackInterferenceLine(ctx, startPoint, endPoint) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = hexToRgba(CurveRenderer.#INDIGO_INTERFERENCE, 0.62);
    ctx.lineWidth = CurveRenderer.#FALLBACK_LINE_WIDTH;
    ctx.lineCap = "round";
    ctx.shadowColor = hexToRgba(CurveRenderer.#INDIGO_GLOW, 1);
    ctx.shadowBlur = CurveRenderer.#INDIGO_GLOW_BLUR;
    ctx.setLineDash(CurveRenderer.#FALLBACK_DASH);

    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();

    ctx.restore();
  }

  async #forceInterferenceFallbackAsync(ctx, rng, canvasWidth, canvasHeight, planets, stepper) {
    this.#forceInterferenceFallback(ctx, rng, canvasWidth, canvasHeight, planets);
    await stepper.yieldNow();
  }
}

/* -------------------------- Arrow/Satellite rendering -------------------------- */

// visual constraints
const MARKER_TIP_PADDING_PX = 50;
const ARROW_SIZE_PX = 32;

// satellite spec
const SAT_MAIN_SIZE = 32;
const SAT_PART_MIN = 4;
const SAT_PART_MAX = 8;
const SAT_PARTS_MIN = 1;
const SAT_PARTS_MAX = 3;

// ensure marker base is far enough that the *tip* stays >= 50px from border
const MARKER_BASE_PAD_PX = MARKER_TIP_PADDING_PX + Math.max(ARROW_SIZE_PX, SAT_MAIN_SIZE);

/**
 * Randomly selects either an arrow or satellite marker at the trajectory endpoint.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} rng - Random number generator
 * @param {Object} pPrev - Previous point on trajectory {x, y}
 * @param {Object} pEnd - Endpoint of trajectory {x, y}
 * @param {number} W - Canvas width
 * @param {number} H - Canvas height
 */
function drawArrowOrSatellite(ctx, rng, pPrev, pEnd, W, H) {
  if (rng.bool(0.5)) {
    drawArrowHeadAtEnd(ctx, pPrev, pEnd, W, H);
  } else {
    drawSatellite(ctx, rng, pPrev, pEnd);
  }
}

/**
 * Draws an arrow head at the endpoint of a trajectory.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} pPrev - Previous point on trajectory {x, y}
 * @param {Object} base - Arrow base point {x, y}
 * @param {number} W - Canvas width
 * @param {number} H - Canvas height
 */
function drawArrowHeadAtEnd(ctx, pPrev, base, W, H) {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "rgba(0,0,0,0)";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;

  // direction (from prev to end)
  let dx = base.x - pPrev.x;
  let dy = base.y - pPrev.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;

  // tip is ahead of the base along direction, but must stay inside rect padded 50
  const tipLimit = {
    x0: MARKER_TIP_PADDING_PX,
    y0: MARKER_TIP_PADDING_PX,
    x1: W - MARKER_TIP_PADDING_PX,
    y1: H - MARKER_TIP_PADDING_PX,
  };

  // max distance along (dx,dy) to keep tip inside tipLimit
  const maxLen = maxRayLenToStayInRect(base, dx, dy, tipLimit);
  const headLen = Math.max(6, Math.min(ARROW_SIZE_PX, maxLen));

  // Geometry: curve stops at `base` (triangle base). The arrow tip is ahead.
  const tip = { x: base.x + dx * headLen, y: base.y + dy * headLen };
  const px = -dy; // unit perpendicular
  const py = dx;
  const headW = Math.max(14, Math.min(28, headLen * 0.75));
  const left = { x: base.x + px * (headW * 0.5), y: base.y + py * (headW * 0.5) };
  const right = { x: base.x - px * (headW * 0.5), y: base.y - py * (headW * 0.5) };

  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

}

/**
 * Draws a satellite marker at the endpoint of a trajectory.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} rng - Random number generator
 * @param {Object} pPrev - Previous point on trajectory {x, y}
 * @param {Object} base - Satellite center point {x, y}
 */
function drawSatellite(ctx, rng, pPrev, base) {
  // oriented by trajectory direction
  let dx = base.x - pPrev.x;
  let dy = base.y - pPrev.y;
  const d = Math.hypot(dx, dy) || 1;
  dx /= d; dy /= d;

  // rotation angle
  const ang = Math.atan2(dy, dx);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // white glow on all shapes
  ctx.shadowColor = "rgba(255,255,255,0.9)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;

  // draw in local coords for easy rotation
  ctx.translate(base.x, base.y);
  ctx.rotate(ang);

  const half = SAT_MAIN_SIZE * 0.5;
  ctx.fillRect(-half, -half, SAT_MAIN_SIZE, SAT_MAIN_SIZE);

  const parts = randInt(rng, SAT_PARTS_MIN, SAT_PARTS_MAX);

  // parts placed around with 8..16 px gap from the main square
  const gaps = [];
  for (let i = 0; i < parts; i++) {
    const s = randInt(rng, SAT_PART_MIN, SAT_PART_MAX);
    const gap = randRange(rng, 8, 16);
    gaps.push({ s, gap });
  }

  // orbit ring: small circle connecting them (choose radius to fit largest part)
  const maxPart = Math.max(...gaps.map(g => g.s));
  const maxGap = Math.max(...gaps.map(g => g.gap));
  const orbitR = half + maxGap + maxPart * 0.6;

  ctx.beginPath();
  ctx.arc(0, 0, orbitR, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < parts; i++) {
    const { s, gap } = gaps[i];
    const partHalf = s * 0.5;
    const r = half + gap + partHalf;

    const t = (i / parts) * Math.PI * 2 + randRange(rng, -0.25, 0.25);
    const px = Math.cos(t) * r - partHalf;
    const py = Math.sin(t) * r - partHalf;
    ctx.fillRect(px, py, s, s);
  }

  ctx.restore();
}

/* -------------------------- Endpoint picking -------------------------- */

/**
 * Clamps a value between min and max bounds.
 * @param {number} v - Value to clamp
 * @param {number} lo - Lower bound
 * @param {number} hi - Upper bound
 * @returns {number} Clamped value
 */
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Generates a trajectory from canvas border to opposite quarter interior.
 * Starts exactly on border, ends inside the opposite half in one of two opposite quarters.
 * Enforces interior padding so markers never touch the border.
 * @param {Object} rng - Random number generator
 * @param {number} W - Canvas width
 * @param {number} H - Canvas height
 * @param {number} endPad - Interior padding for endpoint
 * @returns {Object} {start, end} points
 */
function pickBorderToOppositeQuarterTarget(rng, W, H, endPad) {
  const side = (rng.float() * 4) | 0; // 0 top,1 right,2 bottom,3 left

  // start on border (exact)
  let start;
  if (side === 0) start = { x: randRange(rng, 0, W), y: 0 };
  else if (side === 2) start = { x: randRange(rng, 0, W), y: H };
  else if (side === 3) start = { x: 0, y: randRange(rng, 0, H) };
  else start = { x: W, y: randRange(rng, 0, H) };

  // end in opposite quarters
  const end = { x: 0, y: 0 };
  const chooseLeft = rng.bool(0.5);

  if (side === 0) {
    // from top -> bottom-left or bottom-right quarter
    end.x = chooseLeft ? randRange(rng, 0, W * 0.5) : randRange(rng, W * 0.5, W);
    end.y = randRange(rng, H * 0.5, H);
  } else if (side === 2) {
    // from bottom -> top-left or top-right quarter
    end.x = chooseLeft ? randRange(rng, 0, W * 0.5) : randRange(rng, W * 0.5, W);
    end.y = randRange(rng, 0, H * 0.5);
  } else if (side === 3) {
    // from left -> right-top or right-bottom quarter
    end.x = randRange(rng, W * 0.5, W);
    end.y = chooseLeft ? randRange(rng, 0, H * 0.5) : randRange(rng, H * 0.5, H);
  } else {
    // from right -> left-top or left-bottom quarter
    end.x = randRange(rng, 0, W * 0.5);
    end.y = chooseLeft ? randRange(rng, 0, H * 0.5) : randRange(rng, H * 0.5, H);
  }

  // enforce endPad (so marker base is never too close to border)
  end.x = clamp(end.x, endPad, W - endPad);
  end.y = clamp(end.y, endPad, H - endPad);

  return { start, end };
}

/* -------------------------- Geometry helpers -------------------------- */

/**
 * Calculates maximum distance along a ray that stays within a rectangular bounds.
 * @param {Object} p - Ray origin point {x, y}
 * @param {number} dx - Ray direction x component (unit vector)
 * @param {number} dy - Ray direction y component (unit vector)
 * @param {Object} rect - Bounds {x0, y0, x1, y1}
 * @returns {number} Maximum parameter t such that p + t*(dx,dy) stays in rect
 */
function maxRayLenToStayInRect(p, dx, dy, rect) {
  let tMax = Infinity;

  if (dx > 1e-9) {
    tMax = Math.abs(Math.min(tMax, (rect.x1 - p.x) / dx));
  }
  else if (dx < -1e-9) {
    tMax = Math.abs(Math.min(tMax, (rect.x0 - p.x) / dx));
  }

  if (dy > 1e-9) {
    tMax = Math.abs(Math.min(tMax, (rect.y1 - p.y) / dy));
  }
  else if (dy < -1e-9) {
    tMax = Math.abs(Math.min(tMax, (rect.y0 - p.y) / dy));
  }

  if (!Number.isFinite(tMax)) {
    return 0;
  }
  return Math.max(0, tMax);
}

/**
 * Selects a random item from a weighted list.
 * @param {Object} rng - Random number generator
 * @param {Array<[any, number]>} items - Array of [value, weight] pairs
 * @returns {any} Randomly selected value
 */
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
