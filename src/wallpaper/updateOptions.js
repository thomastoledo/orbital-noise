import { DEFAULT_OPTIONS } from "./defaultOptions.js";

/**
 * @typedef {import("../styles/styleProfiles.js").StyleProfile} StyleProfile
 */

/**
 * Merges caller options with defaults and applies style-specific scaling.
 *
 * @param {Record<string, any>} options
 * @param {StyleProfile} profile
 * @returns {Record<string, any>}
 */
export function updateOptions(options = {}, profile) {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  return profile.scaleOptions ? profile.scaleOptions(merged) : merged;
}
