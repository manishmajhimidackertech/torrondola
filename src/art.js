// Character and prop sprites: Nonna, pigeons, sky visitors and the blessing card icons.
import { INK, PAL, makeCanvas, maskSprite, mirrored, withOutline } from './sprites.js';

// --- Nonna ---------------------------------------------------------------------

const FACE_TOP = [
  '......hhhh......',
  '.....hHHHHh.....',
  '....hhhhhhhh....',
  '...hhhhhhhhhh...',
  '..hhhsssssshhh..',
  '..hhsssssssshh..',
  '.hsGGGGssGGGGsh.',
];
const FACE_BOTTOM = [
  '...ssssssssss...',
  '....cssssssc....',
  '..cccccCCccccc..',
  '.cccccccccccccc.',
];
const EYES = {
  open: '.hsGleGssGleGsh.',
  closed: '.hsGeeGssGeeGsh.',
  wide: '.hsGelGssGleGsh.',
};
const MOUTHS = {
  neutral: ['..ssssssssssss..', '...sssmmmmsss...'],
  happy: ['..sssmssssmsss..', '...sssmmmmsss...'],
  ecstatic: ['..sssmmmmmmsss..', '...sssmrrmsss...'],
  worried: ['..ssssmmmmssss..', '...sssmssmsss...'],
  shocked: ['..sssssmmsssss..', '...ssssmmssss...'],
};
const FACES = {
  neutral: ['open', 'neutral'],
  blink: ['closed', 'neutral'],
  happy: ['closed', 'happy'],
  ecstatic: ['closed', 'ecstatic'],
  worried: ['open', 'worried'],
  shocked: ['wide', 'shocked'],
};
const FACE_COLORS = {
  h: '#d8d2e6', H: '#f6f2fb', s: '#f2c29b', R: '#ef8f8f', G: '#b08a4a', l: '#eef6ff', e: '#2b1b33',
  m: '#8f2d3b', r: PAL.red, c: PAL.plum, C: PAL.gold,
};

const faceCache = new Map();

export function nonnaFace(mood) {
  let c = faceCache.get(mood);
  if (c) return c;
  const [eyes, mouth] = FACES[mood] || FACES.neutral;
  const rows = [
    ...FACE_TOP,
    EYES[eyes],
    '.hsGGGGssGGGGsh.',
    '.hsRssssssssRsh.',
    ...MOUTHS[mouth],
    ...FACE_BOTTOM,
  ];
  c = maskSprite(rows, FACE_COLORS, null);
  faceCache.set(mood, c);
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
