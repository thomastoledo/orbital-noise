/**
 * Clamps a number to a minimum integer value.
 * @param {number} value
 * @param {number} min
 * @returns {number}
 */
function clampMinInt(value, min) {
  return Math.max(min, Math.round(value));
}

/**
 * Scales a range tuple and clamps each endpoint.
 * @param {[number, number]} range
 * @param {number} factor
 * @param {number} min
 * @returns {[number, number]}
 */
export function scaleRange(range, factor, min = 1) {
  return [clampMinInt(range[0] * factor, min), clampMinInt(range[1] * factor, min)];
}

/**
 * Applies density scaling for module counts with a soft cap divisor.
 * @param {[number, number]} modules
 * @param {number} factor
 * @returns {[number, number]}
 */
export function scaleConstellationModules(modules, factor) {
  const divisor = Math.min(factor, 1.5);
  return [
    clampMinInt((modules[0] * factor) / divisor, 2),
    clampMinInt((modules[1] * factor) / divisor, 2),
  ];
}
