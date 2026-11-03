// Small pixel drawing helpers shared by the renderer and the postcard.
import { INK } from './sprites.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export function line(g, x0, y0, x1, y1, color) {
  g.fillStyle = color;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (y0 >= 0) g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Filled rectangle with 1px-rounded corners and an ink outline.
export function box(g, x, y, w, h, fill, outline = INK) {
  g.fillStyle = outline;
  g.fillRect(x + 1, y - 1, w - 2, h + 2);
  g.fillRect(x - 1, y + 1, w + 2, h - 2);
  g.fillRect(x, y, w, h);
  g.fillStyle = fill;
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
}

export function panel(g, x, y, w, h) {
  g.fillStyle = INK;
  g.fillRect(x + 1, y + h + 1, w - 2, 2); // drop shadow
  box(g, x, y, w, h, '#3d2e5c');
  g.fillStyle = '#241a3a';
  g.fillRect(x + 1, y + 2, w - 2, h - 3);
}

// Vertical gradient between a list of colors, dithered with a Bayer matrix.
export function ditherGradient(g, x, y, w, h, colors) {
  const steps = colors.length - 1;
  for (let j = 0; j < h; j++) {
    const f = (j / Math.max(1, h - 1)) * steps;
    const base = Math.min(steps - 1, Math.floor(f));
    for (let i = 0; i < w; i++) {
      const up = f - base > BAYER[((j & 3) << 2) | (i & 3)];
      g.fillStyle = colors[base + (up ? 1 : 0)];
      g.fillRect(x + i, y + j, 1, 1);
    }
  }
}
