/**
 * Frame stepper for progressive rendering.
 * Call `await stepper.tick(n)` inside loops.
 */

const nextFrame = () =>
  new Promise((resolve) => {
    // eslint-disable-next-line no-undef
    requestAnimationFrame(() => resolve());
  });

export class Stepper {
  /**
   * @param {{ enabled?: boolean, opsPerFrame?: number }} cfg
   */
  constructor(cfg = {}) {
    this.enabled = cfg.enabled ?? false;
    this.opsPerFrame = Math.max(1, cfg.opsPerFrame ?? 160);
    this._ops = 0;
  }

  /**
   * @param {number} [n]
   */
  async tick(n = 1) {
    if (!this.enabled) return;
    this._ops += n;
    if (this._ops >= this.opsPerFrame) {
      this._ops = 0;
      await nextFrame();
    }
  }

  /**
   * Force a frame boundary (useful when you want "one item per frame"
   * regardless of opsPerFrame).
   */
  async yieldNow() {
    if (!this.enabled) return;
    this._ops = 0;
    await nextFrame();
  }
}
