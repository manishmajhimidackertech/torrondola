const KEY = 'torrondola-save-v1';

export function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage blocked (private mode, etc.): the game still runs, best scores just aren't kept.
  }
}
