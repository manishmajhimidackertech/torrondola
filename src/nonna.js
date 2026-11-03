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
  topple: ['MAMMA MIA!!', 'NOOO!'],
  over: ['RIPROVA!', 'ANCORA UNA!', 'CORAGGIO!'],
  overBest: ['CHE BRAVO!', 'BRAVISSIMO!'],
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export class Nonna {
  constructor(sound) {
    this.sound = sound;
    this.mood = 'neutral';
    this.moodT = 0;
    this.text = '';
    this.textT = 0;
    this.quiet = 0; // cooldown so she doesn't talk over herself
    this.blink = 0;
    this.blinkIn = 3;
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
    this.sound.babble(this.text.length);
  }

  feel(mood, seconds = 1.6) {
    this.mood = mood;
    this.moodT = seconds;
  }

  update(dt, danger) {
    this.textT = Math.max(0, this.textT - dt);
    this.quiet = Math.max(0, this.quiet - dt);
    this.bob = Math.max(0, this.bob - dt * 4);
    this.moodT -= dt;
    if (this.moodT <= 0) this.mood = danger > 0.7 ? 'worried' : 'neutral';
    this.blink = Math.max(0, this.blink - dt);
    if ((this.blinkIn -= dt) <= 0) {
      this.blink = 0.12;
      this.blinkIn = 2 + Math.random() * 3;
    }
  }

  get face() {
    if (this.blink > 0 && (this.mood === 'neutral' || this.mood === 'worried')) return 'blink';
    return this.mood;
  }
}
