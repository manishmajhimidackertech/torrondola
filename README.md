# Torrondola

*La torretta che dondola*: the little swinging tower.

A pixel-art tower stacker that runs as a Progressive Web App. A crane swings each floor of the building on a rope. You drop it and try to land it straight on top of the floor below. Off-centre landings make the tower sway, and if the top swings too far the tower comes down (*crollo!*). Perfect landings score combo bonuses and calm the sway.

The name blends *torre* (tower) and *dondola* (it swings); *-ola* is also an Italian diminutive.

## How to play

- **Tap**, **Space**, **Enter** or **↓**: drop the block
- **M**, or the speaker icon in the bottom-left corner: mute

| Landing | Offset from the block below | Effect |
|---|---|---|
| **Perfect** | ≤ 3 px | Snaps dead centre, `25 × combo` points, sway cut by 60% |
| **Good** | ≤ 8 px | 15 points, combo resets |
| **OK** | ≤ 24 px (half a block) | 10 points, the tower gets a shove |
| **Miss** | more than half a block | The block tips off and you lose a life |

You start with 3 lives. The game ends when you run out of lives or when the tower topples. The **SWAY** meter shows how close the tower is to toppling. Every 8 floors the crane swings wider and faster, and every 10 floors the building changes colour. The sky also changes as you climb, from dusk to night to space.

## Running it

There's no build step and no dependencies. It's plain ES modules served as static files.

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Service workers (offline mode and installing the app) only run over HTTPS or on `localhost`. To try it on a phone, deploy it (see below) or use any HTTPS tunnel.

## Deploying (GitHub Pages)

`.github/workflows/pages.yml` publishes the repo root to GitHub Pages on every push to `main`. Enable it once under **Settings → Pages → Build and deployment → Source: GitHub Actions**. All paths are relative, so it works under `https://<user>.github.io/<repo>/`.

After deploying, open the site on a phone and choose **Add to Home Screen** or **Install**. From then on it works offline.

## Project layout

```
index.html              page shell, PWA meta tags
manifest.webmanifest    install metadata
sw.js                   service worker: precache + stale-while-revalidate
src/config.js           every tuning number (physics, difficulty, scoring)
src/game.js             rules and simulation, no drawing
src/render.js           low-res canvas renderer, swirl background, HUD, CRT pass
src/sprites.js          procedural pixel art (floors, hook, city, clouds, icons)
src/font.js             5x7 bitmap font
src/audio.js            WebAudio chiptune SFX and a looping tarantella
src/storage.js          best score / mute setting in localStorage
tools/make-icons.mjs    draws the app icon and writes the PNGs in icons/
```

The game renders into a small virtual canvas, about 180 px wide on phones. It then scales up by the largest whole number that fits the screen, so pixels always stay square and sharp.

- To change difficulty, edit `src/config.js`.
- After changing the icon art, run `node tools/make-icons.mjs`.
- If you add or rename files, list them in `ASSETS` in `sw.js` and bump `VERSION`.

For debugging, the running game is available as `window.torrondola` in the browser console.
