/**
 * @typedef {"normal" | "gold" | "blue-ink"} StyleId
 * @typedef {"desktop-4k" | "mobile"} FormatId
 * @typedef {"desktop" | "mobile"} GeneratorMode
 *
 * @typedef {Object} GeneratorModule
 * @property {(canvas: HTMLCanvasElement, options?: Record<string, unknown>) => GenerationInfo} generateWallpaper
 * @property {(canvas: HTMLCanvasElement, options?: Record<string, unknown>) => Promise<GenerationInfo>} [generateWallpaperAsync]
 *
 * @typedef {Object} GenerationInfo
 * @property {number} seed
 * @property {number} width
 * @property {number} height
 * @property {string[]} [colors]
 * @property {number} [planetCount]
 *
 * @typedef {Object} StyleConfig
 * @property {StyleId} id
 * @property {string} label
 * @property {string} importPath
 *
 * @typedef {Object} FormatConfig
 * @property {FormatId} id
 * @property {string} label
 * @property {number} width
 * @property {number} height
 * @property {GeneratorMode} generatorMode
 */

const BASE_AREA = 2560 * 1440;
const AREA_4K = 3840 * 2160;

/**
 * Shared density factors used by the original generators.
 * Keeping these values centralized makes scaling behavior explicit.
 */
export const DENSITY_SETTINGS = Object.freeze({
  densityFactor: AREA_4K / BASE_AREA,
  perceptualDensityFactor: (AREA_4K / BASE_AREA) * 0.75 + 0.25,
});

/** @type {readonly StyleConfig[]} */
export const STYLE_OPTIONS = Object.freeze([
  {
    id: "normal",
    label: "Normal Cosmos",
    importPath: "./modes/normal/index.js",
  },
  {
    id: "gold",
    label: "Gold Cosmos",
    importPath: "./modes/gold/index.js",
  },
  {
    id: "blue-ink",
    label: "Blue Ink Cosmos",
    importPath: "./modes/blue-ink/index.js",
  },
]);

/** @type {readonly FormatConfig[]} */
export const FORMAT_OPTIONS = Object.freeze([
  {
    id: "desktop-4k",
    label: "Desktop 4K (3840x2160)",
    width: 3840,
    height: 2160,
    generatorMode: "desktop",
  },
  {
    id: "mobile",
    label: "Mobile (2160x3840)",
    width: 2160,
    height: 3840,
    generatorMode: "mobile",
  },
]);

/**
 * Creates a stable integer seed compatible with existing RNG implementations.
 * @returns {number}
 */
export function createSeed() {
  return (Math.random() * 2 ** 31) | 0;
}
