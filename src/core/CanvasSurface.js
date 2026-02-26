export class CanvasSurface {
  constructor(canvas, width, height) {
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas required");
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D context unavailable");

    this.canvas = canvas;
    this.ctx = ctx;

    canvas.width = width;
    canvas.height = height;
  }

  clear(color = "#000000") {
    const { ctx, canvas } = this;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}
