// "Saluti da Torrondola": the end-of-run postcard with a little photo of your
// tower. Rendered once per game over, shown on screen and shareable as a PNG.
import { BW } from './config.js';
import { drawText } from './font.js';
import { GOLD_STYLE, INK, PAL, STYLES, makeCanvas, rng } from './sprites.js';
import { cardIcon } from './art.js';
import { CARDS } from './cards.js';
import { box, clamp, ditherGradient } from './draw.js';

export const POSTCARD_W = 164;
export const POSTCARD_H = 110;

const PAPER = '#fbf3e4';
const AIRMAIL = ['#d1495b', PAPER, '#3f6fd8', PAPER];
const LABEL = '#8a7fa6';
const RULE = '#e2d6e8';
const LOGO = [PAL.red, PAL.gold, PAL.green, PAL.blue, PAL.purple];
const SKIES = [
  ['#2c1a4f', '#5a2f7d', '#8e3f7e', '#d1708a'], // dusk
  ['#0c1430', '#1b2d63', '#2f4d94'], // night
  ['#06040f', '#170f38', '#2f185c'], // space
];

function photo(g, s, x, y, w, h, r) {
  g.fillStyle = INK;
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  const groundY = y + h - 8;
  const sky = SKIES[s.floors >= 50 ? 2 : s.floors >= 25 ? 1 : 0];
  ditherGradient(g, x, y, w, groundY - y, sky);
  if (s.floors >= 25) {
    g.fillStyle = PAL.cream;
    for (let i = 0; i < 16; i++) g.fillRect(x + Math.floor(r() * w), y + Math.floor(r() * (h * 0.6)), 1, 1);
    g.fillStyle = '#f4ecd8';
    g.fillRect(x + w - 13, y + 5, 4, 6);
    g.fillRect(x + w - 14, y + 6, 6, 4);
  }
  // distant city along the ground
  g.fillStyle = '#160c26';
  for (let bx = x; bx < x + w; ) {
    const bw = 3 + Math.floor(r() * 6);
    const bh = 3 + Math.floor(r() * 12);
    g.fillRect(bx, groundY - bh, Math.min(bw, x + w - bx), bh);
    bx += bw;
  }
  g.fillStyle = '#9a8fb8';
  g.fillRect(x, groundY, w, 1);
  g.fillStyle = '#221a33';
  g.fillRect(x, groundY + 1, w, h - 9);

  // The tower, squeezed to fit: up to 7px per floor, at least 1px.
  const blocks = s.blocks;
  const avail = groundY - y - 6;
  const fh = clamp(Math.floor(avail / blocks.length), 1, 7);
  const fw = fh >= 6 ? 12 : fh === 5 ? 10 : fh >= 3 ? 8 : fh === 2 ? 6 : 4;
  const count = Math.min(blocks.length, Math.floor(avail / fh));
  const cx = x + w / 2;
  let fx = 0;
  let fy = groundY;
  for (let i = 0; i < count; i++) {
    const b = blocks[i];
    const st = b.gold ? GOLD_STYLE : STYLES[b.style % STYLES.length];
    fx = Math.round(cx + (b.ox * fw) / BW - fw / 2);
    fy = groundY - (i + 1) * fh;
    g.fillStyle = INK;
    g.fillRect(fx - 1, fy, fw + 2, fh);
    g.fillStyle = st.wall;
    g.fillRect(fx, fy, fw, fh);
    if (fh >= 3) {
      g.fillStyle = st.trim;
      g.fillRect(fx, fy, fw, 1);
    }
    if (fh >= 5) {
      for (const k of [0.25, 0.5, 0.75]) {
        g.fillStyle = r() < 0.65 ? '#ffd56b' : '#2b3560';
        g.fillRect(fx + Math.round(fw * k) - 1, fy + 2, 1, 2);
      }
    }
  }
  g.fillStyle = INK;
  g.fillRect(fx - 1, fy - 1, fw + 2, 1);

  // Nonna waving at the foot of the tower.
  const nx = Math.round(cx + (blocks[0].ox * fw) / BW + fw / 2 + 5);
  g.fillStyle = '#d8d2e6';
  g.fillRect(nx, groundY - 7, 2, 1);
  g.fillStyle = '#f2c29b';
  g.fillRect(nx, groundY - 6, 2, 1);
  g.fillRect(nx + 2, groundY - 8, 1, 2);
  g.fillStyle = PAL.plum;
  g.fillRect(nx, groundY - 5, 2, 5);
  g.fillRect(nx + 2, groundY - 6, 1, 2);

  if (s.toppled) {
    const sx = Math.round(cx - 23);
    const sy = Math.round(y + h * 0.45);
    g.fillStyle = '#d1495b';
    g.fillRect(sx, sy, 46, 13);
    g.fillStyle = PAPER;
    g.fillRect(sx + 1, sy + 1, 44, 11);
    drawText(g, 'CROLLO!', cx, sy + 3, { color: '#d1495b', align: 'center' });
  }
}

function stamp(g, x, y) {
  g.fillStyle = '#ffffff';
  g.fillRect(x, y, 22, 26);
  g.fillStyle = PAPER; // perforations
  for (let i = 1; i < 22; i += 2) {
    g.fillRect(x + i, y, 1, 1);
    g.fillRect(x + i, y + 25, 1, 1);
  }
  for (let j = 1; j < 26; j += 2) {
    g.fillRect(x, y + j, 1, 1);
    g.fillRect(x + 21, y + j, 1, 1);
  }
  ditherGradient(g, x + 2, y + 2, 18, 22, ['#ff8b3d', '#f5b143', '#ffe2a0']);
  g.fillStyle = PAL.cream; // sun
  g.fillRect(x + 4, y + 4, 4, 4);
  const floors = [['#2a9d8f', 0], ['#e9b949', 1], ['#c8553d', -1]];
  floors.forEach(([col, off], i) => {
    const fy = y + 19 - i * 5;
    g.fillStyle = INK;
    g.fillRect(x + 7 + off, fy, 9, 5);
    g.fillStyle = col;
    g.fillRect(x + 8 + off, fy + 1, 7, 3);
  });
  g.fillStyle = INK; // the next floor, still on the rope
  g.fillRect(x + 12, y + 2, 1, 3);
}

function postmark(g, cx, cy) {
  g.fillStyle = '#6b5f8a';
  for (let y = -9; y <= 9; y++) {
    for (let x = -9; x <= 9; x++) {
      const d = Math.hypot(x, y);
      if (Math.abs(d - 8) < 0.5 || Math.abs(d - 5.5) < 0.5) g.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

export function renderPostcard(s) {
  const W = POSTCARD_W;
  const H = POSTCARD_H;
  const [c, g] = makeCanvas(W, H);
  const r = rng(s.floors * 7919 + s.score);

  box(g, 1, 1, W - 2, H - 2, PAPER);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const edge = Math.min(x - 1, y - 1, W - 2 - x, H - 2 - y);
      if (edge >= 3 || ((x === 1 || x === W - 2) && (y === 1 || y === H - 2))) continue;
      g.fillStyle = AIRMAIL[((x + y) >> 2) & 3];
      g.fillRect(x, y, 1, 1);
    }
  }
  g.fillStyle = '#f1e6d0';
  for (let i = 0; i < 50; i++) g.fillRect(5 + Math.floor(r() * (W - 10)), 5 + Math.floor(r() * (H - 10)), 1, 1);

  photo(g, s, 8, 8, 60, 94, r);
  stamp(g, W - 30, 7);
  postmark(g, W - 31, 30);

  const tx = 74;
  drawText(g, 'SALUTI DA', tx, 9, { color: INK });
  drawText(g, 'TORRONDOLA', tx, 19, { colors: LOGO, outline: INK });
  const rows = [
    ['PIANI', s.floors],
    ['PUNTI', s.score],
    ['COMBO', `X${s.bestCombo}`],
  ];
  rows.forEach(([label, value], i) => {
    const y = 34 + i * 11;
    g.fillStyle = RULE;
    for (let x = tx; x < W - 8; x += 2) g.fillRect(x, y + 8, 1, 1);
    drawText(g, label, tx, y, { color: LABEL });
    drawText(g, value, W - 8, y, { color: INK, align: 'right' });
  });

  const owned = CARDS.filter((card) => s.owned[card.id]);
  owned.slice(0, 6).forEach((card, i) => {
    const icon = cardIcon(card.id);
    const ix = tx + i * 14;
    if (icon) g.drawImage(icon, ix, 68);
    else drawText(g, card.glyph, ix + 7, 72, { color: PAL.gold, outline: INK, align: 'center' });
  });

  drawText(g, 'BACI, NONNA *', tx, 86, { color: PAL.plum });
  if (s.newRecord || s.newBest) drawText(g, 'NUOVO RECORD!', tx, 96, { color: '#d1495b' });
  else {
    const d = s.date;
    const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    drawText(g, date, tx, 96, { color: LABEL });
  }
  return c;
}

// The postcard scaled up 4x on a dark background, as a PNG file.
export function postcardFile(card) {
  const pad = 8;
  const scale = 4;
  const [c, g] = makeCanvas((card.width + pad * 2) * scale, (card.height + pad * 2) * scale);
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#1d1236';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(card, pad * scale, pad * scale, card.width * scale, card.height * scale);
  return new Promise((resolve) => {
    c.toBlob((blob) => resolve(blob ? new File([blob], 'torrondola-postcard.png', { type: 'image/png' }) : null), 'image/png');
  });
}

export function canShareFiles(file) {
  try {
    return !!file && !!navigator.canShare?.({ files: [file] });
  } catch {
    return false;
  }
}

// Opens the share sheet where files can be shared (phones), otherwise downloads the PNG.
export function sharePostcard(file, text) {
  if (!file) return;
  if (canShareFiles(file)) {
    navigator.share({ files: [file], text }).catch((err) => {
      if (err.name !== 'AbortError') console.warn('Share failed:', err);
    });
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
