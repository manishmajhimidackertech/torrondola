// Procedural pixel art for the city and the tower. Everything is drawn once into
// small canvases and reused.
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
  plum: '#7b2d5b',
};

// Building palettes; the tower switches style every few floors.
// shutter = [panel, slat] for the persiane.
export const STYLES = [
  { wall: '#c8553d', light: '#e2775c', dark: '#93382a', trim: '#f2d0a4', shutter: ['#4c8a57', '#2f5e3a'] }, // terracotta
  { wall: '#2a9d8f', light: '#4fc2b3', dark: '#1c6e65', trim: '#e9f5db', shutter: ['#8a5a3c', '#5e3c27'] }, // teal
  { wall: '#e9b949', light: '#f6d77b', dark: '#b3832a', trim: '#fff7e0', shutter: ['#4c8a57', '#2f5e3a'] }, // ochre
  { wall: '#d1567f', light: '#eb7ea0', dark: '#933457', trim: '#ffe3ec', shutter: ['#4c8a57', '#2f5e3a'] }, // rose
  { wall: '#3f6fd8', light: '#6a93ef', dark: '#2a4b9a', trim: '#e3ecff', shutter: ['#e9e2d0', '#b9b0a0'] }, // azure
  { wall: '#7b5ea7', light: '#9b82c6', dark: '#4f3b75', trim: '#efe6ff', shutter: ['#e9e2d0', '#b9b0a0'] }, // violet
];
export const GOLD_STYLE = { wall: '#f5b143', light: '#ffd88a', dark: '#c07f2a', trim: '#fff4dc', shutter: ['#fff4dc', '#ffd88a'] };

const FRAME = '#2b1b33';
const LIT = '#ffd56b';
const LIT_HI = '#fff3c4';
const LIT_LOW = '#f0a94a';
const GLASS = '#2b3560';
const GLASS_HI = '#5b6fae';
const WOOD = '#8a5a3c';
const WOOD_HI = '#a8724e';
const LEAF = '#4bc292';
const LAUNDRY = ['#3fa7ff', '#ff5f55', '#fff4dc', '#f5b143', '#4bc292', '#ff9eb0'];

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

export function makeCanvas(w, h) {
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
export function maskSprite(rows, colors, outline = INK) {
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

// Copy of a sprite with a 1px outline around everything opaque.
export function withOutline(src, color = INK) {
  const [sil, sg] = makeCanvas(src.width, src.height);
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = color;
  sg.fillRect(0, 0, src.width, src.height);
  const [c, g] = makeCanvas(src.width + 2, src.height + 2);
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) g.drawImage(sil, dx, dy);
  g.drawImage(src, 1, 1);
  return c;
}

export function mirrored(src) {
  const [c, g] = makeCanvas(src.width, src.height);
  g.scale(-1, 1);
  g.drawImage(src, -src.width, 0);
  return c;
}

// --- tower floors ------------------------------------------------------------

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

const WINDOW_X = [6, 19, 33];
const WINDOW_Y = 7;

// state: 0 lit, 1 dark, 2 lit with curtains
function drawWindow(g, x, y, state, s, h = 13) {
  rect(g, FRAME, x, y, 9, h);
  if (state === 1) {
    rect(g, GLASS, x + 1, y + 1, 7, h - 2);
    rect(g, GLASS_HI, x + 6, y + 2, 1, 1);
    rect(g, GLASS_HI, x + 7, y + 3, 1, 1);
    rect(g, GLASS_HI, x + 2, y + h - 5, 1, 1);
  } else {
    rect(g, LIT, x + 1, y + 1, 7, h - 2);
    rect(g, LIT_LOW, x + 1, y + h - 4, 7, 3);
    rect(g, LIT_HI, x + 1, y + 1, 2, 1);
    rect(g, LIT_HI, x + 1, y + 2, 1, 1);
    if (state === 2) {
      rect(g, s.trim, x + 1, y + 1, 2, h - 2);
      rect(g, s.trim, x + 6, y + 1, 2, h - 2);
      rect(g, s.light, x + 1, y + 1, 7, 1);
    }
  }
  rect(g, FRAME, x + 4, y + 1, 1, h - 2);
  rect(g, FRAME, x + 1, y + 5, 7, 1);
}

function drawSill(g, x, y, s) {
  rect(g, s.trim, x - 1, y + 13, 11, 1);
  rect(g, s.dark, x, y + 14, 9, 1);
}

// Persiane: louvered shutters, open beside the window or closed over it.
function drawShutters(g, x, y, s, closed) {
  const [panel, slat] = s.shutter;
  const louver = (sx, w) => {
    rect(g, panel, sx, y, w, 13);
    for (let j = 1; j < 13; j += 2) rect(g, slat, sx, y + j, w, 1);
  };
  if (closed) {
    rect(g, FRAME, x, y, 9, 13);
    louver(x + 1, 7);
    rect(g, FRAME, x + 4, y + 1, 1, 11);
  } else {
    louver(x - 2, 2);
    louver(x + 9, 2);
  }
}

function drawFlowerBox(g, x, y, r) {
  rect(g, LEAF, x, y + 11, 9, 2);
  for (let i = 0; i < 5; i++) {
    const bloom = [PAL.red, '#ff9eb0', PAL.cream, PAL.red][Math.floor(r() * 4)];
    rect(g, bloom, x + i * 2, y + 10 + (i % 2), 1, 1);
  }
  rect(g, WOOD, x - 1, y + 13, 11, 2);
  rect(g, WOOD_HI, x - 1, y + 13, 11, 1);
}

function drawBalcony(g, s, r) {
  rect(g, s.trim, 2, 16, BW - 4, 1); // top rail
  rect(g, INK, 2, 15, BW - 4, 1);
  for (let x = 3; x < BW - 3; x += 3) rect(g, s.trim, x, 17, 1, 4); // balusters
  rect(g, s.trim, 2, 21, BW - 4, 1);
  rect(g, s.dark, 2, 22, BW - 4, 1);
  // geraniums in pots on the rail
  for (const px of [7, 22, 37]) {
    if (r() < 0.25) continue;
    rect(g, '#c0603c', px, 13, 4, 2);
    rect(g, LEAF, px - 1, 11, 6, 2);
    rect(g, PAL.red, px, 10, 1, 1);
    rect(g, PAL.red, px + 2, 10, 1, 1);
    rect(g, '#ff9eb0', px + 1, 11, 1, 1);
    rect(g, PAL.red, px + 3, 11, 1, 1);
  }
}

// A sagging clothesline across the floor with whatever's drying today.
function drawLaundry(g, r) {
  const x0 = 12;
  const x1 = 36;
  rect(g, '#d9cbb8', x0, 5, 1, 2);
  rect(g, '#d9cbb8', x1, 5, 1, 2);
  for (let x = x0; x <= x1; x++) {
    const t = (x - x0) / (x1 - x0);
    rect(g, '#d9cbb8', x, 6 + Math.round(Math.sin(t * Math.PI) * 2), 1, 1);
  }
  const lineY = (x) => 6 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 2);
  const pick = () => LAUNDRY[Math.floor(r() * LAUNDRY.length)];
  // T-shirt
  let x = 14;
  let c = pick();
  let y = lineY(x + 3) + 1;
  rect(g, c, x, y, 3, 1);
  rect(g, c, x + 4, y, 3, 1);
  rect(g, c, x, y + 1, 7, 1);
  rect(g, c, x + 1, y + 2, 5, 4);
  rect(g, INK, x + 1, y, 1, 1);
  rect(g, INK, x + 5, y, 1, 1);
  // towel
  x = 24;
  c = pick();
  y = lineY(x + 2) + 1;
  rect(g, c, x, y, 4, 6);
  rect(g, PAL.cream, x, y + 4, 4, 1);
  rect(g, INK, x, y, 1, 1);
  rect(g, INK, x + 3, y, 1, 1);
  // socks
  x = 31;
  c = pick();
  y = lineY(x) + 1;
  rect(g, c, x, y, 1, 3);
  rect(g, c, x, y + 3, 2, 1);
  rect(g, c, x + 3, y, 1, 3);
  rect(g, c, x + 3, y + 3, 2, 1);
}

// Round the top corners of a window into an arch, with a little keystone.
function archWindow(g, x, y, s) {
  rect(g, s.wall, x, y, 2, 1);
  rect(g, s.wall, x, y + 1, 1, 1);
  rect(g, s.wall, x + 7, y, 2, 1);
  rect(g, s.wall, x + 8, y + 1, 1, 1);
  rect(g, FRAME, x + 1, y + 1, 1, 1);
  rect(g, FRAME, x + 7, y + 1, 1, 1);
  rect(g, s.trim, x + 3, y - 2, 3, 1);
  rect(g, s.trim, x + 4, y - 1, 1, 1);
}

const FEATURES = [
  ['plain', 28],
  ['shutters', 26],
  ['flowers', 16],
  ['balcony', 14],
  ['laundry', 10],
  ['arched', 6],
];
const FEATURE_TOTAL = FEATURES.reduce((s, [, w]) => s + w, 0);
export const FLOOR_SEEDS = 96; // distinct looks per style; keeps the sprite cache small

const floorCache = new Map();

export function floorSprite(style, seed, s = STYLES[style % STYLES.length]) {
  const key = `${s.wall}:${seed}`;
  let c = floorCache.get(key);
  if (c) return c;
  const r = rng(seed * 7919 + 13);
  let roll = r() * FEATURE_TOTAL;
  const feature = FEATURES.find(([, w]) => (roll -= w) < 0)?.[0] ?? 'plain';
  const states = WINDOW_X.map(() => (r() < 0.55 ? 0 : r() < 0.6 ? 1 : 2));

  let g;
  [c, g] = makeCanvas(BW, BH);
  drawShell(g, s);
  if (feature === 'balcony') {
    WINDOW_X.forEach((x, i) => drawWindow(g, x, WINDOW_Y, states[i], s, 15));
    drawBalcony(g, s, r);
  } else {
    WINDOW_X.forEach((x, i) => {
      const closed = feature === 'shutters' && r() < 0.3;
      if (closed) drawShutters(g, x, WINDOW_Y, s, true);
      else {
        drawWindow(g, x, WINDOW_Y, states[i], s);
        if (feature === 'shutters') drawShutters(g, x, WINDOW_Y, s, false);
        if (feature === 'arched') archWindow(g, x, WINDOW_Y, s);
      }
      if (feature === 'flowers') drawFlowerBox(g, x, WINDOW_Y, r);
      else drawSill(g, x, WINDOW_Y, s);
    });
    if (feature === 'laundry') drawLaundry(g, r);
  }
  floorCache.set(key, c);
  return c;
}

// Rare golden floor: every window lit, ornamented cornice.
export function goldSprite(seed) {
  const c = floorSprite(0, seed, GOLD_STYLE);
  if (c.gilded) return c;
  const g = c.getContext('2d');
  for (let x = 3; x < BW - 3; x += 4) rect(g, PAL.cream, x, 2, 1, 1);
  rect(g, '#fff9ea', 1, 4, 1, BH - 5);
  c.gilded = true;
  return c;
}

let baseCache = null;

// Ground floor: a little bar with a striped awning.
export function baseSprite() {
  if (baseCache) return baseCache;
  const s = STYLES[0];
  const [c, g] = makeCanvas(BW, BH);
  drawShell(g, s);
  drawWindow(g, 5, 7, 0, s);
  drawSill(g, 5, 7, s);
  drawShutters(g, 5, 7, s, false);
  drawWindow(g, 34, 7, 2, s);
  drawSill(g, 34, 7, s);
  drawShutters(g, 34, 7, s, false);
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
  baseCache = c;
  return c;
}

// --- small UI sprites ----------------------------------------------------------

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
export const pauseIcon = maskSprite(['cc.cc', 'cc.cc', 'cc.cc', 'cc.cc', 'cc.cc', 'cc.cc', 'cc.cc'], { c: PAL.cream });

// --- city and sky ------------------------------------------------------------

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
