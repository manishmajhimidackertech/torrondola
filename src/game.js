// Game rules and simulation. Knows nothing about drawing.
//
// World coordinates: x = 0 is the tower's starting column, y = 0 is the ground
// and grows downward like the canvas, so block i occupies y in [-(i+1)*BH, -i*BH].
import { BW, BH, CFG, GAME_H, GAME_W, TOWER_TOP_Y } from './config.js';
import { FLOOR_SEEDS, PAL, STYLES, baseSprite, floorSprite, goldSprite } from './sprites.js';
import { computeMods, dealCards } from './cards.js';
import { DOZER_BACK, DOZER_REACH } from './art.js';
import { Nonna } from './nonna.js';
import { writeSave } from './storage.js';

// The big callout for a perfect drop climbs with the combo.
const COMBO_WORDS = ['PERFETTO!', 'BRAVO!', 'BRAVISSIMO!', 'MAGNIFICO!', 'STUPENDO!', 'FANTASTICO!', 'LEGGENDARIO!'];
const CONFETTI = [PAL.red, PAL.gold, PAL.green, PAL.blue, PAL.purple, PAL.cream];

function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration unsupported or blocked: the game is fine without it.
  }
}

export class Game {
  constructor(sound, save) {
    this.sound = sound;
    this.save = save;
    this.nonna = new Nonna(sound);
    this.state = 'title'; // title | play | pick | over
    this.paused = false;
    this.time = 0;
    this.phase = 0; // crane swing phase
    this.rope = CFG.ropeShort;
    this.ropeVel = 0;
    this.cam = { x: 0, y: 0 };
    this.viewH = GAME_H; // virtual screen size, set by main.js on resize
    this.viewW = GAME_W;
    // Fallen floors lying in the street, and the bulldozer that clears them.
    // Both outlive a reset so the dozer can tidy up after the last game.
    this.rubble = [];
    this.dozer = null;
    this.crewIn = 0;
    this.onFinish = null; // set by main.js to build the postcard
    this.titleTalk = 1.2;
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
    this.blocks = [{ ox: 0, sprite: baseSprite(), style: 0, squash: 0 }];
    this.lean = 0;
    this.leanVel = 0;
    this.hang = null;
    this.falling = null;
    this.nextIn = 0;
    this.endIn = 0;
    this.overT = 0;
    this.freeze = 0;
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

    this.owned = {};
    this.mods = computeMods(this.owned);
    this.pick = null;
    this.pickDue = false;

    this.record = this.save.bestFloors || 0;
    this.recordBroken = false;
    this.peak = null; // the tower as it stood before toppling, for the postcard
    this.summary = null;

    this.wind = { value: 0, target: 0, dir: 1, power: 0, warn: 0, hold: 0, next: 4, gusts: 0 };
    this.pigeons = [];
    this.flyers = [];
    this.flyIn = 8;
    const side = Math.random() < 0.5 ? -1 : 1;
    this.balloon = { x: side * 110, y: -(12 + Math.random() * 6) * BH, vx: -side * (5 + Math.random() * 4) };
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
    return Math.min(CFG.swingSpeedMax, CFG.swingSpeed + CFG.swingSpeedStep * this.level) * this.mods.swing;
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
    if (this.paused) return this.togglePause();
    if (this.state === 'title') this.start();
    else if (this.state === 'over') {
      if (this.overT > 0.8) this.start();
    } else if (this.state === 'pick') {
      const p = this.pick;
      if (p.t < 0.45) return;
      if (p.focus < 0) this.focusCard(Math.floor(p.cards.length / 2));
      else this.take(p.focus);
    } else if (this.hang && this.hang.age > CFG.readyAfter && this.endIn <= 0) this.release();
  }

  start() {
    this.reset();
    this.state = 'play';
    this.nextIn = 0.15;
    this.sound.setLevel(0);
    this.sound.setMuffled(false);
    this.sound.start();
    this.sound.music(true);
    this.nonna.say('start', { mood: 'happy', force: true });
  }

  togglePause() {
    if (this.state !== 'play' && this.state !== 'pick') return;
    this.paused = !this.paused;
    this.sound.setMuffled(this.paused || this.state === 'pick');
    this.sound.click();
  }

  autoPause() {
    if (!this.paused && (this.state === 'play' || this.state === 'pick')) this.togglePause();
  }

  // Starts over from the pause menu; anything already beaten still counts as a best.
  restart() {
    this.keepBest();
    this.paused = false;
    this.start();
  }

  // Leaves the run for the title screen (pause menu or results screen).
  quit() {
    if (this.state !== 'over') this.keepBest();
    this.paused = false;
    this.state = 'title';
    this.reset();
    this.titleTalk = 0.8;
    this.sound.music(false);
    this.sound.setMuffled(false);
    this.sound.click();
  }

  keepBest() {
    if (this.score > (this.save.best || 0)) this.save.best = this.score;
    this.save.bestFloors = Math.max(this.save.bestFloors || 0, this.reached);
    writeSave(this.save);
  }

  // Tapping a card focuses it; tapping the focused card takes it.
  tapCard(i) {
    const p = this.pick;
    if (this.paused || !p || p.t < 0.45 || i >= p.cards.length) return;
    if (p.focus === i) this.take(i);
    else this.focusCard(i);
  }

  moveFocus(d) {
    const p = this.pick;
    if (this.paused || !p || p.t < 0.45) return;
    const i = p.focus < 0 ? Math.floor(p.cards.length / 2) : (p.focus + d + p.cards.length) % p.cards.length;
    this.focusCard(i);
  }

  focusCard(i) {
    this.pick.focus = i;
    this.pick.focusT = 0;
    this.sound.cardFocus();
  }

  release() {
    const h = this.hookState();
    this.falling = { x: h.x, y: h.y, vx: h.vx * this.mods.momentum, vy: 0, block: this.hang.block };
    this.hang = null;
    this.sound.drop();
  }

  spawn() {
    const i = this.blocks.length;
    const seed = Math.floor(Math.random() * FLOOR_SEEDS);
    const gold = i >= CFG.goldFrom && i % CFG.blessingEvery !== 0 && Math.random() < CFG.goldChance;
    const style = Math.floor(i / CFG.floorsPerStyle) % STYLES.length;
    const sprite = gold ? goldSprite(seed) : floorSprite(style, seed);
    this.hang = { block: { ox: 0, sprite, style, gold, squash: 0 }, age: 0 };
  }

  enterPick() {
    this.pickDue = false;
    const cards = dealCards(this.owned, this.lives);
    if (!cards.length) return this.spawn();
    this.state = 'pick';
    this.popups = [];
    this.pick = { cards, focus: -1, focusT: 0, t: 0 };
    this.sound.cardsIn();
    this.sound.setMuffled(true);
    this.nonna.say('pick', { mood: 'happy', force: true });
  }

  take(i) {
    const card = this.pick.cards[i];
    this.owned[card.id] = (this.owned[card.id] || 0) + 1;
    this.mods = computeMods(this.owned);
    if (card.id === 'gatto') this.lives = Math.min(CFG.maxLives, this.lives + 1);
    this.pick = null;
    this.state = 'play';
    this.nextIn = 0.35;
    this.sound.cardTake();
    this.sound.setMuffled(false);
    this.nonna.say('picked', { mood: 'happy', force: true });
    const n = this.blocks.length;
    this.popup(`${card.name}!`, this.blockX(n - 1), -n * BH - 30, { color: PAL.purple, scale: 2, life: 1.2, wave: 1 });
  }

  // --- simulation ----------------------------------------------------------

  update(dt) {
    this.time += dt;
    this.nonna.update(dt, this.state === 'play' ? this.danger : 0);
    if (this.state === 'title' && (this.titleTalk -= dt) <= 0) {
      this.titleTalk = 7;
      this.nonna.say('title', { mood: 'happy', force: true });
    }
    if (this.paused) return;
    if (this.freeze > 0) {
      this.freeze -= dt; // hit-stop: hold the frame for a beat after a perfect drop
      return;
    }
    this.phase += this.swingSpeed() * dt;

    // The rope is a spring: it lowers new blocks in and snaps back up after a drop.
    const target = this.hang ? CFG.ropeLen : CFG.ropeShort;
    this.ropeVel += ((target - this.rope) * 260 - this.ropeVel * 20) * dt;
    this.rope += this.ropeVel * dt;
    if (this.hang) this.hang.age += dt;

    if (this.state === 'play') this.updatePlay(dt);
    else if (this.state === 'pick') {
      this.pick.t += dt;
      this.pick.focusT += dt;
    } else if (this.state === 'over') this.overT += dt;

    if (this.state !== 'pick') this.updateSway(dt);
    this.updateWind(dt);
    this.updatePigeons(dt);
    this.updateSky(dt);
    this.updateCamera(dt);
    this.updateFx(dt);
    this.updateCrew(dt);
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
      if (this.nextIn <= 0 && Math.abs(this.cam.y - this.camTargetY()) < 3) {
        if (this.pickDue) this.enterPick();
        else this.spawn();
      }
    }
  }

  updateFalling(dt) {
    const f = this.falling;
    f.vy += CFG.gravity * dt;
    f.vx += this.wind.value * dt;
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
    const kind = adx <= this.mods.perfectTol ? 'perfect' : adx <= CFG.goodTol ? 'good' : 'ok';
    if (kind === 'perfect') {
      f.x -= dx; // snap dead centre
      dx = 0;
    }
    f.y = -(n + 1) * BH;
    const h = (n + 0.5) * BH;
    const block = f.block;
    block.ox = f.x - this.lean * h;
    block.squash = 1;
    this.blocks.push(block);
    this.reached = Math.max(this.reached, this.floors);
    this.leanVel += (CFG.kick * dx + CFG.momentumKick * f.vx) / h;

    const top = f.y;
    let pts;
    if (kind === 'perfect') {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.lean *= CFG.perfectSteady;
      this.leanVel *= CFG.perfectSteady;
      pts = CFG.perfectPoints * this.combo * this.mods.perfectMult;
      const word = COMBO_WORDS[Math.min(this.combo, COMBO_WORDS.length) - 1];
      this.popup(word, f.x, top - 22, { color: PAL.gold, scale: 2, life: 1.1, wave: 1 });
      if (this.combo > 1) this.popup(`X${this.combo} COMBO`, f.x, top - 34, { color: PAL.orange, life: 1.1, wave: 1 });
      this.sparkle(f.x, top);
      this.flash = 0.16;
      this.shake = Math.max(this.shake, 2);
      this.freeze = this.combo >= 5 ? 0.09 : 0.05;
      this.sound.perfect(this.combo);
      this.nonna.say('perfect', { mood: this.combo >= 3 ? 'ecstatic' : 'happy', chance: 0.35 });
      buzz(18);
    } else {
      if (!(kind === 'good' && this.mods.keepCombo)) this.combo = 0;
      pts = kind === 'good' ? CFG.goodPoints : CFG.okPoints;
      if (kind === 'good') {
        this.popup('GOOD', f.x, top - 16, { color: PAL.green, life: 0.8 });
        this.nonna.say('good', { mood: 'happy', chance: 0.35 });
      } else {
        this.nonna.say('ok', { mood: adx > 14 ? 'worried' : 'neutral', chance: 0.35 });
      }
      this.shake = Math.max(this.shake, 1.2);
      this.sound.land(kind);
      buzz(8);
    }
    if (block.gold) {
      pts *= CFG.goldMult;
      this.coins(f.x, top);
      this.popup('ORO!', f.x, top - 56, { color: PAL.gold, scale: 2, life: 1.2, wave: 2 });
      this.sound.coin();
      this.nonna.say('gold', { mood: 'ecstatic', force: true });
    }
    pts *= this.mods.pointMult;
    this.score += pts;
    this.popup(`+${pts}`, f.x, top - 6, { color: PAL.cream, life: 0.8 });
    this.dust(f.x, top + BH);
    this.dip = 2;
    this.nextIn = CFG.nextDelay;

    if (!this.recordBroken && this.record >= 3 && this.floors > this.record) {
      this.recordBroken = true;
      this.popup('NUOVO RECORD!', f.x, top - 74, { color: PAL.gold, scale: 2, life: 2, wave: 2 });
      this.confetti();
      this.sound.record();
      this.nonna.say('record', { mood: 'ecstatic', force: true });
    } else if (this.floors % CFG.blessingEvery === 0) {
      this.popup(`${this.floors} FLOORS!`, f.x, top - 56, { color: PAL.blue, scale: 2, life: 1.6, wave: 2 });
      this.sound.milestone();
      this.nonna.say('milestone', { mood: 'happy', chance: 0.6 });
    }
    if (this.floors % CFG.blessingEvery === 0) {
      this.pickDue = true;
      this.nextIn = 1.1;
    }
    if (!this.pigeons.length && this.floors >= 3 && Math.random() < CFG.pigeonChance) this.spawnPigeon();
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
    this.nonna.say('miss', { mood: 'shocked', force: true });
    buzz([30, 40, 30]);
    if (this.lives <= 0) {
      this.reason = 'lives';
      this.endIn = 1.1;
    } else {
      this.nextIn = 0.5;
    }
  }

  updateSway(dt) {
    const w = this.swayFreq();
    this.leanVel += (-w * w * this.lean - 2 * CFG.swayDamping * this.mods.damping * w * this.leanVel) * dt;
    this.lean += this.leanVel * dt;

    const h = (this.blocks.length - 0.5) * BH;
    const x = this.lean * h;
    const v = this.leanVel * h;
    const limit = this.mods.toppleAt;
    this.danger = Math.sqrt(x * x + (v / w) ** 2) / limit; // envelope of the swing

    if (this.state !== 'play' || this.endIn > 0) return;
    if (Math.abs(x) > limit) this.topple();
    else if (this.danger > 0.7 && !this.wobbleWarned) {
      this.wobbleWarned = true;
      const n = this.blocks.length;
      this.popup('ATTENZIONE!', this.blockX(n - 1), -n * BH - 40, { color: PAL.red, life: 1.2, wave: 2 });
      this.sound.warn();
      this.nonna.say('wobbly', { mood: 'worried', force: true });
    } else if (this.danger < 0.5) this.wobbleWarned = false;
  }

  // Gusts are announced, blow for a few seconds, then die down.
  updateWind(dt) {
    const w = this.wind;
    if (this.state === 'play' && this.floors >= CFG.windFrom && this.endIn <= 0) {
      if (w.warn > 0) {
        w.warn -= dt;
        if (w.warn <= 0) {
          w.target = w.dir * w.power;
          w.hold = 2.5 + Math.random() * 2;
          this.sound.gust();
        }
      } else if (w.hold > 0) {
        w.hold -= dt;
        if (w.hold <= 0) {
          w.target = 0;
          w.next = 5 + Math.random() * 5;
        }
      } else if ((w.next -= dt) <= 0) {
        w.dir = Math.random() < 0.5 ? -1 : 1;
        w.power = CFG.windMax * Math.min(1, 0.45 + 0.08 * (this.level - 3));
        w.warn = 1.4;
        if (w.gusts++ === 0) this.nonna.say('wind', { mood: 'worried', force: true });
      }
    } else if (this.state !== 'pick') {
      w.target = 0;
      w.warn = 0;
      w.hold = 0;
    }
    w.value += (w.target - w.value) * (1 - Math.exp(-dt * 1.8));
    if (w.target === 0 && Math.abs(w.value) < 0.5) w.value = 0;
    if (this.state === 'play' && w.value) {
      this.leanVel += (w.value * CFG.windTower * dt) / ((this.blocks.length - 0.5) * BH);
    }
    this.sound.setWind(this.state === 'pick' ? 0 : Math.abs(w.value) / CFG.windMax);
  }

  spawnPigeon() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const top = this.blocks.length - 1;
    this.pigeons.push({
      state: 'arrive',
      k: 0,
      t: 0,
      top,
      from: { x: this.cam.x + side * 140, y: -(top + 1) * BH - 70 },
      x: 0,
      y: 0,
      dx: (Math.random() - 0.5) * (BW - 16),
      face: -side,
      vx: 0,
      vy: 0,
    });
  }

  updatePigeons(dt) {
    const top = this.blocks.length - 1;
    const roofY = -(top + 1) * BH;
    for (const p of this.pigeons) {
      p.t += dt;
      if (p.state === 'flee') {
        p.vy -= 70 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        continue;
      }
      const tx = this.blockX(top) + p.dx;
      if (p.state === 'arrive') {
        p.k = Math.min(1, p.k + dt / 1.2);
        const e = 1 - (1 - p.k) ** 2;
        p.x = p.from.x + (tx - p.from.x) * e;
        p.y = p.from.y + (roofY - p.from.y) * e - Math.sin(p.k * Math.PI) * 16;
        if (p.k >= 1) p.state = 'sit';
      } else {
        p.x = tx;
        p.y = roofY;
      }
      const f = this.falling;
      const threatened = f && roofY - (f.y + BH) < 55 && Math.abs(f.x - p.x) < BW;
      if (threatened || top < p.top || this.danger > 0.8 || this.state === 'over') this.scare(p);
      p.top = top;
    }
    this.pigeons = this.pigeons.filter((p) => p.state !== 'flee' || p.t < 3);
  }

  scare(p) {
    p.state = 'flee';
    p.t = 0;
    p.face = Math.random() < 0.5 ? -1 : 1;
    p.vx = p.face * (50 + Math.random() * 30);
    p.vy = -40;
    this.sound.flap();
    this.nonna.say('pigeon', { chance: 0.3 });
  }

  // The balloon drifts by; satellites and the odd UFO cross the sky up high.
  updateSky(dt) {
    this.balloon.x += this.balloon.vx * dt;
    for (const f of this.flyers) {
      f.u += f.du * dt;
      f.t += dt;
    }
    this.flyers = this.flyers.filter((f) => f.u > -0.4 && f.u < 1.4);
    if (this.state !== 'play' || (this.flyIn -= dt) > 0) return;
    this.flyIn = 10 + Math.random() * 12;
    const left = Math.random() < 0.5;
    const flyer = { u: left ? -0.2 : 1.2, v: 0.08 + Math.random() * 0.25, t: 0 };
    if (this.floors >= 70 && Math.random() < 0.45) {
      this.flyers.push({ ...flyer, type: 'ufo', du: left ? 0.35 : -0.35 });
      this.nonna.say('ufo', { mood: 'shocked', force: true });
    } else if (this.floors >= 45) {
      this.flyers.push({ ...flyer, type: 'satellite', du: left ? 0.06 : -0.06 });
    }
  }

  topple() {
    const n = this.blocks.length;
    const side = Math.sign(this.lean) || 1;
    const count = Math.min(n - 1, 14);
    this.peak = this.blocks.slice();
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
    this.nonna.say('topple', { mood: 'shocked', force: true });
    buzz([80, 50, 160]);
  }

  finish() {
    this.state = 'over';
    this.overT = 0;
    this.hang = null; // the crane pulls its rope up out of the way
    this.newBest = this.score > (this.save.best || 0);
    this.keepBest();
    this.summary = {
      floors: this.reached,
      score: this.score,
      best: this.save.best,
      bestCombo: this.bestCombo,
      newBest: this.newBest,
      newRecord: this.recordBroken,
      toppled: this.reason === 'topple',
      blocks: (this.peak || this.blocks).map((b) => ({ ox: b.ox, style: b.style, gold: !!b.gold })),
      owned: { ...this.owned },
      date: new Date(),
    };
    this.onFinish?.(this.summary);
    this.sound.music(false);
    this.sound.gameOver();
    this.nonna.say(this.newBest ? 'overBest' : 'over', { mood: this.newBest ? 'ecstatic' : 'worried', force: true });
  }

  updateCamera(dt) {
    this.cam.y += (this.camTargetY() - this.cam.y) * (1 - Math.exp(-dt * 6));
    const top = this.blocks[this.blocks.length - 1];
    this.cam.x += (top.ox - this.cam.x) * (1 - Math.exp(-dt * 2));
  }

  // --- fallen floors and the bulldozer ---------------------------------------

  groundVisible() {
    return -this.cam.y < this.viewH + 10;
  }

  // A falling block hits the street: it drops flat (upright, on its side or
  // upside down), clear of the tower's ground floor.
  settle(d) {
    d.settled = true;
    const k = Math.round(d.rot / (Math.PI / 2));
    const onSide = Math.abs(k) % 2 === 1;
    const w = onSide ? BH / 2 : BW / 2;
    const h = onSide ? BW / 2 : BH / 2;
    const x = this.restingX(d.x, w);
    if (Math.abs(x - this.cam.x) > this.viewW / 2 + 60) return; // landed out of sight
    // It lands where it fell, then skids to where it can rest.
    this.rubble.push({
      x: d.x, slide: x, y: -h, w, h, rot: d.rot, target: (k * Math.PI) / 2, sprite: d.sprite, scrape: 0,
    });
    if (this.rubble.length > 14) this.rubble.shift();
    this.crewIn = Math.max(this.crewIn, 1.4);
    if (this.groundVisible()) {
      this.dust(x, 0);
      this.shake = Math.max(this.shake, 1.5);
      this.sound.thud();
    }
  }

  // Where a piece landing at x can rest: clear of the ground floor, and never
  // covering an older piece so much that less than REVEAL px of it shows.
  restingX(x, w) {
    const REVEAL = 12;
    const baseX = this.blocks[0].ox;
    const clear = BW / 2 + w + 1;
    const blocked = (nx) => Math.abs(nx - baseX) < clear;
    if (blocked(x)) x = baseX + (Math.sign(x - baseX) || 1) * clear;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const r of this.rubble) {
        const rx = r.slide ?? r.x;
        const pl = x - w;
        const pr = x + w;
        if (pr <= rx - r.w || pl >= rx + r.w) continue;
        if (Math.max(0, pl - (rx - r.w)) + Math.max(0, rx + r.w - pr) >= REVEAL) continue;
        const right = rx - r.w + REVEAL - pl; // slide right until REVEAL px show on its left
        const left = pr - (rx + r.w - REVEAL); // or left until they show on its right
        const options = right <= left ? [x + right, x - left] : [x - left, x + right];
        const nx = options.find((o) => !blocked(o));
        if (nx === undefined) continue;
        x = nx;
        moved = true;
      }
      if (!moved) break;
    }
    return x;
  }

  // Once things settle and the street is on screen, the dozer drives across
  // and shoves every piece of rubble off the far edge.
  updateCrew(dt) {
    for (const r of this.rubble) {
      r.rot += (r.target - r.rot) * Math.min(1, dt * 18);
      r.scrape = Math.max(0, r.scrape - dt * 4);
      if (r.slide != null) {
        r.x += (r.slide - r.x) * Math.min(1, dt * 9);
        if (Math.abs(r.slide - r.x) < 0.3) {
          r.x = r.slide;
          r.slide = null;
        }
      }
    }
    const d = this.dozer;
    if (!d) {
      if (this.rubble.length && (this.crewIn -= dt) <= 0 && this.groundVisible()) this.callDozer();
      return;
    }
    d.t += dt;
    // a heavier load slows the dozer down a little
    d.x += d.dir * CFG.dozerSpeed * Math.max(0.55, 1 - 0.12 * d.load) * dt;
    const front = this.push(d);

    if (d.load && Math.random() < dt * 12) {
      this.particle({
        x: front - d.dir * 4,
        y: -2,
        vx: -d.dir * (10 + Math.random() * 20),
        vy: -10 - Math.random() * 15,
        life: 0.4,
        color: '#9a8fb8',
      });
    }

    const edge = this.cam.x + d.dir * (this.viewW / 2 + 30);
    this.rubble = this.rubble.filter((r) => d.dir * (r.x - d.dir * r.w - edge) < 0);
    if ((d.puff -= dt) <= 0) {
      d.puff = 0.14;
      this.particle({ x: d.x + d.dir * 3, y: -20, vx: -d.dir * 8, vy: -18, g: -6, life: 0.7, color: '#6c6488', size: 2 });
      if (this.groundVisible() && !this.paused) this.sound.chug();
    }
    if (d.dir * (d.x - d.dir * DOZER_BACK - edge) > 0) {
      this.dozer = null;
      this.crewIn = 1;
    }
  }

  // Moves the rubble ahead of the blade. Pieces that already touch or overlap
  // travel together and keep their spacing; a gap only closes as fast as the
  // piece behind it moves, so nothing jumps into line. Returns the front of the load.
  push(d) {
    const dir = d.dir;
    // positions measured along the direction of travel
    const back = (r) => dir * r.x - r.w;
    const front = (r) => dir * r.x + r.w;
    const blade = dir * d.x + DOZER_REACH;
    const ahead = this.rubble.filter((r) => front(r) > dir * d.x).sort((a, b) => back(a) - back(b));
    const moved = [];
    let lead = blade;
    d.load = 0;
    for (const r of ahead) {
      const oldBack = back(r);
      const oldFront = front(r);
      let shift = Math.max(0, blade - oldBack);
      for (const [qFront, qShift] of moved) {
        if (qFront >= oldBack - 0.5) shift = Math.max(shift, qShift); // touching: carried along
        else shift = Math.max(shift, qFront + qShift - oldBack); // gap closing: pushed once they meet
      }
      if (shift > 0) {
        r.x += dir * shift;
        r.slide = null;
        r.scrape = 1;
        d.load++;
        lead = Math.max(lead, front(r));
      }
      moved.push([oldFront, shift]);
    }
    return dir * lead;
  }

  // The dozer comes in from the side with less rubble and pushes toward the side with more.
  callDozer() {
    const lean = this.rubble.reduce((s, r) => s + Math.sign(r.x - this.cam.x), 0);
    const dir = lean >= 0 ? 1 : -1;
    // start off screen, and behind every piece so they're all ahead of the blade
    const rear = dir > 0 ? Math.min(...this.rubble.map((r) => r.x - r.w)) : Math.max(...this.rubble.map((r) => r.x + r.w));
    const offscreen = this.cam.x - dir * (this.viewW / 2 + 30);
    const x = dir > 0 ? Math.min(offscreen, rear - DOZER_REACH - 2) : Math.max(offscreen, rear + DOZER_REACH + 2);
    this.dozer = { x, dir, t: 0, puff: 0, load: 0 };
    this.nonna.say('dozer', { chance: 0.6 });
  }

  // --- effects -------------------------------------------------------------

  popup(text, x, y, { color, scale = 1, life = 1, wave = 0 }) {
    this.popups.push({ text, x, y, color, scale, life, wave, t: 0 });
  }

  particle(p) {
    this.particles.push({ g: 60, size: 1, ...p, max: p.life });
  }

  dust(x, y) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        this.particle({
          x: x + side * (BW / 2 - 2),
          y: y - 1,
          vx: side * (15 + Math.random() * 45),
          vy: -10 - Math.random() * 25,
          life: 0.4 + Math.random() * 0.3,
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
      this.particle({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        g: 40,
        life: 0.5 + Math.random() * 0.4,
        color: Math.random() < 0.5 ? PAL.gold : PAL.cream,
        kind: 'spark',
      });
    }
  }

  coins(x, y) {
    for (let i = 0; i < 14; i++) {
      this.particle({
        x: x + (Math.random() - 0.5) * BW,
        y,
        vx: (Math.random() - 0.5) * 90,
        vy: -80 - Math.random() * 80,
        g: 300,
        life: 0.9 + Math.random() * 0.4,
        color: PAL.gold,
        kind: 'coin',
      });
    }
  }

  confetti() {
    const n = this.blocks.length;
    for (let i = 0; i < 60; i++) {
      this.particle({
        x: this.cam.x + (Math.random() - 0.5) * 200,
        y: -n * BH - 120 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 30,
        vy: 10 + Math.random() * 30,
        g: 12,
        life: 2 + Math.random() * 1.5,
        color: CONFETTI[i % CONFETTI.length],
        kind: 'confetti',
        seed: Math.random() * 6,
      });
    }
  }

  updateFx(dt) {
    for (const d of this.debris) {
      d.vy += CFG.gravity * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      // lowest point of the spinning block; once it reaches the street it stays there
      const low = (BW / 2) * Math.abs(Math.sin(d.rot)) + (BH / 2) * Math.abs(Math.cos(d.rot));
      if (d.vy > 0 && d.y + low >= 0) this.settle(d);
    }
    this.debris = this.debris.filter((d) => !d.settled && d.y < this.cam.y + 1200);

    for (const p of this.particles) {
      p.vy += p.g * dt;
      if (p.kind === 'confetti') p.vx = Math.sin(this.time * 4 + p.seed) * 25;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.life);

    for (let i = Math.max(0, this.blocks.length - 2); i < this.blocks.length; i++) {
      const b = this.blocks[i];
      b.squash = Math.max(0, b.squash - dt * 8);
    }

    this.shake = Math.max(0, this.shake - dt * 12);
    this.flash = Math.max(0, this.flash - dt * 1.5);
    this.dip = Math.max(0, this.dip - dt * 14);

    const diff = this.score - this.shownScore;
    if (diff > 0) this.shownScore += Math.min(diff, Math.max(1, Math.ceil(diff * dt * 10)));
  }
}
