import { RNG } from "../core/RNG.js";
import { CanvasSurface } from "../core/CanvasSurface.js";
import { randInt, randRange } from "../utils/math.js";
import { pickNonOverlappingPosition } from "../utils/geom.js";
import { Stepper } from "../utils/stepper.js";
import { updateOptions } from "./updateOptions.js";
import { drawSignature } from "./signature.js";

/**
 * @typedef {import("../styles/styleProfiles.js").StyleProfile} StyleProfile
 */

/**
 * @param {StyleProfile} profile
 * @returns {{
 *   generateWallpaper: (canvas: HTMLCanvasElement, options?: Record<string, any>) => {
 *     seed: number,
 *     width: number,
 *     height: number,
 *     colors: string[],
 *     planetCount: number,
 *   },
 *   generateWallpaperAsync: (canvas: HTMLCanvasElement, options?: Record<string, any>) => Promise<{
 *     seed: number,
 *     width: number,
 *     height: number,
 *     colors: string[],
 *     planetCount: number,
 *   }>
 * }}
 */
export function createWallpaperGenerator(profile) {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Record<string, any>} [options]
   */
  function generateWallpaper(canvas, options = {}) {
    const opt = updateOptions(options, profile);
    const surface = new CanvasSurface(canvas, opt.width, opt.height);
    const ctx = surface.ctx;
    const rng = new RNG(opt.seed);

    const palette = profile.createPalette(rng);
    const renderers = profile.createRenderers();

    surface.clear(palette.background);

    const { mainPlanet, planets } = buildPlanetLayout(rng, opt, palette);

    renderers.nebula.drawSingle(
      ctx,
      rng,
      opt.width,
      opt.height,
      planets,
      mainPlanet,
      opt.nebulaChance
    );

    const starCount = computeStarCount(opt, profile.starCountFactor);

    const starList = renderers.stars.placeAndDraw(
      ctx,
      rng,
      opt.width,
      opt.height,
      starCount,
      planets,
      {
        avoidMargin: opt.starAvoidMargin,
        color: palette.starColor,
      }
    );

    renderers.constellations.draw(ctx, rng, starList, planets, {
      modules: randInt(rng, opt.constellationModules[0], opt.constellationModules[1]),
      connectChance: opt.constellationConnectChance,
      color: palette.constellationColor,
      pickColor: profile.pickConstellationColor,
    });

    for (const planet of planets) {
      renderers.planets.draw(ctx, rng, planet);
    }

    renderers.rings.draw(
      ctx,
      rng,
      mainPlanet,
      palette.ringsColor,
      randInt(rng, opt.ringCount[0], opt.ringCount[1])
    );

    renderers.curves.draw(ctx, rng, opt.width, opt.height, planets, palette.curvesColor, {
      count: randInt(rng, opt.curveCount[0], opt.curveCount[1]),
      arrowChance: opt.arrowChance,
    });

    drawSignature(ctx, opt.width, opt.height, palette.signature);

    return {
      seed: opt.seed,
      width: opt.width,
      height: opt.height,
      colors: palette.infoColors(),
      planetCount: planets.length,
    };
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Record<string, any>} [options]
   */
  async function generateWallpaperAsync(canvas, options = {}) {
    const opt = updateOptions(options, profile);
    const surface = new CanvasSurface(canvas, opt.width, opt.height);
    const ctx = surface.ctx;
    const rng = new RNG(opt.seed);

    const palette = profile.createPalette(rng);
    const renderers = profile.createRenderers();
    const stepper = new Stepper({
      enabled: true,
      opsPerFrame: opt.progress?.opsPerFrame ?? 160,
    });

    surface.clear(palette.background);
    await stepper.tick(1);

    const { mainPlanet, planets } = buildPlanetLayout(rng, opt, palette);
    await stepper.tick(1);

    await renderers.nebula.drawSingleAsync(
      ctx,
      rng,
      opt.width,
      opt.height,
      planets,
      mainPlanet,
      opt.nebulaChance,
      stepper
    );
    await stepper.tick(1);

    const starCount = computeStarCount(opt, profile.starCountFactor);

    const starList = await renderers.stars.placeAndDrawAsync(
      ctx,
      rng,
      opt.width,
      opt.height,
      starCount,
      planets,
      {
        avoidMargin: opt.starAvoidMargin,
        batch: opt.progress?.starsBatch ?? 1,
        color: palette.starColor,
      },
      stepper
    );
    await stepper.tick(1);

    await renderers.constellations.drawAsync(
      ctx,
      rng,
      starList,
      planets,
      {
        modules: randInt(rng, opt.constellationModules[0], opt.constellationModules[1]),
        connectChance: opt.constellationConnectChance,
        color: palette.constellationColor,
        pickColor: profile.pickConstellationColor,
      },
      stepper
    );
    await stepper.tick(1);

    for (const planet of planets) {
      await renderers.planets.drawAsync(ctx, rng, planet, stepper);
      await stepper.tick(1);
    }

    await renderers.rings.drawAsync(
      ctx,
      rng,
      mainPlanet,
      palette.ringsColor,
      randInt(rng, opt.ringCount[0], opt.ringCount[1]),
      stepper
    );
    await stepper.tick(1);

    await renderers.curves.drawAsync(
      ctx,
      rng,
      opt.width,
      opt.height,
      planets,
      palette.curvesColor,
      {
        count: randInt(rng, opt.curveCount[0], opt.curveCount[1]),
        arrowChance: opt.arrowChance,
      },
      stepper
    );
    await stepper.tick(1);

    drawSignature(ctx, opt.width, opt.height, palette.signature);
    await stepper.tick(1);

    return {
      seed: opt.seed,
      width: opt.width,
      height: opt.height,
      colors: palette.infoColors(),
      planetCount: planets.length,
    };
  }

  return { generateWallpaper, generateWallpaperAsync };
}

/**
 * @param {Record<string, any>} opt
 * @param {number} starCountFactor
 * @returns {number}
 */
function computeStarCount(opt, starCountFactor) {
  const area = opt.width * opt.height;
  return (
    opt.starCount ??
    Math.floor(starCountFactor * Math.max(2400, Math.min(16000, Math.floor(area / 220000))))
  );
}

/**
 * @param {RNG} rng
 * @param {Record<string, any>} opt
 * @param {{ getPlanetColor: (index: number, total: number) => string }} palette
 * @returns {{ mainPlanet: { cx: number, cy: number, r: number, color: string, kind: "main" }, planets: Array<{ cx: number, cy: number, r: number, color: string, kind: "main" | "small" }> }}
 */
function buildPlanetLayout(rng, opt, palette) {
  const minDim = Math.min(opt.width, opt.height);
  const mainRadius = minDim * randRange(rng, opt.planetMainRadius[0], opt.planetMainRadius[1]);

  const centerX = opt.width / 2;
  const centerY = opt.height / 2;
  const upperThirdY = randRange(rng, opt.height * (1 / 6), opt.height * (1 / 3));

  const mainPlanet = {
    cx: centerX,
    cy: rng.bool(0.5) ? centerY : upperThirdY,
    r: mainRadius,
    color: palette.getPlanetColor(0, 1),
    kind: "main",
  };

  const planets = [mainPlanet];
  const planetTotal = randInt(rng, opt.planetCount[0], opt.planetCount[1]);

  for (let i = 1; i < planetTotal; i++) {
    const radius = minDim * randRange(rng, opt.planetSmallRadius[0], opt.planetSmallRadius[1]);
    const position = pickNonOverlappingPosition(rng, opt.width, opt.height, radius, planets, {
      margin: 1.45,
      tries: 80,
    });

    planets.push({
      cx: position.x,
      cy: position.y,
      r: radius,
      color: palette.getPlanetColor(i, planetTotal),
      kind: "small",
    });
  }

  return { mainPlanet, planets };
}
