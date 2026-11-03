import { GAME_W, GAME_H } from './config.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { loadSave, writeSave } from './storage.js';
import { canShareFiles, postcardFile, renderPostcard, sharePostcard } from './postcard.js';

const canvas = document.getElementById('screen');
const save = loadSave();
const sound = new Sound(!!save.muted);
const game = new Game(sound, save);
const renderer = new Renderer(canvas);

// Pick the largest whole-number pixel scale that fits the minimum layout, then
// let the virtual screen grow to fill whatever space is left.
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const devW = Math.round(window.innerWidth * dpr);
  const devH = Math.round(window.innerHeight * dpr);
  const scale = Math.max(1, Math.min(Math.floor(devW / GAME_W), Math.floor(devH / GAME_H)));
  const W = Math.ceil(devW / scale);
  const H = Math.ceil(devH / scale);
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.style.width = `${(W * scale) / dpr}px`;
  canvas.style.height = `${(H * scale) / dpr}px`;
  renderer.resize(W, H, scale);
  game.viewH = H;
  game.viewW = W;
}

function toggleMute() {
  sound.setMuted(!sound.muted);
  save.muted = sound.muted;
  writeSave(save);
}

// --- the postcard ---------------------------------------------------------------

let postcard = null; // { file, text } once the PNG is ready

game.onFinish = (summary) => {
  const card = renderPostcard(summary, renderer.resultCardSize());
  renderer.postcard = card;
  renderer.shareLabel = 'SAVE IMAGE';
  postcard = null;
  const text = `I built a ${summary.floors}-floor palazzo in Torrondola!`;
  postcardFile(card).then((file) => {
    postcard = { file, text };
    if (canShareFiles(file)) renderer.shareLabel = 'SHARE';
  });
};

// --- input ----------------------------------------------------------------------

function virtualPoint(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * renderer.W, ((e.clientY - r.top) / r.height) * renderer.H];
}

let pressedId = null;

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  const id = renderer.hit(...virtualPoint(e));
  pressedId = id;
  if (id === 'share') return; // handled on pointerup, which counts as a user gesture for the share sheet
  if (id === 'mute') toggleMute();
  else if (id === 'pause' || id === 'resume') game.togglePause();
  else if (id === 'restart') game.restart();
  else if (id === 'quit' || id === 'menu') game.quit();
  else if (id?.startsWith('card')) game.tapCard(Number(id.slice(4)));
  else if (!game.paused) game.press(); // while paused only the menu buttons respond
});

canvas.addEventListener('pointerup', (e) => {
  if (pressedId === 'share' && renderer.hit(...virtualPoint(e)) === 'share' && postcard) {
    sharePostcard(postcard.file, `${postcard.text} ${location.href}`);
  }
  pressedId = null;
});

const DROP_KEYS = new Set(['Space', 'Enter', 'ArrowDown', 'KeyS']);
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  sound.unlock();
  if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'Escape' && game.state === 'over') game.quit();
  else if (e.code === 'KeyQ' && game.paused) game.quit();
  else if (e.code === 'KeyR' && game.paused) game.restart();
  else if (e.code === 'KeyP' || e.code === 'Escape') game.togglePause();
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') game.moveFocus(-1);
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') game.moveFocus(1);
  else if (/^Digit[1-3]$/.test(e.code)) game.tapCard(Number(e.code.slice(5)) - 1);
  else if (DROP_KEYS.has(e.code)) {
    e.preventDefault();
    game.press();
  }
});

// Older iOS Safari only unlocks audio on touchend, not pointerdown.
window.addEventListener('touchend', () => sound.unlock(), { passive: true });
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.autoPause();
  sound.pause(document.hidden);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.draw(game, sound);
  requestAnimationFrame(frame);
}

resize();
game.cam.y = game.camTargetY(); // start framed for the real screen size, no swoop
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker not registered:', err));
  });
}

// Handy for poking at the game from the dev console.
window.torrondola = game;
