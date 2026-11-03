// Nonna watches from the corner: her face reacts to every drop and now and then
// she has something to say about it.

const LINES = {
  title: ['CIAO!', 'CIAO, TESORO!'],
  start: ['FORZA!', 'ANDIAMO!', 'VAI, TESORO!'],
  perfect: ['SI!', 'BENE!', 'COSI!', 'BRAVO!'],
  good: ['NON MALE!', 'QUASI!', 'DAI!'],
  ok: ['PIANO PIANO...', 'ATTENTO!', 'MAH...', 'STORTO!'],
  miss: ['MAMMA MIA!', 'OH NO!', 'UFFA!', 'AIUTO!'],
  wobbly: ['ATTENZIONE!', 'OCCHIO!', 'TIENI DURO!'],
  gold: ['ORO!', 'CHE LUSSO!'],
  milestone: ['CHE ALTEZZA!', 'FINO AL CIELO!', 'CHE VISTA!'],
  record: ['RECORD!', 'CHE BRAVO!'],
  pick: ['UN REGALO!', 'SCEGLI BENE!'],
  picked: ['BUONA SCELTA!', 'PERFETTO!'],
  wind: ['CHE VENTO!', 'TIRA VENTO!'],
  pigeon: ['VIA, PICCIONE!', 'SCIO!'],
  ufo: ['UN UFO?!', 'MAMMA MIA!'],
  dozer: ['GRAZIE, MARIO!', 'PULIZIA!'],
  topple: ['MAMMA MIA!!', 'NOOO!'],
  over: ['RIPROVA!', 'ANCORA UNA!', 'CORAGGIO!'],
  overBest: ['CHE BRAVO!', 'BRAVISSIMO!'],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Each mood is a target for a handful of facial features. The face eases toward
// it feature by feature, so expressions blend instead of snapping.
//   smile: -1 frown .. 0 flat .. 1 smile .. 1.5 laugh
//   eyes:   0 closed .. 1 open .. 1.3 wide      joy: >0.5 shows happy ^ ^ eyes
//   brow:  -1 worried .. 0 relaxed .. 1 raised  open: mouth open in surprise
const MOODS = {
  neutral: { smile: 0.45, eyes: 1, brow: 0, open: 0, joy: 0, blush: 0 },
  happy: { smile: 1, eyes: 1, brow: 0.6, open: 0, joy: 0, blush: 0.2 },
  ecstatic: { smile: 1.5, eyes: 1, brow: 0.7, open: 0, joy: 1, blush: 1 },
  worried: { smile: -0.5, eyes: 1, brow: -1, open: 0, joy: 0, blush: 0 },
  shocked: { smile: 0, eyes: 1.3, brow: 1, open: 1, joy: 0, blush: 0 },
  sad: { smile: -1, eyes: 0.6, brow: -1, open: 0, joy: 0, blush: 0 },
};

export class Nonna {
  constructor(sound) {
    this.sound = sound;
    this.mood = 'neutral';
    this.moodT = 0;
    this.face0 = { ...MOODS.neutral };
    this.text = '';
    this.textT = 0;
    this.quiet = 0; // cooldown so she doesn't talk over herself
    this.talkT = 0; // her mouth moves while the babble plays
    this.blinkT = -1; // time into the current blink, or -1
    this.blinkIn = 2.5;
    this.look = 0;
    this.lookIn = 3;
    this.time = 0;
    this.bob = 0;
  }

  // Reacts to an event. chance < 1 makes her talk only some of the time;
  // force always speaks, even over a line that's still showing.
  say(event, { mood, chance = 1, force = false } = {}) {
    if (mood) this.feel(mood);
    if (!force && (this.quiet > 0 || Math.random() > chance)) return;
    this.text = pick(LINES[event]);
    this.textT = 1.7;
    this.quiet = 1.2;
    this.bob = 1;
    this.look = 0; // she looks at you while she talks
    const blips = Math.min(7, Math.max(2, Math.ceil(this.text.length / 2)));
    this.talkT = blips * 0.06 + 0.08;
    this.sound.babble(this.text.length);
  }

  feel(mood, seconds = 1.8) {
    this.mood = mood;
    this.moodT = seconds;
  }

  update(dt, danger) {
    this.time += dt;
    this.textT = Math.max(0, this.textT - dt);
    this.talkT = Math.max(0, this.talkT - dt);
    this.quiet = Math.max(0, this.quiet - dt);
    this.bob = Math.max(0, this.bob - dt * 4);
    this.moodT -= dt;
    if (this.moodT <= 0) this.mood = danger > 0.7 ? 'worried' : 'neutral';

    const target = MOODS[this.mood] || MOODS.neutral;
    const k = 1 - Math.exp(-dt * 7);
    for (const key in target) this.face0[key] += (target[key] - this.face0[key]) * k;

    // Blinks: half-closed, closed, half-closed again.
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.2) this.blinkT = -1;
    } else if ((this.blinkIn -= dt) <= 0) {
      this.blinkT = 0;
      this.blinkIn = 2 + Math.random() * 3.5;
    }
    // Now and then she glances to one side, then back.
    if ((this.lookIn -= dt) <= 0) {
      this.look = this.look === 0 && this.talkT <= 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      this.lookIn = this.look ? 0.6 + Math.random() * 0.8 : 2.5 + Math.random() * 4;
    }
  }

  // The current face as sprite parts (see nonnaFace in art.js).
  get face() {
    const f = this.face0;
    let eyes;
    if (this.blinkT >= 0 && f.joy < 0.5) eyes = this.blinkT > 0.06 && this.blinkT < 0.14 ? 'closed' : 'half';
    else if (f.joy > 0.5) eyes = 'happy';
    else if (f.eyes < 0.35) eyes = 'closed';
    else if (f.eyes < 0.75) eyes = 'half';
    else if (f.eyes > 1.15) eyes = 'wide';
    else eyes = 'open';

    const brows = f.brow > 0.45 ? 'raised' : f.brow < -0.45 ? 'worried' : 'relaxed';

    let mouth;
    if (f.open > 0.7) mouth = 'o2';
    else if (f.open > 0.35) mouth = 'o1';
    else if (f.smile >= 1.25) mouth = 'laugh';
    else if (f.smile >= 0.75) mouth = 'smile2';
    else if (f.smile >= 0.25) mouth = 'smile1';
    else if (f.smile > -0.25) mouth = 'flat';
    else if (f.smile > -0.75) mouth = 'frown1';
    else mouth = 'frown2';
    if (this.talkT > 0 && Math.floor(this.talkT / 0.07) % 2 === 0) {
      mouth = mouth === 'laugh' || mouth === 'smile2' ? 'laugh' : mouth === 'o2' ? 'o1' : 'talk';
    }

    const look = eyes === 'open' || eyes === 'wide' ? this.look : 0;
    return { eyes, look, brows, mouth, blush: f.blush > 0.5 };
  }
}
