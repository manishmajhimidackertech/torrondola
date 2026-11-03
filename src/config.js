// Every tunable number lives here. World units are virtual (low-res) pixels.

export const BW = 48; // block width
export const BH = 28; // block height

// The smallest virtual screen the layout is designed for. The real screen is
// scaled up by the largest whole number that still fits, so pixels stay crisp.
export const GAME_W = 180;
export const GAME_H = 300;

export const CFG = {
  lives: 3,
  gravity: 900,
  dropMomentum: 0.4, // share of the crane's swing speed a released block keeps

  // Crane: the rope hangs from a pivot above the top edge of the screen.
  pivotY: -46,
  ropeLen: 104,
  ropeShort: 0, // rope length while no block is attached (hook out of view)
  hookDrop: 13, // hook + cables between the rope end and the block top
  fallGap: 92, // hanging block bottom -> tower top once the tower is tall enough
  groundPad: 34, // until then the ground sits this far above the bottom of the screen
  readyAfter: 0.22, // seconds a new block must hang before it can be dropped
  nextDelay: 0.3, // pause after a landing before the next block arrives

  swingAmp: 0.34, swingAmpStep: 0.03, swingAmpMax: 0.62, // radians
  swingSpeed: 1.8, swingSpeedStep: 0.12, swingSpeedMax: 3.3, // radians / second
  floorsPerLevel: 8,
  floorsPerStyle: 10,

  // Landing quality: horizontal distance from the block below, in pixels.
  perfectTol: 3,
  goodTol: 8,
  perfectPoints: 25, // multiplied by the running combo
  goodPoints: 15,
  okPoints: 10,

  // Tower sway is a damped spring on the tower's lean.
  swayFreq: 2.3,
  swayDamping: 0.045,
  kick: 1.25, // sway speed (px/s at the top) added per pixel of misalignment
  momentumKick: 0.12, // share of the block's sideways speed pushed into the tower
  perfectSteady: 0.4, // a perfect drop keeps only this share of the sway
  toppleAt: 46, // top displacement in pixels that brings the tower down

  maxLives: 5, // the GATTO blessing can raise lives up to this
  goldFrom: 4, // first floor that can arrive as a golden floor
  goldChance: 0.07,
  goldMult: 3, // points for landing a golden floor

  blessingEvery: 10, // floors between blessing card picks

  // Gusts start partway up: telegraphed, then they push falling blocks and the tower.
  windFrom: 25,
  windMax: 80, // sideways acceleration on a falling block, px/s^2
  windTower: 0.3, // share of the push felt by the top of the tower

  pigeonChance: 0.22, // chance a pigeon lands on the roof after a landing
};

// Screen y of the tower top while playing; the camera follows to keep it here.
export const TOWER_TOP_Y = CFG.pivotY + CFG.ropeLen + CFG.hookDrop + BH + CFG.fallGap;
