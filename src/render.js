// Draws the game into a small low-res canvas, then scales it up with
// nearest-neighbour filtering and a light CRT pass on top.
import { BW, BH, CFG, GAME_H } from './config.js';
import { drawText, textWidth } from './font.js';
import {
  INK, PAL, hookSprite, heartFull, heartEmpty, speakerOn, speakerOff, pauseIcon, makeSkyline, makeCloud, rng, shaded,
} from './sprites.js';
import { balloon, cardIcon, dozer, moon, nonnaFace, pigeon, satellite, ufo } from './art.js';
import { CARDS, RARITY } from './cards.js';
import { BAYER, box, clamp, line, panel } from './draw.js';
import { CARD_W, PHOTO_MAX, PHOTO_MIN, cardHeight } from './postcard.js';

// Swirl palettes from dark to light, blended as the tower climbs: dusk, night, space.
const THEMES = [
  ['#1d1236', '#2c1a4f', '#40246a', '#5a2f7d', '#8e3f7e'],
  ['#0c1430', '#13204a', '#1b2d63', '#243c7c', '#2f4d94'],
  ['#06040f', '#0e0a24', '#170f38', '#22134a', '#2f185c'],
].map((t) => t.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))));
const FLOORS_PER_THEME = 25;

const LOGO_COLORS = [PAL.red, PAL.gold, PAL.green, PAL.blue, PAL.purple];
const ROPE = '#f2e3c6';
const ROPE_SHADE = '#6e4f63';
const CITY_W = 720;
const FAR_CITY = '#160c26';
const NEAR_CITY = '#0f0a1c';
const DIM = 'rgba(16,8,28,0.62)';
const MOOD_BG = {
  neutral: '#3d2e5c', happy: '#2f7d5b', ecstatic: '#b07a22', worried: '#5c3d6e', shocked: '#9e2f3a',
};

// Results screen: headline + gap, card, gap, two rows of buttons.
const RESULT_CHROME = 26 + 8 + 18 + 6 + 18;

const easeOutBack = (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.low = document.createElement('canvas');
    this.bg = document.createElement('canvas');
    this.crt = document.createElement('canvas');
    this.frame = 0;
    this.buttons = [];
    this.streaks = [];
    this.lastTime = 0;
    this.postcard = null; // canvas from postcard.js, set by main.js at game over
    this.shareLabel = 'SAVE IMAGE';

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
  }

  // Id of the on-screen button under a virtual-pixel position, if any.
  hit(x, y) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b.id;
    }
    return null;
  }

  // How many floors the camera has climbed since the start of the game.
  altitude(game) {
    return Math.max(0, (-game.cam.y - game.groundHomeY()) / BH);
  }

  draw(game, sound) {
    const { g, W } = this;
    this.frame++;
    this.buttons = [];
    const dt = clamp(game.time - this.lastTime, 0, 0.05);
    this.lastTime = game.time;
    const shx = game.shake ? Math.round((Math.random() * 2 - 1) * game.shake) : 0;
    const shy = game.shake ? Math.round((Math.random() * 2 - 1) * game.shake) : 0;
    // world -> screen: sx = x + ox, sy = y + oy
    const ox = Math.round(W / 2 - game.cam.x) + shx;
    const oy = Math.round(-game.cam.y) + shy;
    const alt = this.altitude(game);

    this.drawBackground(game.time, alt);
    this.drawStars(game, alt);
    this.drawMoon(alt);
    this.drawFlyers(game);
    this.drawCity(game, oy);
    this.drawBalloon(game, alt);
    this.drawClouds(game, alt);
    this.drawStreet(game, ox, oy);
    this.drawRecord(game, oy);
    this.drawTower(game, ox, oy);
    this.drawPigeons(game, ox, oy);
    this.drawCrane(game, shx, shy);
    this.drawFx(game, ox, oy);
    this.drawWind(game, dt);

    if (game.state === 'title') this.drawTitle(game);
    else if (game.state !== 'over') this.drawHud(game);
    if (game.state === 'pick') this.drawPick(game);
    if (game.state === 'over') this.drawGameOver(game);
    this.drawNonna(game);
    if (game.paused) this.drawPause(game);
    this.drawCornerButtons(game, sound);
    g.globalAlpha = 1;

    this.present(game);
  }

  // --- sky -------------------------------------------------------------------

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

  drawMoon(alt) {
    const a = clamp((alt - 22) / 8, 0, 1);
    if (!a) return;
    const { g, W, H } = this;
    g.globalAlpha = a;
    g.drawImage(moon, Math.round(W * 0.74 - 9), Math.round(H * 0.16 + (alt - 40) * 0.6));
    g.globalAlpha = 1;
  }

  drawFlyers(game) {
    const { g, W, H } = this;
    for (const f of game.flyers) {
      const spr = f.type === 'ufo' ? ufo[Math.floor(f.t * 6) % 2] : satellite;
      const wobble = f.type === 'ufo' ? Math.sin(f.t * 5) * 4 : 0;
      g.drawImage(spr, Math.round(f.u * W - spr.width / 2), Math.round(f.v * H + wobble));
    }
  }

  drawBalloon(game, alt) {
    if (alt > 40) return;
    const { g, W, H } = this;
    const b = game.balloon;
    const y = Math.round((b.y - game.cam.y) * 0.75 + Math.sin(game.time * 0.8) * 2);
    if (y > H || y + balloon.height < 0) return;
    g.drawImage(balloon, Math.round(W / 2 + b.x - game.cam.x * 0.75 - balloon.width / 2), y);
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

  // A dashed line and a pennant at the height of your best tower.
  drawRecord(game, oy) {
    if (game.state === 'title' || game.record < 3 || game.recordBroken) return;
    const { g, W, H } = this;
    const y = oy - (game.record + 1) * BH;
    if (y < 8 || y > H) return;
    g.globalAlpha = 0.8;
    g.fillStyle = PAL.gold;
    for (let x = (Math.floor(game.time * 12) % 6) - 6; x < W; x += 6) g.fillRect(x, y, 4, 1);
    g.globalAlpha = 1;
    const px = W - 12;
    g.fillStyle = PAL.cream;
    g.fillRect(px, y - 15, 1, 15);
    const flap = Math.floor(game.time * 4) % 2;
    g.fillStyle = PAL.red;
    for (let j = 0; j < 5; j++) g.fillRect(px + 1, y - 15 + j, 6 - j - (j === 2 ? flap : 0), 1);
    drawText(g, `RECORD ${game.record}`, px - 3, y - 10, { align: 'right', color: PAL.gold, outline: INK });
  }

  // --- tower, crane and friends ---------------------------------------------

  // Fallen floors lying in the street and the bulldozer clearing them. They're
  // drawn behind the tower, so the dozer drives past behind the ground floor.
  drawStreet(game, ox, oy) {
    const { g, W } = this;
    if (oy > this.H + BW) return;
    // Older pieces are drawn first; one with a newer piece over it is shaded
    // so the pile reads as front and back. Pushed pieces jitter as they scrape.
    const rubble = game.rubble;
    rubble.forEach((r, i) => {
      const x = Math.round(r.x) + ox;
      if (x < -BW || x > W + BW) return;
      const behind = rubble.some((q, j) => j > i && Math.abs(q.x - r.x) < q.w + r.w);
      const jitter = r.scrape ? Math.sin(game.time * 40 + r.x) * 0.035 * r.scrape : 0;
      g.save();
      g.translate(x, Math.round(r.y) + oy);
      g.rotate(r.rot + jitter);
      g.drawImage(behind ? shaded(r.sprite) : r.sprite, -BW / 2, -BH / 2);
      g.restore();
    });
    const d = game.dozer;
    if (!d) return;
    const spr = dozer(Math.floor(d.t * 10), d.dir);
    const bob = Math.floor(d.t * 10) % 2;
    g.drawImage(spr, Math.round(d.x - spr.width / 2) + ox, oy - spr.height + 1 - bob);
  }

  drawTower(game, ox, oy) {
    const { g, H } = this;
    const dip = Math.round(game.dip);
    const n = game.blocks.length;
    const first = Math.max(0, Math.floor((oy - H) / BH) - 1);
    const last = Math.min(n - 1, Math.ceil(oy / BH));
    for (let i = first; i <= last; i++) {
      const b = game.blocks[i];
      const x = Math.round(game.blockX(i) - BW / 2) + ox;
      const y = oy - (i + 1) * BH + (i > 0 ? dip : 0);
      const s = Math.round(b.squash * 2);
      if (s) g.drawImage(b.sprite, x - s, y + s, BW + 2 * s, BH - s);
      else g.drawImage(b.sprite, x, y);
      if (b.gold) this.twinkle(x, y, i, game.time);
    }
    const f = game.falling;
    if (f) g.drawImage(f.block.sprite, Math.round(f.x - BW / 2) + ox, Math.round(f.y) + oy);
  }

  twinkle(x, y, i, t) {
    const beat = t * 3 + i * 0.37;
    if (beat % 1 > 0.5) return;
    const r = rng(Math.floor(beat) * 131 + i);
    const px = x + 3 + Math.floor(r() * (BW - 6));
    const py = y + 4 + Math.floor(r() * (BH - 8));
    this.g.fillStyle = '#ffffff';
    this.g.fillRect(px - 1, py, 3, 1);
    this.g.fillRect(px, py - 1, 1, 3);
  }

  drawPigeons(game, ox, oy) {
    for (const p of game.pigeons) {
      const flying = p.state !== 'sit';
      const frame = flying ? (Math.floor(p.t * 12) % 2 ? 'up' : 'down') : Math.sin(p.t * 3 + p.dx) > 0.8 ? 'peck' : 'sit';
      const spr = pigeon(frame, p.face);
      this.g.drawImage(spr, Math.round(p.x - spr.width / 2) + ox, Math.round(p.y - spr.height) + oy + 1);
    }
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
      if (p.kind === 'spark') {
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x, y - 1, 1, 3);
      } else if (p.kind === 'coin') {
        g.fillRect(x, y, 2, 2);
        g.fillStyle = '#fff3c4';
        g.fillRect(x, y, 1, 1);
      } else if (p.kind === 'confetti') {
        if (Math.floor(game.time * 8 + p.seed) % 2) g.fillRect(x, y, 2, 1);
        else g.fillRect(x, y, 1, 2);
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

  // Streaks and the odd leaf blowing across the screen during a gust.
  drawWind(game, dt) {
    const { g, W, H } = this;
    const w = game.wind.value;
    if (!game.paused && Math.abs(w) > 3 && Math.random() < (Math.abs(w) / CFG.windMax) * 1.2) {
      this.streaks.push({
        x: w > 0 ? -8 : W + 8,
        y: Math.random() * H,
        len: 3 + Math.floor(Math.random() * 6),
        v: w * (3 + Math.random() * 2),
        leaf: Math.random() < 0.1,
        seed: Math.random() * 6,
      });
    }
    for (const s of this.streaks) s.x += s.v * dt;
    this.streaks = this.streaks.filter((s) => s.x > -20 && s.x < W + 20);
    for (const s of this.streaks) {
      if (s.leaf) {
        g.fillStyle = s.seed > 3 ? PAL.orange : PAL.green;
        g.fillRect(Math.round(s.x), Math.round(s.y + Math.sin(game.time * 8 + s.seed) * 3), 2, 1);
      } else {
        g.globalAlpha = 0.35;
        g.fillStyle = PAL.cream;
        g.fillRect(Math.round(s.x), Math.round(s.y), s.len, 1);
        g.globalAlpha = 1;
      }
    }
  }

  // --- HUD and screens --------------------------------------------------------

  drawCardIcon(card, x, y, scale = 1) {
    const icon = cardIcon(card.id);
    if (icon) this.g.drawImage(icon, x, y, icon.width * scale, icon.height * scale);
    else drawText(this.g, card.glyph, x + 7 * scale, y + 4 * scale, { scale, color: PAL.gold, outline: INK, align: 'center' });
  }

  drawHud(game) {
    const { g, W } = this;
    drawText(g, Math.floor(game.shownScore), 6, 6, { scale: 2, color: PAL.cream, outline: INK, shadow: INK });
    drawText(g, `FLOOR ${game.floors}`, 6, 24, { color: PAL.dim, outline: INK });

    // Blessings held this run.
    let bx = 5;
    for (const card of CARDS) {
      const n = game.owned[card.id];
      if (!n) continue;
      this.drawCardIcon(card, bx, 34);
      if (n > 1) drawText(g, n, bx + 13, 41, { color: PAL.cream, outline: INK });
      bx += n > 1 ? 21 : 15;
    }

    const slots = Math.max(CFG.lives, game.lives);
    for (let i = 0; i < slots; i++) {
      g.drawImage(i < game.lives ? heartFull : heartEmpty, W - 6 - (slots - i) * 10, 5);
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

    // Wind: flashes while a gust is announced, then shows its strength.
    const wd = game.wind;
    if (wd.warn > 0 || Math.abs(wd.value) > 2) {
      const strength = wd.warn > 0 ? wd.power : Math.abs(wd.value);
      const dir = wd.warn > 0 ? wd.dir : Math.sign(wd.value);
      const arrows = (dir > 0 ? '>' : '<').repeat(Math.max(1, Math.ceil((strength / CFG.windMax) * 3)));
      const text = dir > 0 ? `WIND ${arrows}` : `${arrows} WIND`;
      if (!(wd.warn > 0 && Math.floor(game.time * 6) % 2)) {
        drawText(g, text, W - 6, 28, { align: 'right', color: PAL.blue, outline: INK });
      }
    }

    if (game.combo >= 2) {
      drawText(g, `X${game.combo}`, W - 6, 40, {
        scale: 2, align: 'right', color: PAL.orange, outline: INK, shadow: INK, wave: 1, waveSpeed: 10, time: game.time,
      });
    }
  }

  drawNonna(game) {
    const { g, W } = this;
    const n = game.nonna;
    const x = 4;
    const y = this.H - 27 - Math.round(Math.sin(n.bob * Math.PI) * 2);
    g.fillStyle = INK;
    g.fillRect(x + 1, y + 23, 20, 2);
    box(g, x, y, 22, 22, MOOD_BG[n.mood] || MOOD_BG.neutral);
    g.drawImage(nonnaFace(n.face), x + 3, y + 5);

    if (n.textT <= 0) return;
    const tw = textWidth(n.text);
    const bw = Math.min(tw + 8, W - x - 34);
    const bx = x + 28;
    const by = y + 4;
    box(g, bx, by, bw, 13, PAL.cream);
    g.fillStyle = INK; // tail pointing at Nonna
    g.fillRect(bx - 3, by + 7, 2, 1);
    g.fillRect(bx - 2, by + 6, 1, 1);
    g.fillRect(bx - 2, by + 8, 1, 1);
    g.fillStyle = PAL.cream;
    g.fillRect(bx - 1, by + 6, 1, 3);
    g.fillRect(bx - 2, by + 7, 1, 1);
    drawText(g, n.text, bx + 4, by + 3, { color: INK });
  }

  button(id, x, y, w, h, label, color) {
    const { g } = this;
    g.fillStyle = INK;
    g.fillRect(x + 1, y + h + 1, w - 2, 2);
    box(g, x, y, w, h, color);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(x + 1, y + 1, w - 2, 1);
    drawText(g, label, x + w / 2, y + Math.round((h - 7) / 2), { color: PAL.cream, outline: INK, align: 'center' });
    this.buttons.push({ id, x: x - 2, y: y - 2, w: w + 4, h: h + 4 });
  }

  drawCornerButtons(game, sound) {
    const { g, W, H } = this;
    g.drawImage(sound.muted ? speakerOff : speakerOn, W - 16, H - 14);
    this.buttons.push({ id: 'mute', x: W - 24, y: H - 26, w: 24, h: 26 });
    if ((game.state === 'play' || game.state === 'pick') && !game.paused) {
      g.drawImage(pauseIcon, W - 31, H - 14);
      this.buttons.push({ id: 'pause', x: W - 46, y: H - 26, w: 22, h: 26 });
    }
  }

  drawTitle(game) {
    const { g, W, H } = this;
    const t = game.time;
    const y0 = Math.round(Math.max(0, H - GAME_H) * 0.3);
    drawText(g, 'TORRONDOLA', W / 2, y0 + 24, {
      scale: 2, colors: LOGO_COLORS, outline: INK, shadow: INK, align: 'center', wave: 2, waveSpeed: 4, time: t,
    });
    drawText(g, 'LA TORRETTA CHE DONDOLA', W / 2, y0 + 46, { color: PAL.cream, outline: INK, align: 'center' });

    if (Math.floor(t * 2.5) % 2 === 0) {
      drawText(g, 'TAP TO START', W / 2, y0 + 128, { color: PAL.cream, outline: INK, shadow: INK, align: 'center' });
    }
    const best = game.save.best || 0;
    if (best) {
      drawText(g, `BEST ${best}  -  ${game.save.bestFloors || 0} FLOORS`, W / 2, y0 + 144, {
        color: PAL.dim, outline: INK, align: 'center',
      });
    }
  }

  drawPick(game) {
    const { g, W, H } = this;
    const p = game.pick;
    g.fillStyle = DIM;
    g.fillRect(0, 0, W, H);
    const cw = 56;
    const ch = 74;
    const gap = 4;
    const n = p.cards.length;
    const x0 = Math.round(W / 2 - (n * cw + (n - 1) * gap) / 2);
    const cy = Math.round(clamp(H * 0.3, 70, 150));

    drawText(g, 'BENEDIZIONE!', W / 2, cy - 42, {
      scale: 2, color: PAL.gold, outline: INK, shadow: INK, align: 'center', wave: 1, waveSpeed: 5, time: game.time,
    });
    drawText(g, 'NONNA HAS A GIFT: PICK ONE', W / 2, cy - 20, { color: PAL.cream, outline: INK, align: 'center' });

    p.cards.forEach((card, i) => {
      const k = clamp((p.t - i * 0.08) / 0.35, 0, 1);
      const focus = p.focus === i;
      const x = x0 + i * (cw + gap);
      const y = Math.round(cy + (1 - easeOutBack(k)) * (H - cy + 10) - (focus ? 6 : 0) + Math.sin(game.time * 2 + i * 2));
      this.drawCard(card, x, y, cw, ch, focus, game);
      this.buttons.push({ id: `card${i}`, x, y: cy - 10, w: cw, h: ch + 16 });
    });

    const py = cy + ch + 12;
    panel(g, Math.round(W / 2 - 82), py, 164, 40);
    if (p.focus >= 0) {
      const card = p.cards[p.focus];
      card.text.forEach((text, i) => drawText(g, text, W / 2, py + 6 + i * 10, { color: PAL.cream, align: 'center' }));
      if (Math.floor(game.time * 3) % 2 === 0) {
        drawText(g, 'TAP AGAIN TO TAKE IT', W / 2, py + 28, { color: PAL.gold, align: 'center' });
      }
    } else {
      drawText(g, 'TAP A CARD TO READ IT', W / 2, py + 16, { color: PAL.dim, align: 'center' });
    }
  }

  // A Balatro-style card: rarity-colored face, icon window, name, rarity gems.
  drawCard(card, x, y, w, h, focus, game) {
    const { g } = this;
    const rar = RARITY[card.rarity];
    g.fillStyle = INK;
    g.fillRect(x + 2, y + h + 1, w - 2, 2);
    box(g, x, y, w, h, focus ? PAL.gold : PAL.cream);
    g.fillStyle = rar.color;
    g.fillRect(x + 2, y + 2, w - 4, h - 4);
    box(g, x + 6, y + 6, w - 12, 36, rar.light);
    g.fillStyle = 'rgba(26,16,40,0.25)';
    g.fillRect(x + 6, y + 30, w - 12, 12);
    this.drawCardIcon(card, Math.round(x + w / 2 - 14), y + 10, 2);
    drawText(g, card.name, x + w / 2, y + 48, { color: PAL.cream, outline: INK, align: 'center' });
    const gems = card.rarity + 1;
    for (let k = 0; k < gems; k++) {
      const gx = Math.round(x + w / 2 - (gems * 6 - 2) / 2 + k * 6);
      g.fillStyle = INK;
      g.fillRect(gx - 1, y + 61, 6, 6);
      g.fillStyle = rar.light;
      g.fillRect(gx, y + 62, 4, 4);
      g.fillStyle = PAL.cream;
      g.fillRect(gx, y + 62, 1, 1);
    }
    const owned = game.owned[card.id];
    if (owned) drawText(g, `X${owned}`, x + w - 4, y + 4, { color: PAL.cream, outline: INK, align: 'right' });
    if (focus && Math.floor(game.time * 4) % 2) {
      g.fillStyle = PAL.cream;
      for (const [sx, sy] of [[x - 3, y + 8], [x + w + 2, y + h - 10]]) {
        g.fillRect(sx - 1, sy, 3, 1);
        g.fillRect(sx, sy - 1, 1, 3);
      }
    }
  }

  // Keep the bottom-left corner clear for Nonna on narrow screens.
  resultReserve() {
    return this.W < 300 ? 32 : 6;
  }

  // Size of the results card for this screen: the photo grows to fill the room.
  resultCardSize() {
    const free = this.H - this.resultReserve() - 8 - RESULT_CHROME;
    return {
      width: Math.min(CARD_W, this.W - 12),
      photoH: clamp(free - cardHeight(0), PHOTO_MIN, PHOTO_MAX),
    };
  }

  drawGameOver(game) {
    const { g, W, H } = this;
    const card = this.postcard;
    if (!card) return;
    const cw = card.width;
    const ch = card.height;
    const top = Math.round(clamp((H - this.resultReserve() - RESULT_CHROME - ch) * 0.45, 4, H));
    const e = easeOutBack(clamp(game.overT / 0.55, 0, 1));
    const px = Math.round(W / 2 - cw / 2);
    const py = Math.round(top + 26 + (1 - e) * (H - top));

    g.globalAlpha = clamp(game.overT * 3, 0, 1);
    drawText(g, game.reason === 'topple' ? 'TOWER FELL!' : 'GAME OVER', W / 2, top, {
      scale: 2, color: PAL.red, outline: INK, shadow: INK, align: 'center', wave: 1, waveSpeed: 6, time: game.time,
    });
    g.globalAlpha = 1;
    g.fillStyle = INK;
    g.fillRect(px + 3, py + ch, cw - 4, 3);
    g.drawImage(card, px, py);

    if (game.overT > 0.8) {
      const by = py + ch + 8;
      const half = Math.floor((cw - 6) / 2);
      this.button('retry', px, by, cw, 18, 'PLAY AGAIN', '#2f7d5b');
      this.button('menu', px, by + 24, half, 18, 'MENU', '#5c3d6e');
      this.button('share', px + cw - half, by + 24, half, 18, this.shareLabel, '#2a5f9e');
    }
  }

  drawPause(game) {
    const { g, W, H } = this;
    g.fillStyle = DIM;
    g.fillRect(0, 0, W, H);
    const y = Math.round(H * 0.3);
    drawText(g, 'PAUSED', W / 2, y, {
      scale: 2, color: PAL.cream, outline: INK, shadow: INK, align: 'center', wave: 1, waveSpeed: 4, time: game.time,
    });
    const bw = 124;
    const bx = Math.round(W / 2 - bw / 2);
    this.button('resume', bx, y + 32, bw, 18, 'RESUME', '#2f7d5b');
    this.button('restart', bx, y + 58, bw, 18, 'RESTART', '#b0612a');
    this.button('quit', bx, y + 84, bw, 18, 'MAIN MENU', '#9e2f3a');
  }

  present(game) {
    const { ctx, W, H, scale } = this;
    const cw = W * scale;
    const ch = H * scale;
    ctx.drawImage(this.low, 0, 0, cw, ch);
    ctx.drawImage(this.crt, 0, 0);

    if (game.state === 'play' && !game.paused && game.danger > 0.65) {
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
