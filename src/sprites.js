// Procedural pixel art. Everything is drawn once into small canvases and reused.
import { BW, BH } from './config.js';

export const INK = '#1a1028';

export const PAL = {
  cream: '#fff4dc',
  dim: '#b9aedc',
  gold: '#f5b143',
  red: '#ff5f55',
  green: '#4bc292',
  blue: '#3fa7ff',
  orange: '#ff8b3d',
  purple: '#a48cf0',
};

// Building palettes; the tower switches style every few floors.
export const STYLES = [
  { wall: '#c8553d', light: '#e2775c', dark: '#93382a', trim: '#f2d0a4' }, // terracotta
  { wall: '#2a9d8f', light: '#4fc2b3', dark: '#1c6e65', trim: '#e9f5db' }, // teal
  { wall: '#e9b949', light: '#f6d77b', dark: '#b3832a', trim: '#fff7e0' }, // ochre
  { wall: '#d1567f', light: '#eb7ea0', dark: '#933457', trim: '#ffe3ec' }, // rose
  { wall: '#3f6fd8', light: '#6a93ef', dark: '#2a4b9a', trim: '#e3ecff' }, // azure
  { wall: '#7b5ea7', light: '#9b82c6', dark: '#4f3b75', trim: '#efe6ff' }, // violet
];

const FRAME = '#2b1b33';
const LIT = '#ffd56b';
const LIT_HI = '#fff3c4';
const LIT_LOW = '#f0a94a';
const GLASS = '#2b3560';
const GLASS_HI = '#5b6fae';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function rect(g, color, x, y, w, h) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

// Turns a character mask into a sprite. Each non-'.' character maps to a color;
// with an outline color, every empty pixel touching the shape gets outlined.
function maskSprite(rows, colors, outline = INK) {
  const pad = outline ? 1 : 0;
  const h = rows.length;
  const w = rows[0].length;
  const [c, g] = makeCanvas(w + pad * 2, h + pad * 2);
  if (outline) {
    g.fillStyle = outline;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) if (rows[y][x] !== '.') g.fillRect(x, y, 3, 3);
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch !== '.') rect(g, colors[ch], x + pad, y + pad, 1, 1);
    }
  }
  return c;
}

function drawShell(g, s) {
  rect(g, s.wall, 0, 0, BW, BH);
  rect(g, INK, 0, 0, BW, 1); // roof line
  rect(g, s.trim, 0, 1, BW, 2); // cornice
  rect(g, s.dark, 0, 3, BW, 1); // cornice shadow
  rect(g, s.light, 1, 4, 2, BH - 5);
  rect(g, s.dark, BW - 4, 4, 3, BH - 5);
  rect(g, s.dark, 0, BH - 1, BW, 1); // floor slab
  rect(g, INK, 0, 0, 1, BH);
  rect(g, INK, BW - 1, 0, 1, BH);
}

// state: 0 lit, 1 dark, 2 lit with curtains
function drawWindow(g, x, y, state, s) {
  rect(g, FRAME, x, y, 9, 13);
  if (state === 1) {
    rect(g, GLASS, x + 1, y + 1, 7, 11);
    rect(g, GLASS_HI, x + 6, y + 2, 1, 1);
    rect(g, GLASS_HI, x + 7, y + 3, 1, 1);
    rect(g, GLASS_HI, x + 2, y + 8, 1, 1);
  } else {
    rect(g, LIT, x + 1, y + 1, 7, 11);
    rect(g, LIT_LOW, x + 1, y + 9, 7, 3);
    rect(g, LIT_HI, x + 1, y + 1, 2, 1);
    rect(g, LIT_HI, x + 1, y + 2, 1, 1);
    if (state === 2) {
      rect(g, s.trim, x + 1, y + 1, 2, 11);
      rect(g, s.trim, x + 6, y + 1, 2, 11);
      rect(g, s.light, x + 1, y + 1, 7, 1);
    }
  }
  rect(g, FRAME, x + 4, y + 1, 1, 11);
  rect(g, FRAME, x + 1, y + 5, 7, 1);
  rect(g, s.trim, x - 1, y + 13, 11, 1); // sill
  rect(g, s.dark, x, y + 14, 9, 1);
}

const blockCache = new Map();

// variant 0..26 encodes the state of the three windows (base 3).
export function blockSprite(style, variant, base = false) {
  const key = `${style}:${variant}:${base}`;
  let c = blockCache.get(key);
  if (c) return c;
  const s = STYLES[style % STYLES.length];
  let g;
  [c, g] = makeCanvas(BW, BH);
  drawShell(g, s);
  if (base) {
    drawWindow(g, 5, 7, variant % 3, s);
    drawWindow(g, 34, 7, Math.floor(variant / 3) % 3, s);
    // door
    rect(g, INK, 18, 10, 12, BH - 11);
    rect(g, '#6b3a26', 19, 11, 10, BH - 12);
    rect(g, LIT, 20, 13, 3, 6);
    rect(g, LIT, 25, 13, 3, 6);
    rect(g, LIT_HI, 20, 13, 1, 2);
    rect(g, INK, 23, 11, 2, BH - 12);
    rect(g, PAL.gold, 22, 20, 1, 2);
    rect(g, PAL.gold, 25, 20, 1, 2);
    // striped awning
    rect(g, INK, 15, 5, 18, 1);
    for (let x = 16; x < 32; x++) {
      const col = Math.floor((x - 16) / 2) % 2 ? PAL.cream : PAL.red;
      rect(g, col, x, 6, 1, 3);
      if (x % 2 === 0) rect(g, col, x, 9, 1, 1);
    }
  } else {
    [6, 19, 33].forEach((x, i) => drawWindow(g, x, 7, Math.floor(variant / 3 ** i) % 3, s));
  }
  blockCache.set(key, c);
  return c;
}

export const hookSprite = maskSprite(
  ['..kkkkkk..', '.kyyyyyyk.', 'kywyyyyyyk', 'kyyyyyyyyk', 'kooooooook', '.kkkkkkkk.'],
  { k: INK, y: PAL.gold, w: '#ffe2a0', o: '#c07f2a' },
  null,
);

const HEART = ['.rr.rr.', 'rwrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
export const heartFull = maskSprite(HEART, { r: PAL.red, w: '#ffd0c8' });
export const heartEmpty = maskSprite(HEART, { r: '#3a2a4a', w: '#3a2a4a' });

export const speakerOn = maskSprite(
  ['...c.....', '..cc..c..', 'cccc...c.', 'cccc.c.c.', 'cccc...c.', '..cc..c..', '...c.....'],
  { c: PAL.cream },
);
export const speakerOff = maskSprite(
  ['...c.....', '..cc.....', 'cccc.r.r.', 'cccc..r..', 'cccc.r.r.', '..cc.....', '...c.....'],
  { c: PAL.dim, r: PAL.red },
);

// A strip of city silhouettes, drawn bottom-aligned into a width x height canvas.
export function makeSkyline(width, height, seed, body, windowColor, windowChance, minH, maxH) {
  const [c, g] = makeCanvas(width, height);
  const r = rng(seed);
  let x = 0;
  while (x < width) {
    const w = 10 + Math.floor(r() * 26);
    const h = minH + Math.floor(r() * (maxH - minH));
    const top = height - h;
    rect(g, body, x, top, w, h);
    const roof = r();
    if (roof < 0.25) rect(g, body, x + (w >> 1), top - 7, 1, 7);
    else if (roof < 0.5) rect(g, body, x + 3, top - 3, w - 6, 3);
    g.fillStyle = windowColor;
    for (let wy = top + 4; wy < height - 4; wy += 4) {
      for (let wx = x + 2; wx < x + w - 2; wx += 3) if (r() < windowChance) g.fillRect(wx, wy, 1, 2);
    }
    x += w + (r() < 0.3 ? 1 + Math.floor(r() * 4) : 0);
  }
  return c;
}

export function makeCloud(seed) {
  const r = rng(seed);
  const w = 26 + Math.floor(r() * 26);
  const h = 13 + Math.floor(r() * 5);
  const baseR = 3;
  const puffs = [];
  const count = 2 + Math.floor(r() * 2);
  for (let i = 0; i < count; i++) {
    const rad = h * (0.32 + r() * 0.22);
    const x = rad + 1 + ((w - 2 * rad - 2) * (i + 0.2 + r() * 0.6)) / count;
    puffs.push({ x, y: h - baseR - 1, r: rad });
  }
  const inside = (x, y) => {
    const cx = Math.max(baseR, Math.min(w - baseR, x));
    if ((x - cx) ** 2 + (y - (h - baseR)) ** 2 <= baseR * baseR) return true; // flat base
    return puffs.some((p) => (x - p.x) ** 2 + (y - p.y) ** 2 <= p.r * p.r);
  };
  const [c, g] = makeCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const shade = y >= h - 2 || !inside(x + 0.5, y + 2.5);
      const lit = !inside(x + 0.5, y - 1.5) && !shade;
      rect(g, shade ? '#b9a6d6' : lit ? '#fbf3ff' : '#e9dcf5', x, y, 1, 1);
    }
  }
  return c;
}
