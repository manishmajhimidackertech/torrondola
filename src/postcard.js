// The end-of-run card: a picture of your tower above your stats, framed like
// an airmail postcard. Rendered once per game over, shown on screen and
// shareable as a PNG.
import { BW } from './config.js';
import { drawText } from './font.js';
import { GOLD_STYLE, INK, PAL, STYLES, makeCanvas, rng } from './sprites.js';
import { cardIcon } from './art.js';
import { CARDS } from './cards.js';
import { box, clamp, ditherGradient } from './draw.js';

export const CARD_W = 176;
export const PHOTO_MIN = 60;
export const PHOTO_MAX = 150;
const BODY_H = 136; // everything below the photo

export const cardHeight = (photoH) => photoH + BODY_H;

const PAPER = '#fbf3e4';
const AIRMAIL = ['#d1495b', PAPER, '#3f6fd8', PAPER];
const LABEL = '#8a7fa6';
const RULE = '#d6cbe0';
const RED = '#d1495b';
// The sky at the top of your tower, as in the game.
const SKIES = [
  ['#5297dd', '#71abe5', '#95c2ee'], // day
  ['#5b3a7a', '#cf5c74', '#f6b468'], // sunset
  ['#0c1430', '#1b2d63', '#2f4d94'], // night
  ['#06040f', '#170f38', '#2f185c'], // space
];
const skyFor = (floors) => SKIES[Math.min(SKIES.length - 1, Math.floor(floors / 22))];

// A rolling ridge line across the photo, for the hills behind the tower.
function hills(g, x, w, base, amp, color, r) {
  const ph = r() * 6.28;
  const cyc = 1 + r() * 2;
  g.fillStyle = color;
  for (let i = 0; i < w; i++) {
    const top = Math.round(base - amp * (0.6 + 0.4 * Math.sin((i / w) * Math.PI * 2 * cyc + ph)));
    g.fillRect(x + i, top, 1, base - top + 1);
  }
}

function photo(g, s, x, y, w, h, r) {
  g.fillStyle = INK;
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  const groundY = y + h - 8;
  ditherGradient(g, x, y, w, groundY - y, skyFor(s.floors));
  if (s.floors >= 44) {
    g.fillStyle = PAL.cream;
    for (let i = 0; i < 24; i++) g.fillRect(x + Math.floor(r() * w), y + Math.floor(r() * (h * 0.6)), 1, 1);
    g.fillStyle = '#f4ecd8';
    g.fillRect(x + w - 15, y + 5, 4, 6);
    g.fillRect(x + w - 16, y + 6, 6, 4);
  }
  // the countryside: far hills, near hills with a few cypresses, the piazza
  hills(g, x, w, groundY - 1, 16, '#8cc2a2', r);
  hills(g, x, w, groundY - 1, 8, '#5e9e57', r);
  g.fillStyle = '#2f6b3f';
  for (let i = 0; i < 5; i++) {
    const tx = x + 3 + Math.floor(r() * (w - 6));
    const th = 5 + Math.floor(r() * 5);
    g.fillRect(tx, groundY - th, 1, th);
    g.fillRect(tx - 1, groundY - th + 2, 3, th - 2);
  }
  g.fillStyle = '#efe2c4';
  g.fillRect(x, groundY, w, 1);
  g.fillStyle = '#c9b48e';
  g.fillRect(x, groundY + 1, w, y + h - groundY - 1);
  g.fillStyle = '#a8936e';
  for (let i = 0; i < w; i += 4) g.fillRect(x + i + ((i >> 2) % 2) * 2, groundY + 3, 2, 1);

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
    const label = 'COLLAPSED';
    const lw = 64;
    const sx = Math.round(cx - lw / 2);
    const sy = Math.round(y + h * 0.42);
    g.fillStyle = RED;
    g.fillRect(sx, sy, lw, 13);
    g.fillStyle = PAPER;
    g.fillRect(sx + 1, sy + 1, lw - 2, 11);
    drawText(g, label, cx, sy + 3, { color: RED, align: 'center' });
  }
}

function rule(g, y, w) {
  g.fillStyle = RULE;
  for (let x = 10; x < w - 10; x += 2) g.fillRect(x, y, 1, 1);
}

// s: game.summary. photoH sets how tall the picture is, so the card can use
// whatever room the screen has.
export function renderPostcard(s, { width = CARD_W, photoH = 110 } = {}) {
  const W = width;
  const H = cardHeight(photoH);
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

  photo(g, s, 9, 9, W - 18, photoH, r);

  const mid = Math.round(W / 2);
  let y = 9 + photoH + 9;
  drawText(g, 'SCORE', mid, y, { color: LABEL, align: 'center' });
  drawText(g, s.score, mid, y + 10, { scale: 2, color: INK, align: 'center' });
  if (s.newBest) drawText(g, 'NEW BEST SCORE!', mid, y + 28, { color: RED, align: 'center' });
  else drawText(g, `BEST ${s.best || 0}`, mid, y + 28, { color: LABEL, align: 'center' });

  y += 40;
  rule(g, y, W);
  const left = Math.round(W * 0.27);
  const right = Math.round(W * 0.73);
  drawText(g, s.newRecord ? 'NEW HEIGHT!' : 'FLOORS', left, y + 6, { color: s.newRecord ? RED : LABEL, align: 'center' });
  drawText(g, s.floors, left, y + 16, { color: INK, align: 'center' });
  drawText(g, 'BEST COMBO', right, y + 6, { color: LABEL, align: 'center' });
  drawText(g, s.bestCombo ? `X${s.bestCombo}` : '-', right, y + 16, { color: INK, align: 'center' });

  y += 29;
  rule(g, y, W);
  drawText(g, 'BLESSINGS', 10, y + 5, { color: LABEL });
  const owned = CARDS.filter((card) => s.owned[card.id]);
  if (!owned.length) drawText(g, 'NONE THIS TIME', 10, y + 18, { color: INK });
  // icons of different heights all sit on one baseline
  const baseline = y + 28;
  owned.forEach((card, i) => {
    const icon = cardIcon(card.id);
    const ix = 9 + i * 16;
    if (icon) g.drawImage(icon, ix, baseline - icon.height);
    else drawText(g, card.glyph, ix + 7, baseline - 9, { color: PAL.gold, outline: INK, align: 'center' });
  });

  y += 34;
  const d = s.date;
  const date = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  drawText(g, date, 10, y, { color: LABEL });
  drawText(g, 'LOVE, NONNA *', W - 10, y, { color: PAL.plum, align: 'right' });
  return c;
}

// The card scaled up 4x on a dark background, as a PNG file.
export function postcardFile(card) {
  const pad = 8;
  const scale = 4;
  const [c, g] = makeCanvas((card.width + pad * 2) * scale, (card.height + pad * 2) * scale);
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
