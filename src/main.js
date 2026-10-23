import { GAME_W, GAME_H } from './config.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { loadSave, writeSave } from './storage.js';

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
}

function toggleMute() {
  sound.setMuted(!sound.muted);
  save.muted = sound.muted;
  writeSave(save);
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * renderer.W;
  const y = ((e.clientY - r.top) / r.height) * renderer.H;
  if (renderer.hitMute(x, y)) toggleMute();
  else game.press();
});

const DROP_KEYS = new Set(['Space', 'Enter', 'ArrowDown', 'KeyS']);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    sound.unlock();
    toggleMute();
  } else if (DROP_KEYS.has(e.code)) {
    e.preventDefault();
    if (e.repeat) return;
    sound.unlock();
    game.press();
  }
});

// Older iOS Safari only unlocks audio on touchend, not pointerdown.
window.addEventListener('touchend', () => sound.unlock(), { passive: true });
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => sound.pause(document.hidden));
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
