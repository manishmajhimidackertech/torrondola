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

// Every canvas the game draws into: nearest-neighbour scaling, never smoothed.
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
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

const shadeCache = new WeakMap();

// A darker copy of a sprite, for things sitting further back.
export function shaded(src) {
  let c = shadeCache.get(src);
  if (!c) {
    let g;
    [c, g] = makeCanvas(src.width, src.height);
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(26,16,40,0.38)';
    g.fillRect(0, 0, src.width, src.height);
    shadeCache.set(src, c);
  }
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

// --- countryside --------------------------------------------------------------
// Everything stands on `base`: the y of the ground under it. Buildings get the
// lowest ground under their whole footprint, so on a slope the uphill side
// settles into the hill instead of the downhill side floating in the air.

const DOOR = '#6b4a30';
const DARK = '#3a2e26';

function cypress(g, x, base, h, p) {
  for (let j = 0; j < h; j++) {
    const w = j < 2 ? 1 : j < 5 ? 2 : j > h - 3 ? 3 : 4;
    const left = x - Math.floor(w / 2);
    rect(g, p.tree, left, base - h + j, w, 1);
    if (w > 2 && j % 3 === 0) rect(g, p.treeLight, left, base - h + j, 1, 1);
  }
}

function olive(g, x, base, p) {
  rect(g, '#7a5a3a', x, base - 3, 1, 3);
  rect(g, p.olive, x - 3, base - 7, 7, 3);
  rect(g, p.olive, x - 2, base - 8, 5, 1);
  rect(g, p.oliveShade, x - 3, base - 5, 7, 1);
}

// Pino domestico: a tall bare trunk under a flat, wide canopy.
function umbrellaPine(g, x, base, p) {
  rect(g, '#7a5a3a', x, base - 10, 1, 10);
  rect(g, p.pine, x - 5, base - 13, 11, 3);
  rect(g, p.pine, x - 3, base - 14, 7, 1);
  rect(g, p.pineLight, x - 4, base - 13, 8, 1);
}

function haystacks(g, x, ground, r) {
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const hx = x + i * 6;
    const base = Math.max(ground(hx), ground(hx + 4));
    rect(g, '#e2b450', hx, base - 4, 5, 4);
    rect(g, '#f2cf72', hx + 1, base - 4, 3, 1);
    rect(g, '#c8963a', hx, base - 1, 5, 1);
    rect(g, '#c8963a', hx + 2, base - 3, 1, 1);
  }
  return n * 6;
}

// A patch of sunflowers in rows down the hillside.
function sunflowers(g, x, ground, w) {
  for (let i = 0; i < w; i++) {
    for (let k = 0; k < 3; k++) {
      if ((i + k) % 2) continue;
      const y = ground(x + i) + k * 2;
      rect(g, '#f5c542', x + i, y, 1, 1);
      rect(g, '#4f8a3f', x + i, y + 1, 1, 1);
    }
  }
}

function windowPair(g, x, y, p, shutters) {
  rect(g, DARK, x, y, 2, 2);
  if (shutters) {
    rect(g, p.shutter, x - 1, y, 1, 2);
    rect(g, p.shutter, x + 2, y, 1, 2);
  }
}

function farmhouse(g, x, base, r, p, small) {
  const w = small ? 6 + Math.floor(r() * 3) : 10 + Math.floor(r() * 5);
  const h = small ? 4 : 6 + Math.floor(r() * 3);
  rect(g, p.walls, x, base - h, w, h);
  rect(g, p.shade, x + w - 2, base - h, 2, h);
  const rows = small ? 2 : 3;
  for (let j = 0; j < rows; j++) rect(g, p.roof, x - 1 + j, base - h - 1 - j, w + 2 - j * 2, 1);
  if (!small) {
    rect(g, p.roofDark, x - 1, base - h - 1, w + 2, 1);
    rect(g, p.shade, x + 2, base - h - 5, 1, 2); // chimney
    const shutters = r() < 0.6;
    windowPair(g, x + 2, base - h + 2, p, shutters);
    if (w > 11) windowPair(g, x + w - 5, base - h + 2, p, shutters);
    rect(g, DOOR, x + Math.floor(w / 2), base - 3, 2, 3);
  }
  return w;
}

// Fienile: a stone barn with a big arched opening.
function barn(g, x, base, r, p) {
  const w = 12;
  const h = 7;
  rect(g, p.stone, x, base - h, w, h);
  for (let i = 0; i < 6; i++) rect(g, p.stoneDark, x + Math.floor(r() * w), base - 1 - Math.floor(r() * (h - 1)), 1, 1);
  rect(g, DARK, x + 4, base - 5, 4, 5);
  rect(g, p.stone, x + 4, base - 5, 1, 1);
  rect(g, p.stone, x + 7, base - 5, 1, 1);
  rect(g, p.roof, x - 1, base - h - 1, w + 2, 1);
  rect(g, p.roof, x, base - h - 2, w, 1);
  return w;
}

// Chiesetta: a little country chapel with a bell gable.
function chapel(g, x, base, r, p) {
  const w = 9;
  const h = 8;
  rect(g, p.walls, x, base - h, w, h);
  rect(g, p.shade, x + w - 1, base - h, 1, h);
  for (let j = 0; j < 5; j++) rect(g, p.roof, x - 1 + j, base - h - 1 - j, w + 2 - j * 2, 1);
  rect(g, p.walls, x + 3, base - h - 9, 3, 4);
  rect(g, DARK, x + 4, base - h - 8, 1, 2);
  rect(g, p.roof, x + 3, base - h - 10, 3, 1);
  rect(g, DARK, x + 4, base - h + 2, 1, 1); // rose window
  rect(g, DOOR, x + 3, base - 4, 3, 4);
  rect(g, p.walls, x + 3, base - 4, 1, 1);
  rect(g, p.walls, x + 5, base - 4, 1, 1);
  return w;
}

// An ochre villa with green shutters and a loggia of three arches.
function villa(g, x, base, r, p) {
  const w = 22;
  const h = 11;
  rect(g, p.ochre, x, base - h, w, h);
  rect(g, p.ochreShade, x + w - 3, base - h, 3, h);
  rect(g, p.roof, x - 1, base - h - 1, w + 2, 1);
  rect(g, p.roof, x + 1, base - h - 2, w - 2, 1);
  rect(g, p.roofDark, x - 1, base - h - 1, w + 2, 1);
  for (let i = 0; i < 4; i++) windowPair(g, x + 3 + i * 5, base - h + 2, p, true);
  for (let i = 0; i < 3; i++) {
    const ax = x + 3 + i * 6;
    rect(g, '#4a3a30', ax, base - 4, 4, 4);
    rect(g, p.ochre, ax, base - 4, 1, 1);
    rect(g, p.ochre, ax + 3, base - 4, 1, 1);
  }
  return w;
}

// A tall stone tower house, San Gimignano style.
function towerHouse(g, x, base, r, p) {
  const h = 16 + Math.floor(r() * 6);
  rect(g, p.stone, x, base - h, 5, h);
  rect(g, p.stoneDark, x + 4, base - h, 1, h);
  for (let y = base - h + 3; y < base - 3; y += 5) rect(g, DARK, x + 2, y, 1, 2);
  for (const cx of [0, 2, 4]) rect(g, p.stone, x + cx, base - h - 1, 1, 1);
  rect(g, DOOR, x + 1, base - 3, 2, 3);
  return 5;
}

// The one castle on the skyline: a walled hill town with its keep and church.
function castleTown(g, x, base, p) {
  for (const [hx, hh] of [[2, 7], [6, 9], [13, 6], [26, 8], [30, 6]]) {
    rect(g, p.walls, x + hx, base - hh, 4, hh);
    rect(g, p.roof, x + hx, base - hh - 1, 4, 1);
  }
  rect(g, p.walls, x + 18, base - 18, 5, 18); // keep
  rect(g, p.shade, x + 22, base - 18, 1, 18);
  for (const cx of [18, 20, 22]) rect(g, p.walls, x + cx, base - 19, 1, 1);
  rect(g, DARK, x + 20, base - 14, 1, 2);
  rect(g, p.walls, x + 10, base - 13, 3, 13); // bell tower
  rect(g, p.roof, x + 10, base - 14, 3, 1);
  rect(g, p.roof, x + 11, base - 15, 1, 1);
  rect(g, DARK, x + 11, base - 11, 1, 2);
  rect(g, p.shade, x, base - 5, 36, 5); // town walls
  for (let i = 0; i < 36; i += 2) rect(g, p.shade, x + i, base - 6, 1, 1);
  rect(g, DARK, x + 16, base - 3, 2, 3); // gate
  return 36;
}

// A strip of rolling hills, bottom-aligned in a width x height canvas. The ridge
// is a sum of sines with whole cycles per strip, so the strip tiles seamlessly.
// o.weights picks what grows along the ridge; o.castle places the one castle
// at that fraction of the strip, on the nearest hilltop.
export function makeHills(width, height, seed, o) {
  const [c, g] = makeCanvas(width, height);
  const r = rng(seed);
  const waves = o.waves.map(([amp, cycles]) => [amp, cycles, r() * Math.PI * 2]);
  const ridge = (x) =>
    Math.round(o.base + waves.reduce((s, [amp, cyc, ph]) => s + amp * Math.sin((x / width) * Math.PI * 2 * cyc + ph), 0));
  const ground = (x) => ridge(x) + 2;
  const span = (x0, w) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let x = x0; x < x0 + w; x++) {
      lo = Math.min(lo, ground(x));
      hi = Math.max(hi, ground(x));
    }
    return { floor: hi, slope: hi - lo };
  };

  for (let x = 0; x < width; x++) {
    const top = ridge(x);
    rect(g, o.hill, x, top, 1, height - top);
    rect(g, o.rim, x, top, 1, 1);
    if (o.rows && Math.floor(x / 40) % 3 === 1) {
      for (let k = 1; k <= 4; k++) if ((x + k) % 2) rect(g, o.rows, x, top + 3 + k * 4, 1, 1); // vineyard rows
    }
  }

  // The castle sits on the highest point near its spot; nothing else crowds it.
  let castle = null;
  if (o.castle) {
    let best = Infinity;
    for (let x = Math.round(width * o.castle) - 8; x < width * o.castle + 8; x++) {
      const s = span(x, 36);
      const score = ridge(x + 18) + s.slope * 2;
      if (score < best) {
        best = score;
        castle = { x, base: s.floor + 1 };
      }
    }
  }

  const kinds = Object.entries(o.weights);
  const total = kinds.reduce((sum, [, w]) => sum + w, 0);
  for (let x = 6; x < width - 30; ) {
    if (castle && x > castle.x - 14 && x < castle.x + 40) {
      x = castle.x + 40;
      continue;
    }
    let roll = r() * total;
    let kind = kinds.find(([, w]) => (roll -= w) < 0)?.[0] ?? 'gap';
    const sizes = { farmhouse: 16, barn: 13, chapel: 10, villa: 23, tower: 6, cottage: 9 };
    // buildings only go on gentle ground; a steep spot gets trees instead
    if (sizes[kind] && span(x, sizes[kind]).slope > 4) kind = 'cypress';
    const base = sizes[kind] ? span(x, sizes[kind]).floor + 1 : ground(x);
    let used;
    switch (kind) {
      case 'farmhouse':
        used = farmhouse(g, x, base, r, o.p, false);
        break;
      case 'cottage':
        used = farmhouse(g, x, base, r, o.p, true);
        break;
      case 'barn':
        used = barn(g, x, base, r, o.p);
        break;
      case 'chapel':
        used = chapel(g, x, base, r, o.p);
        break;
      case 'villa':
        used = villa(g, x, base, r, o.p);
        break;
      case 'tower':
        used = towerHouse(g, x, base, r, o.p);
        break;
      case 'cypress': {
        const n = 1 + Math.floor(r() * 4); // cypresses grow in little rows
        for (let i = 0; i < n; i++) cypress(g, x + i * 4, ground(x + i * 4), o.treeH[0] + Math.floor(r() * o.treeH[1]), o.p);
        used = n * 4;
        break;
      }
      case 'olive': {
        const n = 1 + Math.floor(r() * 3); // a small grove
        for (let i = 0; i < n; i++) olive(g, x + 3 + i * 8, ground(x + 3 + i * 8), o.p);
        used = n * 8;
        break;
      }
      case 'pine':
        umbrellaPine(g, x + 5, ground(x + 5), o.p);
        used = 11;
        break;
      case 'hay':
        used = haystacks(g, x, ground, r);
        break;
      case 'sunflowers':
        used = 14 + Math.floor(r() * 10);
        sunflowers(g, x, ground, used);
        break;
      default:
        used = 4;
    }
    x += used + 4 + Math.floor(r() * 8);
  }
  if (castle) castleTown(g, castle.x, castle.base, o.p);
  return c;
}

// Cobblestones for the piazza the tower stands on, as a repeating tile.
export function makeCobbles() {
  const [c, g] = makeCanvas(16, 8);
  rect(g, '#a8936e', 0, 0, 16, 8);
  for (const [x, y] of [[0, 0], [8, 0], [4, 4], [12, 4], [-4, 4]]) {
    rect(g, '#c9b48e', x + 1, y + 1, 6, 2);
    rect(g, '#dccaa6', x + 1, y + 1, 5, 1);
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
      rect(g, shade ? '#cfe0f0' : lit ? '#ffffff' : '#f2f8fd', x, y, 1, 1);
    }
  }
  return c;
}
