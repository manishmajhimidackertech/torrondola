// Game rules and simulation. Knows nothing about drawing.
//
// World coordinates: x = 0 is the tower's starting column, y = 0 is the ground
// and grows downward like the canvas, so block i occupies y in [-(i+1)*BH, -i*BH].
import { BW, BH, CFG, GAME_H, TOWER_TOP_Y } from './config.js';
import { PAL, STYLES, blockSprite } from './sprites.js';
import { writeSave } from './storage.js';

const BASE_VARIANT = 4;

export class Game {
  constructor(sound, save) {
    this.sound = sound;
    this.save = save;
    this.state = 'title'; // title | play | over
    this.time = 0;
    this.phase = 0; // crane swing phase
    this.rope = CFG.ropeShort;
    this.ropeVel = 0;
    this.cam = { x: 0, y: 0 };
    this.viewH = GAME_H; // virtual screen height, set by main.js on resize
    this.reset();
    this.cam.y = this.camTargetY();
  }

  reset() {
    this.score = 0;
    this.shownScore = 0;
    this.lives = CFG.lives;
    this.combo = 0;
    this.bestCombo = 0;
    this.reached = 0;
    this.blocks = [{ ox: 0, sprite: blockSprite(0, BASE_VARIANT, true) }];
    this.lean = 0;
    this.leanVel = 0;
    this.hang = null;
    this.falling = null;
    this.nextIn = 0;
    this.endIn = 0;
    this.overT = 0;
    this.debris = [];
    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.flash = 0;
    this.dip = 0;
    this.danger = 0;
    this.wobbleWarned = false;
    this.reason = '';
    this.newBest = false;
  }

  get floors() {
    return this.blocks.length - 1;
  }

  get level() {
    return Math.floor(this.floors / CFG.floorsPerLevel);
  }

  swingAmp() {
    return Math.min(CFG.swingAmpMax, CFG.swingAmp + CFG.swingAmpStep * this.level);
  }

  swingSpeed() {
    return Math.min(CFG.swingSpeedMax, CFG.swingSpeed + CFG.swingSpeedStep * this.level);
  }

  swayFreq() {
    return CFG.swayFreq / Math.sqrt(1 + this.floors / 25); // taller towers sway slower
  }

  // Displayed x of block i: its resting offset plus the lean of the tower.
  blockX(i) {
    return this.blocks[i].ox + this.lean * (i + 0.5) * BH;
  }

  // Screen y of the ground before the tower is tall enough for the camera to climb.
  groundHomeY() {
    return Math.max(TOWER_TOP_Y + BH, this.viewH - CFG.groundPad);
  }

  // The tower grows up toward the crane; once its top reaches TOWER_TOP_Y the camera follows it.
  camTargetY() {
    return Math.min(-this.blocks.length * BH - TOWER_TOP_Y, -this.groundHomeY());
  }

  // Rope end relative to the top-centre of the screen (sx, sy), plus the world
  // position and sideways speed of a block hanging from it.
  hookState() {
    const amp = this.swingAmp();
    const a = amp * Math.sin(this.phase);
    const len = Math.max(0, this.rope);
    const sx = Math.sin(a) * len;
    const sy = CFG.pivotY + Math.cos(a) * len;
    const vx = len * Math.cos(a) * amp * Math.cos(this.phase) * this.swingSpeed();
    return { sx, sy, x: this.cam.x + sx, y: this.cam.y + sy + CFG.hookDrop, vx };
  }

  // --- input ---------------------------------------------------------------

  press() {
    if (this.state === 'title') this.start();
    else if (this.state === 'over') {
      if (this.overT > 0.8) this.start();
    } else if (this.hang && this.hang.age > CFG.readyAfter && this.endIn <= 0) this.release();
  }

  start() {
    this.reset();
    this.state = 'play';
    this.nextIn = 0.15;
    this.sound.setLevel(0);
    this.sound.start();
    this.sound.music(true);
  }

  release() {
    const h = this.hookState();
    this.falling = { x: h.x, y: h.y, vx: h.vx * CFG.dropMomentum, vy: 0, block: this.hang.block };
    this.hang = null;
    this.sound.drop();
  }

  spawn() {
    const i = this.blocks.length;
    const style = Math.floor(i / CFG.floorsPerStyle) % STYLES.length;
    const variant = Math.floor(Math.random() * 27);
    this.hang = { block: { ox: 0, sprite: blockSprite(style, variant) }, age: 0 };
  }

  // --- simulation ----------------------------------------------------------

  update(dt) {
    this.time += dt;
    this.phase += this.swingSpeed() * dt;

    // The rope is a spring: it lowers new blocks in and snaps back up after a drop.
    const target = this.hang ? CFG.ropeLen : CFG.ropeShort;
    this.ropeVel += ((target - this.rope) * 260 - this.ropeVel * 20) * dt;
    this.rope += this.ropeVel * dt;
    if (this.hang) this.hang.age += dt;

    if (this.state === 'play') this.updatePlay(dt);
    else if (this.state === 'over') this.overT += dt;

    this.updateSway(dt);
    this.updateCamera(dt);
    this.updateFx(dt);
  }

  updatePlay(dt) {
    if (this.falling) this.updateFalling(dt);
    if (this.endIn > 0) {
      this.endIn -= dt;
      if (this.endIn <= 0) this.finish();
      return;
    }
    if (!this.hang && !this.falling) {
      this.nextIn -= dt;
      if (this.nextIn <= 0 && Math.abs(this.cam.y - this.camTargetY()) < 3) this.spawn();
    }
  }

  updateFalling(dt) {
    const f = this.falling;
    f.vy += CFG.gravity * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    const n = this.blocks.length;
    const topY = -n * BH;
    if (f.y + BH < topY) return;
    this.falling = null;
    const dx = f.x - this.blockX(n - 1);
    if (Math.abs(dx) <= BW / 2) this.land(f, dx);
    else this.miss(f, dx);
  }

  land(f, dx) {
    const n = this.blocks.length;
    const adx = Math.abs(dx);
    const kind = adx <= CFG.perfectTol ? 'perfect' : adx <= CFG.goodTol ? 'good' : 'ok';
    if (kind === 'perfect') {
      f.x -= dx; // snap dead centre
      dx = 0;
    }
    f.y = -(n + 1) * BH;
    const h = (n + 0.5) * BH;
    f.block.ox = f.x - this.lean * h;
    this.blocks.push(f.block);
    this.reached = Math.max(this.reached, this.floors);
    this.leanVel += (CFG.kick * dx + CFG.momentumKick * f.vx) / h;

    const top = f.y;
    let pts;
    if (kind === 'perfect') {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.lean *= CFG.perfectSteady;
      this.leanVel *= CFG.perfectSteady;
      pts = CFG.perfectPoints * this.combo;
      this.popup('PERFECT!', f.x, top - 22, { color: PAL.gold, scale: 2, life: 1.1, wave: 1 });
      if (this.combo > 1) this.popup(`X${this.combo} COMBO`, f.x, top - 34, { color: PAL.orange, life: 1.1, wave: 1 });
      this.sparkle(f.x, top);
      this.flash = 0.16;
      this.shake = Math.max(this.shake, 2);
      this.sound.perfect(this.combo);
    } else {
      this.combo = 0;
      pts = kind === 'good' ? CFG.goodPoints : CFG.okPoints;
      if (kind === 'good') this.popup('GOOD', f.x, top - 16, { color: PAL.green, life: 0.8 });
      this.shake = Math.max(this.shake, 1.2);
      this.sound.land(kind);
    }
    this.score += pts;
    this.popup(`+${pts}`, f.x, top - 6, { color: PAL.cream, life: 0.8 });
    this.dust(f.x, top + BH);
    this.dip = 2;
    this.nextIn = CFG.nextDelay;

    if (this.floors % 10 === 0) {
      this.popup(`${this.floors} FLOORS!`, f.x, top - 48, { color: PAL.blue, scale: 2, life: 1.6, wave: 2 });
      this.sound.milestone();
    }
    this.sound.setLevel(this.level);
  }

  miss(f, dx) {
    const n = this.blocks.length;
    const side = Math.sign(dx) || 1;
    const touching = Math.abs(dx) < BW;
    if (touching) f.y = -(n + 1) * BH;
    // A glancing block tips over the edge and gives the tower a shove;
    // a clean miss just keeps falling.
    this.debris.push({
      x: f.x,
      y: f.y + BH / 2,
      vx: touching ? f.vx * 0.5 + side * 45 : f.vx,
      vy: touching ? -50 : f.vy,
      rot: 0,
      vr: touching ? side * 5 : side * 1.2,
      sprite: f.block.sprite,
    });
    if (touching) this.leanVel += (side * CFG.kick * 6) / ((n - 0.5) * BH);
    this.lives--;
    this.combo = 0;
    this.popup('MISS!', f.x, f.y - 10, { color: PAL.red, scale: 2, life: 1, wave: 1 });
    this.shake = 3;
    this.sound.miss();
    if (this.lives <= 0) {
      this.reason = 'lives';
      this.endIn = 1.1;
    } else {
      this.nextIn = 0.5;
    }
  }

  updateSway(dt) {
    const w = this.swayFreq();
    this.leanVel += (-w * w * this.lean - 2 * CFG.swayDamping * w * this.leanVel) * dt;
    this.lean += this.leanVel * dt;

    const h = (this.blocks.length - 0.5) * BH;
    const x = this.lean * h;
    const v = this.leanVel * h;
    this.danger = Math.sqrt(x * x + (v / w) ** 2) / CFG.toppleAt; // envelope of the swing

    if (this.state !== 'play' || this.endIn > 0) return;
    if (Math.abs(x) > CFG.toppleAt) this.topple();
    else if (this.danger > 0.7 && !this.wobbleWarned) {
      this.wobbleWarned = true;
      this.popup('WOBBLY!', this.blockX(this.blocks.length - 1), -this.blocks.length * BH - 40, {
        color: PAL.red,
        life: 1.2,
        wave: 2,
      });
      this.sound.warn();
    } else if (this.danger < 0.5) this.wobbleWarned = false;
  }

  topple() {
    const n = this.blocks.length;
    const side = Math.sign(this.lean) || 1;
    const count = Math.min(n - 1, 14);
    for (let k = 0; k < count; k++) {
      const i = n - 1 - k;
      const lift = count - k; // higher blocks fly further
      this.debris.push({
        x: this.blockX(i),
        y: -(i + 0.5) * BH,
        vx: side * (20 + lift * 9 + Math.random() * 20),
        vy: -20 - Math.random() * 40,
        rot: 0,
        vr: side * (1 + Math.random() * 3),
        sprite: this.blocks[i].sprite,
      });
    }
    if (this.falling) {
      const f = this.falling;
      this.debris.push({ x: f.x, y: f.y + BH / 2, vx: f.vx, vy: f.vy, rot: 0, vr: side, sprite: f.block.sprite });
      this.falling = null;
    }
    this.blocks.length = n - count;
    this.lean = 0;
    this.leanVel = 0;
    this.lives = 0;
    this.reason = 'topple';
    this.endIn = 1.4;
    this.shake = 6;
    this.flash = 0.3;
    this.popup('CROLLO!', this.cam.x, this.cam.y + TOWER_TOP_Y - 30, { color: PAL.red, scale: 2, life: 1.4, wave: 2 });
    this.sound.topple();
  }

  finish() {
    this.state = 'over';
    this.overT = 0;
    this.newBest = this.score > (this.save.best || 0);
    if (this.newBest) this.save.best = this.score;
    this.save.bestFloors = Math.max(this.save.bestFloors || 0, this.reached);
    writeSave(this.save);
    this.sound.music(false);
    this.sound.gameOver();
  }

  updateCamera(dt) {
    this.cam.y += (this.camTargetY() - this.cam.y) * (1 - Math.exp(-dt * 6));
    const top = this.blocks[this.blocks.length - 1];
    this.cam.x += (top.ox - this.cam.x) * (1 - Math.exp(-dt * 2));
  }

  // --- effects -------------------------------------------------------------

  popup(text, x, y, { color, scale = 1, life = 1, wave = 0 }) {
    this.popups.push({ text, x, y, color, scale, life, wave, t: 0 });
  }

  dust(x, y) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        this.particles.push({
          x: x + side * (BW / 2 - 2),
          y: y - 1,
          vx: side * (15 + Math.random() * 45),
          vy: -10 - Math.random() * 25,
          g: 60,
          life: 0.4 + Math.random() * 0.3,
          max: 0.7,
          color: Math.random() < 0.5 ? '#d9cbe8' : '#9a8fb8',
          size: Math.random() < 0.4 ? 2 : 1,
        });
      }
    }
  }

  sparkle(x, y) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        g: 40,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
        color: Math.random() < 0.5 ? PAL.gold : PAL.cream,
        spark: true,
      });
    }
  }

  updateFx(dt) {
    for (const d of this.debris) {
      d.vy += CFG.gravity * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
    }
    this.debris = this.debris.filter((d) => d.y < this.cam.y + 1200);

    for (const p of this.particles) {
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);

    this.shake = Math.max(0, this.shake - dt * 12);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.dip = Math.max(0, this.dip - dt * 14);

    const diff = this.score - this.shownScore;
    if (diff > 0) this.shownScore += Math.min(diff, Math.max(1, Math.ceil(diff * dt * 10)));
  }
}
