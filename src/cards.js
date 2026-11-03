// Blessings (benedizioni): every few floors Nonna deals three cards and you keep one.
import { CFG } from './config.js';

// rarity: 0 common, 1 uncommon, 2 rare. max: how many copies a run can hold.
// glyph: drawn as text instead of an icon.
export const CARDS = [
  { id: 'espresso', name: 'ESPRESSO', rarity: 0, max: 3, text: ['A COFFEE FOR THE CRANE:', 'IT SWINGS 12% SLOWER'] },
  { id: 'ancora', name: 'ANCORA', rarity: 0, max: 2, text: ['AN ANCHOR: THE TOWER', 'STOPS SWAYING 2X FASTER'] },
  { id: 'gatto', name: 'GATTO', rarity: 0, max: 9, text: ['A CAT MOVES IN AND', 'BRINGS AN EXTRA LIFE'] },
  { id: 'cemento', name: 'CEMENTO', rarity: 0, max: 2, text: ['CEMENT: THE TOWER CAN', 'LEAN 30% FURTHER'] },
  { id: 'calamita', name: 'CALAMITA', rarity: 1, max: 2, text: ['A MAGNET: THE PERFECT', 'ZONE GROWS BY 2 PIXELS'] },
  { id: 'pazienza', name: 'PAZIENZA', rarity: 1, max: 1, text: ['PATIENCE: GOOD DROPS', 'NO LONGER BREAK COMBOS'] },
  { id: 'piuma', name: 'PIUMA', rarity: 1, max: 1, text: ['A FEATHER: BLOCKS FALL', 'STRAIGHT DOWN'] },
  { id: 'doppio', name: 'DOPPIO', rarity: 1, max: 3, glyph: 'X2', text: ['A DOUBLE SHOT:', 'PERFECT DROPS SCORE X2'] },
  { id: 'azzardo', name: 'AZZARDO', rarity: 2, max: 2, text: ['A GAMBLE: THE CRANE IS', '20% FASTER, POINTS X2'] },
];

export const RARITY = [
  { name: 'COMUNE', color: '#2a5f9e', light: '#3fa7ff' },
  { name: 'NON COMUNE', color: '#2f7d5b', light: '#4bc292' },
  { name: 'RARA', color: '#9e2f3a', light: '#ff5f55' },
];
const WEIGHT = [6, 3, 1.5];

// Gameplay numbers after applying every owned blessing.
export function computeMods(owned) {
  const n = (id) => owned[id] || 0;
  return {
    swing: 0.88 ** n('espresso') * 1.2 ** n('azzardo'),
    damping: 2 ** n('ancora'),
    toppleAt: CFG.toppleAt * (1 + 0.3 * n('cemento')),
    perfectTol: CFG.perfectTol + 2 * n('calamita'),
    keepCombo: n('pazienza') > 0,
    momentum: n('piuma') ? 0 : CFG.dropMomentum,
    perfectMult: 2 ** n('doppio'),
    pointMult: 2 ** n('azzardo'),
  };
}

// Up to three different cards, weighted by rarity, skipping maxed-out ones.
export function dealCards(owned, lives, count = 3) {
  const pool = CARDS.filter((c) => (owned[c.id] || 0) < c.max && (c.id !== 'gatto' || lives < CFG.maxLives));
  const hand = [];
  while (hand.length < count && pool.length) {
    let roll = Math.random() * pool.reduce((s, c) => s + WEIGHT[c.rarity], 0);
    let i = pool.findIndex((c) => (roll -= WEIGHT[c.rarity]) < 0);
    if (i < 0) i = pool.length - 1;
    hand.push(pool.splice(i, 1)[0]);
  }
  return hand;
}
