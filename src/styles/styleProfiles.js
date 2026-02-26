import { derive3Shades, neonHsl } from "../color/colors.js";
import { randRange } from "../utils/math.js";
import { scaleConstellationModules, scaleRange } from "../wallpaper/scaleUtils.js";
import { Constellations } from "../render/ConstellationsRenderer.js";
import { Starfield } from "../render/StarfieldRenderer.js";
import { NebulaRenderer } from "../render/NebulaRenderer.js";
import { PlanetRenderer } from "../render/PlanetRenderer.js";
import { RingRenderer } from "../render/RingRenderer.js";
import { CurveRenderer as StandardCurveRenderer } from "../render/StandardCurveRenderer.js";
import { CurveRenderer as GoldCurveRenderer } from "../render/GoldCurveRenderer.js";
import {
  INK_PALETTE,
  pick3PlanetShades,
  pickPlanetColor,
  pickTraceColor,
} from "../palette/inkPalette.js";

/**
 * @typedef {"normal" | "gold" | "blue-ink"} StyleId
 *
 * @typedef {Object} PaletteConfig
 * @property {string} background
 * @property {string} starColor
 * @property {string} ringsColor
 * @property {string} curvesColor
 * @property {string | null} constellationColor
 * @property {(index: number, total: number) => string} getPlanetColor
 * @property {() => string[]} infoColors
 * @property {{ textColor: string, strokeColor?: string | null }} signature
 *
 * @typedef {Object} RendererBundle
 * @property {NebulaRenderer} nebula
 * @property {Starfield} stars
 * @property {Constellations} constellations
 * @property {PlanetRenderer} planets
 * @property {RingRenderer} rings
 * @property {StandardCurveRenderer | GoldCurveRenderer} curves
 *
 * @typedef {Object} StyleProfile
 * @property {StyleId} id
 * @property {number} starCountFactor
 * @property {(rng: import("../core/RNG.js").RNG) => PaletteConfig} createPalette
 * @property {() => RendererBundle} createRenderers
 * @property {(rng: import("../core/RNG.js").RNG) => string} [pickConstellationColor]
 * @property {(options: Record<string, any>) => Record<string, any>} scaleOptions
 */

/**
 * @param {Record<string, any>} opt
 * @returns {Record<string, any>}
 */
function scaleNormalOptions(opt) {
  const densityFactor = opt.densityFactor ?? 1;
  const perceptualDensityFactor = opt.perceptualDensityFactor ?? densityFactor;

  if (opt.mode === "desktop" && densityFactor !== 1) {
    opt.starCount = opt.starCount ? Math.round(opt.starCount * densityFactor) : null;
    opt.constellationConnectChance *= densityFactor;
    opt.constellationModules = scaleConstellationModules(opt.constellationModules, densityFactor);
    opt.nebulaChance *= densityFactor;
    opt.curveCount = scaleRange(opt.curveCount, densityFactor / Math.min(densityFactor, 1.25));
    opt.ringCount = scaleRange(opt.ringCount, densityFactor);
    return opt;
  }

  if (opt.mode === "mobile" && perceptualDensityFactor !== 1) {
    opt.starCount = opt.starCount ? Math.round(opt.starCount * perceptualDensityFactor) : null;
    opt.constellationConnectChance *= perceptualDensityFactor;
    opt.constellationModules = scaleConstellationModules(
      opt.constellationModules,
      perceptualDensityFactor
    );
    opt.nebulaChance *= perceptualDensityFactor;
    opt.curveCount = scaleRange(
      opt.curveCount,
      perceptualDensityFactor / Math.min(densityFactor, 1.25)
    );
    opt.ringCount = scaleRange(opt.ringCount, perceptualDensityFactor);
  }

  return opt;
}

/**
 * @param {Record<string, any>} opt
 * @returns {Record<string, any>}
 */
function scaleGoldOptions(opt) {
  const densityFactor = opt.densityFactor ?? 1;
  const perceptualDensityFactor = opt.perceptualDensityFactor ?? densityFactor;

  if (opt.mode === "desktop" && densityFactor !== 1) {
    opt.starCount = opt.starCount ? Math.round(opt.starCount * densityFactor) : null;
    opt.constellationConnectChance *= densityFactor;
    opt.constellationModules = scaleConstellationModules(opt.constellationModules, densityFactor);
    opt.nebulaChance *= densityFactor;
    opt.curveCount = scaleRange(opt.curveCount, densityFactor);
    opt.ringCount = scaleRange(opt.ringCount, densityFactor);
    return opt;
  }

  if (opt.mode === "mobile" && perceptualDensityFactor !== 1) {
    opt.starCount = opt.starCount ? Math.round(opt.starCount * perceptualDensityFactor) : null;
    opt.constellationConnectChance *= perceptualDensityFactor;
    opt.constellationModules = scaleConstellationModules(
      opt.constellationModules,
      perceptualDensityFactor
    );
    opt.nebulaChance *= perceptualDensityFactor;
    opt.curveCount = scaleRange(opt.curveCount, perceptualDensityFactor);
    opt.ringCount = scaleRange(opt.ringCount, perceptualDensityFactor);
  }

  return opt;
}

/**
 * @param {Record<string, any>} opt
 * @returns {Record<string, any>}
 */
function scaleBlueInkOptions(opt) {
  const densityFactor = opt.densityFactor ?? 1;
  const perceptualDensityFactor = opt.perceptualDensityFactor ?? densityFactor;

  opt.starCount = opt.starCount ? Math.round(opt.starCount * perceptualDensityFactor) : null;
  opt.constellationConnectChance *= densityFactor;
  opt.constellationModules = scaleRange(opt.constellationModules, densityFactor, 2);
  opt.nebulaChance *= densityFactor;
  opt.curveCount = scaleRange(opt.curveCount, densityFactor);
  opt.ringCount = scaleRange(opt.ringCount, densityFactor);

  return opt;
}

/** @type {Record<StyleId, StyleProfile>} */
const PROFILES = {
  normal: {
    id: "normal",
    starCountFactor: 0.2,
    createPalette(rng) {
      const baseHue = rng.float() * 360;
      const mainPlanetColor = neonHsl(baseHue, 100, 62);
      const ringsColor = neonHsl((baseHue + 180) % 360, 100, 60);
      const curvesColor = neonHsl((baseHue + (rng.bool(0.5) ? 120 : 240)) % 360, 100, 60);

      return {
        background: "#000000",
        starColor: "#FFFFFF",
        ringsColor,
        curvesColor,
        constellationColor: "#FFFFFF",
        getPlanetColor(index) {
          if (index === 0) return mainPlanetColor;
          return neonHsl((baseHue + randRange(rng, 25, 335)) % 360, 100, randRange(rng, 56, 66));
        },
        infoColors() {
          return [mainPlanetColor, ringsColor, curvesColor];
        },
        signature: {
          textColor: "#FFFFFF",
          strokeColor: "#000000",
        },
      };
    },
    createRenderers() {
      return {
        nebula: new NebulaRenderer({
          pickShades(rng) {
            const base = neonHsl(rng.float() * 360, 100, 62);
            return derive3Shades(base);
          },
        }),
        stars: new Starfield(),
        constellations: new Constellations(),
        planets: new PlanetRenderer({
          theme: { type: "neon", asyncSprayMode: "standard" },
        }),
        rings: new RingRenderer(),
        curves: new StandardCurveRenderer(),
      };
    },
    scaleOptions: scaleNormalOptions,
  },

  gold: {
    id: "gold",
    starCountFactor: 0.2,
    createPalette() {
      const palette = {
        background: "#070b1f",
        starColor: "#f6e6b1",
        planetColors: ["#9f7c19", "#c0982c", "#c4a85a", "#d4c9a2"],
        ringsColor: "#d4af37",
        curvesColor: "#d4af37",
        constellationColor: "#f2e6c9",
      };

      return {
        background: palette.background,
        starColor: palette.starColor,
        ringsColor: palette.ringsColor,
        curvesColor: palette.curvesColor,
        constellationColor: palette.constellationColor,
        getPlanetColor(index, total) {
          if (index === 0) return palette.planetColors[0];
          const secondary = palette.planetColors.slice(1);
          return secondary[(index - 1) % Math.max(1, Math.min(total, secondary.length))];
        },
        infoColors() {
          return [
            ...palette.planetColors,
            palette.ringsColor,
            palette.curvesColor,
          ];
        },
        signature: {
          textColor: "#d4af37",
          strokeColor: "#070b1f",
        },
      };
    },
    createRenderers() {
      return {
        nebula: new NebulaRenderer({
          pickShades(rng) {
            const base = rng.bool(0.35) ? "#9f7c19" : "#e3c77a";
            return derive3Shades(base);
          },
        }),
        stars: new Starfield({
          color: "#f6e6b1",
          glow: {
            enabled: true,
            color: "#f2e6c9",
            chance: 0.55,
            blur: 4,
          },
          sizeRanges: {
            tiny: [1, 2],
            small: [4, 8],
            medium: [10, 16],
            large: [17, 24],
          },
          largeMinSize: 17,
        }),
        constellations: new Constellations(),
        planets: new PlanetRenderer({
          theme: { type: "neon", asyncSprayMode: "batched" },
        }),
        rings: new RingRenderer(),
        curves: new GoldCurveRenderer(),
      };
    },
    scaleOptions: scaleGoldOptions,
  },

  "blue-ink": {
    id: "blue-ink",
    starCountFactor: 0.6,
    createPalette(rng) {
      const mainPlanetColor = pickPlanetColor(rng);
      const ringsColor = pickTraceColor(rng);
      const curvesColor = pickTraceColor(rng);

      return {
        background: INK_PALETTE.background,
        starColor: INK_PALETTE.star,
        ringsColor,
        curvesColor,
        constellationColor: null,
        getPlanetColor(index) {
          if (index === 0) return mainPlanetColor;
          return pickPlanetColor(rng);
        },
        infoColors() {
          return [mainPlanetColor, ringsColor, curvesColor];
        },
        signature: {
          textColor: INK_PALETTE.traceDark,
          strokeColor: null,
        },
      };
    },
    createRenderers() {
      return {
        nebula: new NebulaRenderer({
          pickShades: pick3PlanetShades,
          cornerInnerDotsRange: [11000, 22000],
        }),
        stars: new Starfield({ color: INK_PALETTE.star }),
        constellations: new Constellations(),
        planets: new PlanetRenderer({
          theme: {
            type: "ink",
            inkPalette: INK_PALETTE,
            asyncSprayMode: "standard",
          },
        }),
        rings: new RingRenderer(),
        curves: new StandardCurveRenderer(),
      };
    },
    pickConstellationColor: pickTraceColor,
    scaleOptions: scaleBlueInkOptions,
  },
};

/**
 * @param {StyleId} styleId
 * @returns {StyleProfile}
 */
export function getStyleProfile(styleId) {
  const profile = PROFILES[styleId];
  if (!profile) {
    throw new Error(`Unknown style profile: ${styleId}`);
  }
  return profile;
}
