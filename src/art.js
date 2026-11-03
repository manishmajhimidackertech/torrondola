// Character and prop sprites: Nonna, pigeons, sky visitors and the blessing card icons.
import { INK, PAL, makeCanvas, maskSprite, mirrored, withOutline } from './sprites.js';

// --- Nonna ---------------------------------------------------------------------

const NC = {
  hair: '#d8d2e6', hairShade: '#b3abc8', hairHi: '#f6f2fb',
  skin: '#f2c29b', skinShade: '#e2a882', lens: '#fbe3cf', frame: '#c9a46a',
  eye: '#3a2430', white: '#ffffff', brow: '#9c93b2', cheek: '#f4b4a4', blush: '#ee8c8c',
  mouth: '#8f2d3b', tongue: '#d4525e', shawl: PAL.plum, shawlDark: '#5e2146', lace: '#fff4dc', brooch: PAL.gold,
};

// Her face is assembled from parts so expressions can change one feature at a
// time. parts: { eyes: open|half|closed|happy|wide, look: -1|0|1,
// brows: relaxed|raised|worried, mouth: flat|smile1|smile2|laugh|talk|o1|o2|frown1|frown2, blush }
function drawNonnaFace({ eyes, look, brows, mouth, blush }) {
  const [c, g] = makeCanvas(20, 20);
  const P = (col, x, y, w = 1, h = 1) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  // shawl, lace collar and brooch
  P(NC.shawl, 3, 16, 14, 1);
  P(NC.shawl, 1, 17, 18, 1);
  P(NC.shawl, 0, 18, 20, 2);
  P(NC.shawlDark, 4, 18, 1, 2);
  P(NC.shawlDark, 15, 18, 1, 2);
  P(NC.lace, 6, 16, 8, 1);
  P(NC.lace, 7, 17, 1, 1);
  P(NC.lace, 12, 17, 1, 1);
  P(NC.brooch, 9, 17, 2, 1);
  // face, ears, neck
  P(NC.skin, 6, 4, 8, 1);
  P(NC.skin, 4, 5, 12, 9);
  P(NC.skin, 5, 14, 10, 1);
  P(NC.skinShade, 7, 15, 6, 1);
  P(NC.skinShade, 3, 9, 1, 2);
  P(NC.skinShade, 16, 9, 1, 2);
  P(NC.skinShade, 15, 11, 1, 2);
  // silver hair: bun on top, soft curls down the sides
  P(NC.hair, 7, 0, 6, 1);
  P(NC.hair, 6, 1, 8, 2);
  P(NC.hairHi, 8, 1, 3, 1);
  P(NC.hair, 4, 3, 12, 1);
  P(NC.hair, 3, 4, 4, 1);
  P(NC.hair, 13, 4, 4, 1);
  P(NC.hair, 3, 5, 2, 1);
  P(NC.hair, 15, 5, 2, 1);
  P(NC.hair, 2, 6, 2, 4);
  P(NC.hair, 16, 6, 2, 4);
  for (const [x, y] of [[9, 3], [6, 2], [13, 2], [4, 4], [15, 4], [2, 7], [17, 8], [3, 9], [16, 6]]) P(NC.hairShade, x, y);
  // eyebrows
  if (brows === 'raised') {
    P(NC.brow, 5, 5, 3, 1);
    P(NC.brow, 12, 5, 3, 1);
  } else if (brows === 'worried') {
    P(NC.brow, 5, 6, 2, 1);
    P(NC.brow, 7, 5, 1, 1);
    P(NC.brow, 12, 5, 1, 1);
    P(NC.brow, 13, 6, 2, 1);
  } else {
    P(NC.brow, 5, 6, 3, 1);
    P(NC.brow, 12, 6, 3, 1);
  }
  // thin, round gold reading glasses
  for (const x0 of [4, 11]) {
    P(NC.frame, x0 + 1, 7, 3, 1);
    P(NC.frame, x0 + 1, 10, 3, 1);
    P(NC.frame, x0, 8, 1, 2);
    P(NC.frame, x0 + 4, 8, 1, 2);
    P(NC.lens, x0 + 1, 8, 3, 2);
  }
  P(NC.frame, 9, 8, 2, 1);
  // eyes behind the lenses
  for (const x0 of [5, 12]) {
    if (eyes === 'open') P(NC.eye, x0 + 1 + look, 8, 1, 2);
    else if (eyes === 'wide') {
      P(NC.white, x0, 8, 3, 2);
      P(NC.eye, x0 + 1 + look, 8, 1, 2);
    } else if (eyes === 'half') {
      P(NC.skinShade, x0, 8, 3, 1);
      P(NC.eye, x0 + 1, 9, 1, 1);
    } else if (eyes === 'closed') {
      P(NC.eye, x0, 9, 3, 1);
    } else if (eyes === 'happy') {
      P(NC.eye, x0 + 1, 8, 1, 1);
      P(NC.eye, x0, 9, 1, 1);
      P(NC.eye, x0 + 2, 9, 1, 1);
    }
  }
  // nose, rosy cheeks, smile lines
  P(NC.skinShade, 9, 11, 2, 1);
  P(blush ? NC.blush : NC.cheek, 5, 11, 2, 1);
  P(blush ? NC.blush : NC.cheek, 13, 11, 2, 1);
  P(NC.skinShade, 6, 13, 1, 1);
  P(NC.skinShade, 13, 13, 1, 1);
  // mouth
  const M = NC.mouth;
  switch (mouth) {
    case 'smile1':
      P(M, 8, 12);
      P(M, 11, 12);
      P(M, 9, 13, 2, 1);
      break;
    case 'smile2':
      P(M, 7, 12);
      P(M, 12, 12);
      P(M, 8, 13, 4, 1);
      break;
    case 'laugh':
      P(M, 7, 12);
      P(NC.white, 8, 12, 4, 1);
      P(M, 12, 12);
      P(M, 8, 13);
      P(NC.tongue, 9, 13, 2, 1);
      P(M, 11, 13);
      P(M, 9, 14, 2, 1);
      break;
    case 'talk':
      P(M, 9, 12, 2, 1);
      P(NC.tongue, 9, 13, 2, 1);
      break;
    case 'o1':
      P(M, 9, 12, 2, 2);
      break;
    case 'o2':
      P(M, 9, 12, 2, 1);
      P(M, 8, 13);
      P(NC.tongue, 9, 13, 2, 1);
      P(M, 11, 13);
      P(M, 9, 14, 2, 1);
      break;
    case 'frown1':
      P(M, 9, 12, 2, 1);
      P(M, 8, 13);
      P(M, 11, 13);
      break;
    case 'frown2':
      P(M, 8, 12, 4, 1);
      P(M, 7, 13);
      P(M, 12, 13);
      break;
    default: // flat
      P(M, 8, 13, 4, 1);
  }
  return c;
}

const faceCache = new Map();

export function nonnaFace(parts) {
  const key = `${parts.eyes}:${parts.look}:${parts.brows}:${parts.mouth}:${parts.blush ? 1 : 0}`;
  let c = faceCache.get(key);
  if (!c) {
    c = drawNonnaFace(parts);
    faceCache.set(key, c);
  }
  return c;
}

// --- pigeons -------------------------------------------------------------------

const PIGEON_COLORS = { g: '#9a93b3', G: '#6c6488', n: '#5fbf8f', k: INK, o: PAL.orange, w: '#c9c3d6' };
const PIGEON_FRAMES = {
  sit: [
    '......gg.',
    '.....gkgo',
    '......nn.',
    '..gggggg.',
    'gGGGGgggg',
    '.ggggwgg.',
    '...o..o..',
  ],
  peck: [
    '.........',
    '.........',
    '.........',
    '..gggggg.',
    'gGGGGgggn',
    '.ggggwgkg',
    '...o..o.o',
  ],
  up: [
    '..GGG.....',
    '...GGG....',
    '....GGg.gg',
    'gggggggkgo',
    '.gggwggg..',
    '..........',
  ],
  down: [
    '..........',
    '........gg',
    'gggggggkgo',
    '.ggGGGgg..',
    '...GGG....',
    '....GG....',
  ],
};

function padRows(rows) {
  const w = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(w, '.'));
}

// Frames face right; pigeon(frame, -1) is the mirrored, left-facing version.
const pigeonCache = new Map();
export function pigeon(frame, face = 1) {
  const key = `${frame}:${face}`;
  let c = pigeonCache.get(key);
  if (!c) {
    c = maskSprite(padRows(PIGEON_FRAMES[frame]), PIGEON_COLORS);
    if (face < 0) c = mirrored(c);
    pigeonCache.set(key, c);
  }
  return c;
}

// --- the bulldozer that clears fallen floors ------------------------------------

// Faces right; the blade is on the right. phase (0..2) walks the track treads.
function dozerFrame(phase) {
  const [c, g] = makeCanvas(36, 21);
  const R = (col, x, y, w, h) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  R('#3d3a4a', 2, 15, 26, 5); // tracks
  R('#3d3a4a', 1, 16, 28, 3);
  for (let x = 3 + phase; x < 27; x += 3) {
    R('#6c6488', x, 15, 1, 1);
    R('#6c6488', x, 19, 1, 1);
  }
  for (const wx of [5, 11, 17, 23]) {
    R('#9a93b3', wx, 16, 3, 3);
    R('#3d3a4a', wx + 1, 17, 1, 1);
  }
  R(PAL.gold, 3, 9, 24, 6); // body
  R('#c07f2a', 3, 13, 24, 2);
  R('#ffd88a', 3, 9, 24, 1);
  R(INK, 4, 11, 22, 1);
  R(PAL.gold, 6, 1, 13, 8); // cab
  R('#ffd88a', 6, 1, 13, 1);
  R('#9fd4ff', 8, 3, 9, 5);
  R('#d4ecff', 15, 3, 2, 2);
  R(PAL.orange, 10, 3, 4, 2); // driver's hard hat
  R('#f2c29b', 11, 5, 2, 2);
  R('#3d3a4a', 21, 3, 2, 6); // exhaust
  R('#3d3a4a', 27, 11, 4, 2); // arm
  R('#9a93b3', 30, 6, 4, 14); // blade
  R('#c9c3d6', 30, 6, 1, 14);
  R('#6c6488', 33, 6, 1, 14);
  return withOutline(c);
}

const dozerFrames = [0, 1, 2].map(dozerFrame);
const dozerFramesLeft = dozerFrames.map(mirrored);

export const DOZER_REACH = 16; // centre to blade front
export const DOZER_BACK = 19; // centre to rear

export function dozer(frame, dir) {
  return (dir < 0 ? dozerFramesLeft : dozerFrames)[frame % 3];
}

// --- sky -----------------------------------------------------------------------

// Hot-air balloon in the colors of the tricolore.
export const balloon = (() => {
  const [c, g] = makeCanvas(15, 22);
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const dx = x - 7;
      const dy = y - 7;
      const taper = y > 9 ? (y - 9) * 0.9 : 0;
      if (dx * dx + dy * dy > 7.3 * 7.3 || Math.abs(dx) > 7.3 - taper) continue;
      let col = Math.abs(dx) <= 1.5 ? '#f4efe4' : dx < 0 ? '#3f9e5c' : '#d1495b';
      if (dx < -4 && dy < -1) col = '#5fbf7a';
      else if (dx > 4 && dy > 1) col = '#9e2f3a';
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  g.fillStyle = '#d9cbb8';
  g.fillRect(5, 15, 1, 3);
  g.fillRect(9, 15, 1, 3);
  g.fillStyle = '#8a5a3c';
  g.fillRect(5, 18, 5, 3);
  g.fillStyle = '#a8724e';
  g.fillRect(5, 18, 5, 1);
  return withOutline(c);
})();

export const moon = (() => {
  const [c, g] = makeCanvas(18, 18);
  const craters = [[6, 6, 2], [11, 10, 1.6], [7, 12, 1.2], [12, 5, 1]];
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const dx = x - 8.5;
      const dy = y - 8.5;
      if (dx * dx + dy * dy > 8 * 8) continue;
      let col = dx + dy > 6 ? '#d8cbb0' : '#f4ecd8';
      if (craters.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r)) col = '#cfc3a8';
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  }
  return c;
})();

export const satellite = maskSprite(
  ['......a......', 'bbbb..g..bbbb', 'bcbckgggkbcbc', 'bbbb.ggg.bbbb', '.............'],
  { a: PAL.red, b: '#3f6fd8', c: '#6a93ef', g: PAL.gold, k: '#9a93b3' },
);

const UFO = ['.....ddddd.....', '....dDDDDDd....', '..mmmmmmmmmmm..', '.mLmmLmmLmmLmm.', 'mmmmmmmmmmmmmmm', '..mmmmmmmmmmm..'];
export const ufo = [PAL.gold, PAL.red].map((light, i) =>
  maskSprite(UFO, { d: '#9fe8d0', D: '#d4fff1', m: i ? '#c9bfe0' : '#b9aedc', L: light }),
);

// --- blessing card icons ---------------------------------------------------------

const ICONS = {
  espresso: [
    ['...s..s.....', '....s..s....', '...s..s.....', '............', '.wwwwwwwww..', '.wbbbbbbbwww',
      '.wwwwwwwww.w', '.wwwwwwwwwww', '..wwwwwww...', '...wwwww....', 'pppppppppppp', '.pppppppppp.'],
    { s: '#d8d2e6', w: PAL.cream, b: '#6b3a26', p: '#c9bfe0' },
  ],
  calamita: [
    ['..rrrrrrrr..', '.rrrrrrrrrr.', 'rrrRRRRRRrrr', 'rrr......rrr', 'rrr......rrr', 'rrr......rrr',
      'rrr......rrr', 'www......www', 'www......www', 'www......www'],
    { r: '#e0413f', R: '#a82a2a', w: '#e9e2f5' },
  ],
  ancora: [
    ['.....aa.....', '....a..a....', '.....aa.....', '..aaaaaaaa..', '.....aa.....', '.....aa.....',
      '.....aa.....', '.a...aa...a.', '.aa..aa..aa.', '..aa.aa.aa..', '...aaaaaa...', '....aaaa....'],
    { a: '#9fb3d1' },
  ],
  gatto: [
    ['o..........o', 'oo........oo', 'ooo......ooo', 'oooooooooooo', 'oogoooooogoo', 'oogoooooogoo',
      'oooooooooooo', 'oooooppooooo', 'oooowwwwoooo', '.oooooooooo.', '..oooooooo..'],
    { o: PAL.orange, g: PAL.green, p: '#ff9eb0', w: PAL.cream },
  ],
  pazienza: [
    ['.bbbbbbbbbb.', '..g......g..', '..gyyyyyyg..', '...gyyyyg...', '....gyyg....', '.....gg.....',
      '....g..g....', '...g.yy.g...', '..g.yyyy.g..', '..gyyyyyyg..', '.bbbbbbbbbb.'],
    { b: '#8a5a3c', g: '#b9e0f5', y: PAL.gold },
  ],
  cemento: [
    ['RRRRR.RRRRR.', 'rrrrr.rrrrr.', '............', 'RR.RRRRR.RRR', 'rr.rrrrr.rrr', '............',
      'RRRRR.RRRRR.', 'rrrrr.rrrrr.'],
    { R: '#e2775c', r: '#c8553d' },
  ],
  piuma: [
    ['.........ww.', '........wwww', '.......wdwww', '......wdwww.', '.....wdwww..', '....wdwww...',
      '...wdwww....', '..wdww......', '..dw........', '.k..........', 'k...........'],
    { w: PAL.cream, d: '#b9aedc', k: '#9a93b3' },
  ],
  azzardo: [
    ['.wwwwwwwwww.', 'wwwwwwwwwwww', 'wwrrwwwwwwww', 'wwrrwwwwwwww', 'wwwwwwwwwwww', 'wwwwwrrwwwww',
      'wwwwwrrwwwww', 'wwwwwwwwwwww', 'wwwwwwwwrrwd', 'wwwwwwwwrrwd', 'wwwwwwwwwwwd', '.dddddddddd.'],
    { w: PAL.cream, r: '#e0413f', d: '#c9bfe0' },
  ],
};

const iconCache = new Map();

// 14x14 (with outline) icon for a blessing card; null for cards drawn as text.
export function cardIcon(id) {
  if (!ICONS[id]) return null;
  let c = iconCache.get(id);
  if (!c) {
    const [rows, colors] = ICONS[id];
    c = maskSprite(rows, colors);
    iconCache.set(id, c);
  }
  return c;
}
