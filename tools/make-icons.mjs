// Draws the 32x32 pixel-art app icon and writes it, scaled up with nearest
// neighbour, as the PNGs the manifest and index.html point to.
// Usage: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const N = 32;

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const px = Array.from({ length: N * N }, () => hex('#1d1236'));
const set = (x, y, c) => {
  if (x >= 0 && y >= 0 && x < N && y < N) px[y * N + x] = hex(c);
};
const rect = (x, y, w, h, c) => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, c);
};

// Swirly glow behind the tower.
const GLOW = ['#8e3f7e', '#5a2f7d', '#40246a', '#2c1a4f'];
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - 15.5, y - 13) + Math.sin(Math.atan2(y - 13, x - 15.5) * 3 + y * 0.15) * 1.6;
    const band = Math.max(0, Math.floor(d / 4.5));
    if (band < GLOW.length) set(x, y, GLOW[band]);
  }
}

const INK = '#1a1028';
function floor(x, y, wall, light, dark, trim) {
  rect(x, y, 14, 7, INK);
  rect(x + 1, y + 1, 12, 5, wall);
  rect(x + 1, y + 1, 12, 1, trim);
  rect(x + 1, y + 2, 1, 4, light);
  rect(x + 11, y + 2, 2, 4, dark);
  for (const wx of [3, 6, 9]) rect(x + wx, y + 3, 2, 2, '#ffd56b');
}

// Ground and the stacked tower.
rect(0, 28, N, 4, '#221a33');
rect(0, 27, N, 1, '#9a8fb8');
floor(9, 20, '#c8553d', '#e2775c', '#93382a', '#f2d0a4');
floor(10, 14, '#2a9d8f', '#4fc2b3', '#1c6e65', '#e9f5db');
// The swinging block on its rope, nudged sideways, with motion marks.
const ROPE = '#f2e3c6';
for (const [x, y] of [[15, 0], [16, 1]]) set(x, y, ROPE);
rect(15, 2, 4, 1, '#f5b143');
set(14, 3, ROPE);
set(19, 3, ROPE);
floor(10, 4, '#e9b949', '#f6d77b', '#b3832a', '#fff7e0');
for (const [x, y] of [[7, 5], [6, 6], [6, 7], [7, 8], [27, 5], [28, 6], [28, 7], [27, 8]]) set(x, y, '#b9aedc');

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const [r, g, b] = px[Math.floor((y * N) / size) * N + Math.floor((x * N) / size)];
      raw.set([r, g, b], row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
const files = {
  'favicon-32.png': 32,
  'apple-touch-icon.png': 192,
  'icon-192.png': 192,
  'icon-512.png': 512,
  // The art keeps its subject inside the central safe zone, so it doubles as the maskable icon.
  'icon-maskable-512.png': 512,
};
for (const [name, size] of Object.entries(files)) writeFileSync(join(OUT, name), png(size));
console.log(`wrote ${Object.keys(files).length} icons to ${OUT}`);
