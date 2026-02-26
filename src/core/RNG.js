/**
 * Deterministic RNG wrapper using the Mulberry32 algorithm.
 * Mulberry32 is a fast, simple 32-bit PRNG with good statistical properties.
 * See: https://github.com/bryc/code/blob/master/jsfiddle/snippets/mulberry32/index.js
 */
export class RNG {
  /**
   * @param {number} seed - Initial seed value for reproducible sequences
   */
  constructor(seed) {
    this._state = seed >>> 0; // Convert to unsigned 32-bit integer
  }

  /**
   * Mulberry32 algorithm: produces pseudorandom float in [0, 1)
   * @returns {number} Random float between 0 (inclusive) and 1 (exclusive)
   */
  float() {
    let stateValue = (this._state += 0x6d2b79f5); // Add magic constant
    stateValue = Math.imul(stateValue ^ (stateValue >>> 15), stateValue | 1);
    stateValue ^= stateValue + Math.imul(stateValue ^ (stateValue >>> 7), stateValue | 61);
    return ((stateValue ^ (stateValue >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Random integer in range [a, b] (inclusive)
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   * @returns {number} Random integer
   */
  int(min, max) {
    return (min + Math.floor(this.float() * (max - min + 1))) | 0;
  }

  /**
   * Random boolean with given probability
   * @param {number} probability - Probability of returning true (0 to 1)
   * @returns {boolean}
   */
  bool(probability = 0.5) {
    return this.float() < probability;
  }
}
