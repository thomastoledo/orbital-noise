/**
 * Draws a small signature in the bottom-right corner.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {{ textColor: string, strokeColor?: string | null }} style
 */
export function drawSignature(ctx, width, height, style) {
  const text = "Orbital Noise by Thomo";
  const pad = Math.max(14, Math.floor(Math.min(width, height) * 0.012));

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";

  const fontPx = Math.max(12, Math.floor(Math.min(width, height) * 0.014));
  ctx.font = `${fontPx}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;

  if (style.strokeColor) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.strokeColor;
    ctx.strokeText(text, width - pad, height - pad);
  }

  ctx.fillStyle = style.textColor;
  ctx.fillText(text, width - pad, height - pad);

  ctx.restore();
}
