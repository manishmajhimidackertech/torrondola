// Draws the game into a small low-res canvas, then scales it up with
// nearest-neighbour filtering and a light CRT pass on top.
import { BW, BH, CFG, GAME_H } from './config.js';
import { drawText, textWidth } from './font.js';
import {
  INK, PAL, hookSprite, heartFull, heartEmpty, speakerOn, speakerOff, makeSkyline, makeCloud, rng,
} from './sprites.js';

// Swirl palettes from dark to light, blended as the tower climbs: dusk, night, space.
const THEMES = [
  ['#1d1236', '#2c1a4f', '#40246a', '#5a2f7d', '#8e3f7e'],
  ['#0c1430', '#13204a', '#1b2d63', '#243c7c', '#2f4d94'],
  ['#06040f', '#0e0a24', '#170f38', '#22134a', '#2f185c'],
].map((t) => t.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))));
const FLOORS_PER_THEME = 25;

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const LOGO_COLORS = [PAL.red, PAL.gold, PAL.green, PAL.blue, PAL.purple];
const ROPE = '#f2e3c6';
const ROPE_SHADE = '#6e4f63';
const CITY_W = 720;
const FAR_CITY = '#160c26';
const NEAR_CITY = '#0f0a1c';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function line(g, x0, y0, x1, y1, color) {
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

function panel(g, x, y, w, h) {
  g.fillStyle = INK;
  g.fillRect(x + 1, y + h, w - 2, 2); // drop shadow
  g.fillRect(x + 1, y - 1, w - 2, h + 2);
  g.fillRect(x - 1, y + 1, w + 2, h - 2);
  g.fillRect(x, y, w, h);
  g.fillStyle = '#3d2e5c';
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = '#241a3a';
  g.fillRect(x + 1, y + 2, w - 2, h - 3);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.low = document.createElement('canvas');
    this.bg = document.createElement('canvas');
    this.crt = document.createElement('canvas');
    this.frame = 0;
    this.muteRect = { x: 0, y: 0, w: 0, h: 0 };

    this.farCity = makeSkyline(CITY_W, 130, 7, FAR_CITY, '#4a2f6a', 0.1, 34, 120);
    this.nearCity = makeSkyline(CITY_W, 80, 21, NEAR_CITY, '#ffd56b', 0.1, 14, 72);

    const r = rng(99);
    this.clouds = Array.from({ length: 36 }, (_, k) => ({
      sprite: makeCloud(k + 1),
      x: (r() - 0.5) * 320,
      y: -(260 + k * 130 + r() * 90),
      speed: 3 + r() * 6,
    }));
    this.stars = Array.from({ length: 70 }, () => ({ x: r(), y: r(), tw: r() * 6.28 }));
  }

  resize(W, H, scale) {
    this.W = W;
    this.H = H;
    this.scale = scale;
    this.low.width = W;
    this.low.height = H;
    this.g = this.low.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;

    // The swirl is computed at a fraction of the resolution, which also gives it chunky pixels.
    const bs = Math.max(2, Math.ceil(Math.sqrt((W * H) / 20000)));
    this.bgScale = bs;
    this.bg.width = Math.ceil(W / bs);
    this.bg.height = Math.ceil(H / bs);
    const bw = this.bg.width;
    const bh = this.bg.height;
    this.bgCtx = this.bg.getContext('2d');
    this.bgImg = this.bgCtx.createImageData(bw, bh);
    this.bgPix = new Uint32Array(this.bgImg.data.buffer);
    this.polarR = new Float32Array(bw * bh);
    this.polarA = new Float32Array(bw * bh);
    const m = Math.min(bw, bh);
    for (let y = 0, i = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++, i++) {
        const nx = (x - bw / 2) / m;
        const ny = (y - bh * 0.4) / m;
        this.polarR[i] = Math.hypot(nx, ny);
        this.polarA[i] = Math.atan2(ny, nx);
      }
    }

    // Scanlines + vignette, built once per size.
    const cw = W * scale;
    const ch = H * scale;
    this.crt.width = cw;
    this.crt.height = ch;
    const c = this.crt.getContext('2d');
    if (scale >= 3) {
      c.fillStyle = 'rgba(0,0,0,0.13)';
      for (let y = 0; y < H; y++) c.fillRect(0, y * scale + scale - 1, cw, 1);
    }
    const vg = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.6);
    vg.addColorStop(0, 'rgba(10,0,20,0)');
    vg.addColorStop(1, 'rgba(10,0,20,0.45)');
    c.fillStyle = vg;
    c.fillRect(0, 0, cw, ch);

    this.muteRect = { x: 0, y: H - 22, w: 24, h: 22 };
  }

  hitMute(x, y) {
    const r = this.muteRect;
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  }

  // How many floors the camera has climbed since the start of the game.
  altitude(game) {
    return Math.max(0, (-game.cam.y - game.groundHomeY()) / BH);
  }

  draw(game, sound) {
    const { g, W, H } = this;
    this.frame++;
    const shx = game.shake ? Math.round((Math.random() * 2 - 1) * game.shake) : 0;
    const shy = game.shake ? Math.round((Math.random() * 2 - 1) * game.shake) : 0;
    // world -> screen: sx = x + ox, sy = y + oy
    const ox = Math.round(W / 2 - game.cam.x) + shx;
    const oy = Math.round(-game.cam.y) + shy;
    const alt = this.altitude(game);

    this.drawBackground(game.time, alt);
    this.drawStars(game, alt);
    this.drawCity(game, oy);
    this.drawClouds(game, alt);
    this.drawTower(game, ox, oy);
    this.drawCrane(game, shx, shy);
    this.drawFx(game, ox, oy);

    if (game.state === 'title') this.drawTitle(game);
    else this.drawHud(game);
    if (game.state === 'over') this.drawGameOver(game);
    g.drawImage(sound.muted ? speakerOff : speakerOn, 5, H - 14);

    this.present(game);
  }

  drawBackground(t, alt) {
    if (this.frame % 2 === 1 || !this.bgReady) {
      // Blend the five swirl colors for the current altitude and pack them as ABGR.
      const k = clamp(alt / FLOORS_PER_THEME, 0, THEMES.length - 1);
      const i = Math.min(THEMES.length - 2, Math.floor(k));
      const f = k - i;
      const pal = THEMES[i].map((c0, j) => {
        const [r, gg, b] = c0.map((v, ch) => Math.round(v + (THEMES[i + 1][j][ch] - v) * f));
        return ((255 << 24) | (b << 16) | (gg << 8) | r) >>> 0;
      });

      const { polarR, polarA, bgPix } = this;
      const bw = this.bg.width;
      const bh = this.bg.height;
      const spin = t * 0.12;
      for (let y = 0, i2 = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++, i2++) {
          const r = polarR[i2];
          const a = polarA[i2] + spin + (1 - r) * 2.4; // stronger twist toward the centre
          let u = Math.cos(a) * r * 7;
          let v = Math.sin(a) * r * 7;
          for (let n = 0; n < 2; n++) {
            const pu = u;
            u += 0.8 * Math.sin(v * 1.1 + t * 0.5 + n * 1.7);
            v += 0.8 * Math.cos(pu * 0.9 - t * 0.4 + n * 2.9);
          }
          const val = 0.5 + 0.5 * Math.sin(u * 0.9 + v * 0.7 + t * 0.25);
          const fv = val * 4;
          const base = Math.floor(fv);
          const idx = base + (fv - base > BAYER[((y & 3) << 2) | (x & 3)] ? 1 : 0);
          bgPix[i2] = pal[idx > 4 ? 4 : idx];
        }
      }
      this.bgCtx.putImageData(this.bgImg, 0, 0);
      this.bgReady = true;
    }
    this.g.drawImage(this.bg, 0, 0, this.bg.width * this.bgScale, this.bg.height * this.bgScale);
  }

  drawStars(game, alt) {
    const a = clamp((alt - 22) / 20, 0, 1);
    if (!a) return;
    const { g, W, H } = this;
    const span = H * 1.5;
    g.fillStyle = PAL.cream;
    for (const s of this.stars) {
      const tw = Math.sin(game.time * 2 + s.tw);
      g.globalAlpha = a * (0.55 + 0.45 * tw);
      const x = Math.floor(s.x * W);
      const y = Math.floor((((s.y * span - game.cam.y * 0.04) % span) + span) % span);
      if (y >= H) continue;
      g.fillRect(x, y, 1, 1);
      if (tw > 0.93) {
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x, y - 1, 1, 3);
      }
    }
    g.globalAlpha = 1;
  }

  drawCity(game, oy) {
    const { g, W, H } = this;
    const gy = oy; // ground's screen y
    const gy0 = game.groundHomeY();
    // Each city layer slides down slower than the ground; below its skyline it is solid.
    const layer = (img, color, parallax, depth) => {
      const base = Math.round(gy0 + (gy - gy0) * depth);
      const top = base - img.height + 2;
      if (top >= H) return;
      const x0 = Math.round(W / 2 - game.cam.x * parallax - CITY_W / 2);
      for (let x = ((x0 % CITY_W) + CITY_W) % CITY_W - CITY_W; x < W; x += CITY_W) g.drawImage(img, x, top);
      g.fillStyle = color;
      g.fillRect(0, base + 2, W, H - base - 2);
    };
    layer(this.farCity, FAR_CITY, 0.3, 0.45);
    layer(this.nearCity, NEAR_CITY, 0.6, 0.7);

    if (gy < H) {
      g.fillStyle = '#9a8fb8';
      g.fillRect(0, gy, W, 2);
      g.fillStyle = '#5d5480';
      g.fillRect(0, gy + 2, W, 1);
      g.fillStyle = '#221a33';
      g.fillRect(0, gy + 3, W, H - gy - 3);
      g.fillStyle = '#4a4166';
      const off = Math.round(W / 2 - game.cam.x);
      for (let x = (((off % 16) + 16) % 16) - 16; x < W; x += 16) g.fillRect(x, gy + 14, 8, 1);
    }
  }

  drawClouds(game, alt) {
    const a = clamp(1 - (alt - 30) / 20, 0, 1);
    if (!a) return;
    const { g, W, H } = this;
    g.globalAlpha = 0.85 * a;
    for (const c of this.clouds) {
      const y = Math.round((c.y - game.cam.y) * 0.6);
      if (y > H || y + c.sprite.height < 0) continue;
      const wx = ((((c.x + game.time * c.speed + 200) % 400) + 400) % 400) - 200;
      const x = Math.round(W / 2 + wx - game.cam.x * 0.6 - c.sprite.width / 2);
      g.drawImage(c.sprite, x, y);
    }
    g.globalAlpha = 1;
  }

  drawTower(game, ox, oy) {
    const { g, H } = this;
    const dip = Math.round(game.dip);
    const n = game.blocks.length;
    const first = Math.max(0, Math.floor((oy - H) / BH) - 1);
    const last = Math.min(n - 1, Math.ceil(oy / BH));
    for (let i = first; i <= last; i++) {
      const x = Math.round(game.blockX(i) - BW / 2) + ox;
      const y = oy - (i + 1) * BH + (i > 0 ? dip : 0);
      g.drawImage(game.blocks[i].sprite, x, y);
    }
    const f = game.falling;
    if (f) g.drawImage(f.block.sprite, Math.round(f.x - BW / 2) + ox, Math.round(f.y) + oy);
  }

  drawCrane(game, shx, shy) {
    const { g, W } = this;
    const h = game.hookState();
    const px = Math.round(W / 2) + shx;
    const py = CFG.pivotY + shy;
    const hx = Math.round(W / 2 + h.sx) + shx;
    const hy = Math.round(h.sy) + shy;
    if (hy + CFG.hookDrop + BH < 0) return;
    line(g, px + 1, py, hx + 1, hy, ROPE_SHADE);
    line(g, px, py, hx, hy, ROPE);
    g.drawImage(hookSprite, hx - 5, hy);
    if (game.hang) {
      const bx = hx - BW / 2;
      const by = hy + CFG.hookDrop;
      line(g, hx - 3, hy + 6, bx + 4, by, ROPE);
      line(g, hx + 2, hy + 6, bx + BW - 5, by, ROPE);
      g.drawImage(game.hang.block.sprite, bx, by);
    }
  }

  drawFx(game, ox, oy) {
    const { g, W, H } = this;
    for (const d of game.debris) {
      const x = Math.round(d.x) + ox;
      const y = Math.round(d.y) + oy;
      if (y > H + BW || y < -BW) continue;
      g.save();
      g.translate(x, y);
      g.rotate(d.rot);
      g.drawImage(d.sprite, -BW / 2, -BH / 2);
      g.restore();
    }

    for (const p of game.particles) {
      g.globalAlpha = clamp((p.life / p.max) * 1.6, 0, 1);
      g.fillStyle = p.color;
      const x = Math.round(p.x) + ox;
      const y = Math.round(p.y) + oy;
      if (p.spark) {
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x, y - 1, 1, 3);
      } else {
        g.fillRect(x, y, p.size, p.size);
      }
    }
    g.globalAlpha = 1;

    for (const p of game.popups) {
      const k = p.t / p.life;
      g.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const scale = p.scale > 1 && p.t < 0.07 ? p.scale + 1 : p.scale; // pop in
      const w = textWidth(p.text, scale);
      const x = clamp(p.x + ox, w / 2 + 3, W - w / 2 - 3);
      const y = p.y + oy - p.t * 18 - (scale - p.scale) * 4;
      drawText(g, p.text, x, y, {
        color: p.color, scale, align: 'center', outline: INK, shadow: INK, wave: p.wave, time: p.t,
      });
    }
    g.globalAlpha = 1;
  }

  drawHud(game) {
    const { g, W } = this;
    drawText(g, Math.floor(game.shownScore), 6, 6, { scale: 2, color: PAL.cream, outline: INK, shadow: INK });
    drawText(g, `FLOOR ${game.floors}`, 6, 24, { color: PAL.dim, outline: INK });
    if (game.combo >= 2) {
      drawText(g, `X${game.combo}`, 6, 34, {
        scale: 2, color: PAL.orange, outline: INK, shadow: INK, wave: 1, waveSpeed: 10, time: game.time,
      });
    }

    for (let i = 0; i < CFG.lives; i++) {
      g.drawImage(i < game.lives ? heartFull : heartEmpty, W - 6 - (CFG.lives - i) * 10, 5);
    }

    // Sway meter: how close the swing of the tower top is to toppling it.
    const mw = 30;
    const mx = W - 6 - mw;
    const my = 17;
    const d = clamp(game.danger, 0, 1);
    const color = d < 0.45 ? PAL.green : d < 0.7 ? PAL.gold : PAL.red;
    drawText(g, 'SWAY', mx - 3, my - 1, { align: 'right', color: PAL.dim, outline: INK });
    g.fillStyle = INK;
    g.fillRect(mx - 1, my - 1, mw + 2, 7);
    g.fillStyle = '#2d2142';
    g.fillRect(mx, my, mw, 5);
    if (d > 0.85 && Math.floor(game.time * 8) % 2) g.fillStyle = PAL.cream;
    else g.fillStyle = color;
    g.fillRect(mx, my, Math.round(d * mw), 5);
  }

  drawTitle(game) {
    const { g, W, H } = this;
    const t = game.time;
    const y0 = Math.round(Math.max(0, H - GAME_H) * 0.3);
    drawText(g, 'TORRONDOLA', W / 2, y0 + 24, {
      scale: 2, colors: LOGO_COLORS, outline: INK, shadow: INK, align: 'center', wave: 2, waveSpeed: 4, time: t,
    });
    drawText(g, 'LA TORRETTA CHE DONDOLA', W / 2, y0 + 46, { color: PAL.cream, outline: INK, align: 'center' });

    const pw = 152;
    const px = Math.round(W / 2 - pw / 2);
    panel(g, px, y0 + 66, pw, 52);
    const lines = [
      ['TAP OR SPACE TO DROP', PAL.cream],
      ['STACK THE TOWER HIGH', PAL.cream],
      ['PERFECT DROPS SCORE', PAL.gold],
      ['BIG AND CALM THE SWAY', PAL.gold],
    ];
    lines.forEach(([text, color], i) => drawText(g, text, W / 2, y0 + 72 + i * 11, { color, align: 'center' }));

    if (Math.floor(t * 2.5) % 2 === 0) {
      drawText(g, 'TAP TO START', W / 2, y0 + 130, { color: PAL.cream, outline: INK, shadow: INK, align: 'center' });
    }
    const best = game.save.best || 0;
    if (best) drawText(g, `BEST ${best}`, W / 2, y0 + 146, { color: PAL.dim, outline: INK, align: 'center' });
  }

  drawGameOver(game) {
    const { g, W, H } = this;
    const t = game.time;
    const pw = 140;
    const ph = 108;
    const px = Math.round(W / 2 - pw / 2);
    const py = Math.round(clamp(H * 0.24, 44, 120));
    panel(g, px, py, pw, ph);

    const toppled = game.reason === 'topple';
    drawText(g, toppled ? 'CROLLO!' : 'GAME OVER', W / 2, py + 8, {
      scale: 2, color: PAL.red, outline: INK, shadow: INK, align: 'center', wave: 1, waveSpeed: 6, time: t,
    });
    drawText(g, toppled ? 'THE TOWER FELL' : 'OUT OF LIVES', W / 2, py + 28, { color: PAL.dim, align: 'center' });

    const rows = [
      ['SCORE', game.score, PAL.cream],
      ['FLOORS', game.reached, PAL.cream],
      ['BEST COMBO', game.bestCombo, PAL.orange],
      ['BEST', game.save.best || 0, PAL.gold],
    ];
    rows.forEach(([label, value, color], i) => {
      const y = py + 44 + i * 11;
      drawText(g, label, px + 10, y, { color: PAL.dim });
      drawText(g, value, px + pw - 10, y, { color, align: 'right' });
    });

    const blink = Math.floor(t * 3) % 2 === 0;
    if (game.newBest && blink) {
      drawText(g, 'NEW BEST!', W / 2, py - 14, { color: PAL.gold, outline: INK, shadow: INK, align: 'center', scale: 1 });
    }
    if (game.overT > 0.8 && Math.floor(t * 2.5) % 2 === 0) {
      drawText(g, 'TAP TO RETRY', W / 2, py + ph - 14, { color: PAL.cream, outline: INK, align: 'center' });
    }
  }

  present(game) {
    const { ctx, W, H, scale } = this;
    const cw = W * scale;
    const ch = H * scale;
    ctx.drawImage(this.low, 0, 0, cw, ch);
    ctx.drawImage(this.crt, 0, 0);

    if (game.state === 'play' && game.danger > 0.65) {
      const pulse = 0.5 + 0.5 * Math.sin(game.time * 10);
      const a = clamp((game.danger - 0.65) / 0.35, 0, 1) * (0.2 + 0.25 * pulse);
      const rg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.55);
      rg.addColorStop(0, 'rgba(255,40,60,0)');
      rg.addColorStop(1, `rgba(255,40,60,${a.toFixed(3)})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (game.flash > 0) {
      ctx.fillStyle = `rgba(255,244,220,${game.flash.toFixed(3)})`;
      ctx.fillRect(0, 0, cw, ch);
    }
  }
}
