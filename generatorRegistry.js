import { STYLE_OPTIONS } from "./config.js";

/** @type {Map<import("./config.js").StyleId, import("./config.js").GeneratorModule>} */
const generatorCache = new Map();

/** @type {Map<import("./config.js").StyleId, import("./config.js").StyleConfig>} */
const styleLookup = new Map(STYLE_OPTIONS.map((style) => [style.id, style]));

/**
 * Lazily loads one of the existing generator modules and caches it.
 * @param {import("./config.js").StyleId} styleId
 * @returns {Promise<import("./config.js").GeneratorModule>}
 */
export async function loadGenerator(styleId) {
  const style = styleLookup.get(styleId);
  if (!style) {
    throw new Error(`Unsupported style "${styleId}".`);
  }

  const cached = generatorCache.get(styleId);
  if (cached) {
    return cached;
  }

  const module = /** @type {import("./config.js").GeneratorModule} */ (await import(style.importPath));
  if (typeof module.generateWallpaper !== "function") {
    throw new Error(`Generator "${styleId}" is missing generateWallpaper().`);
  }

  generatorCache.set(styleId, module);
  return module;
}
