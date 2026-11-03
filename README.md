# Torrondola

*La torretta che dondola*: the little swinging tower.

A pixel-art tower stacker that runs as a Progressive Web App. A crane swings each floor of an Italian palazzo on a rope. You drop it and try to land it straight on top of the floor below. Off-centre landings make the tower sway, and if the top swings too far the tower comes down (*crollo!*). Perfect landings build combos and calm the sway.

Nonna watches from the corner and has opinions about every drop.

The name blends *torre* (tower) and *dondola* (it swings); *-ola* is also an Italian diminutive.

## How to play

| Input | Action |
|---|---|
| **Tap**, **Space**, **Enter** or **↓** | Drop the block |
| **← / →** or **1 / 2 / 3**, then **Space** | Choose a blessing card |
| **P** / **Esc**, or the pause icon | Pause menu: Resume, Restart (**R**), Main menu (**Q**) |
| **Esc** on the results screen | Back to the main menu |
| **M**, or the speaker icon | Mute |

| Landing | Offset from the block below | Effect |
|---|---|---|
| **Perfect** | ≤ 3 px | Snaps dead centre, `25 × combo` points, sway cut by 60% |
| **Good** | ≤ 8 px | 15 points, combo resets |
| **OK** | ≤ 24 px (half a block) | 10 points, the tower gets a shove |
| **Miss** | more than half a block | The block tips off and you lose a life |

You start with 3 lives. The game ends when you run out of lives or when the tower topples. The **SWAY** meter shows how close the tower is to toppling.

### What happens on the way up

- **Combos.** Each perfect drop in a row gets a bigger callout: *Perfetto, Bravo, Bravissimo, Magnifico, Stupendo, Fantastico, Leggendario.*
- **Blessings (*benedizioni*).** Every 10 floors Nonna deals three cards, Balatro-style, and you keep one. Rarer cards are stronger:

  | Card | Effect |
  |---|---|
  | ESPRESSO | The crane swings 12% slower (stacks ×3) |
  | ANCORA | The tower stops swaying twice as fast (×2) |
  | GATTO | +1 life, up to 5 |
  | CEMENTO | The tower can lean 30% further before toppling (×2) |
  | CALAMITA | The perfect zone grows by 2 px (×2) |
  | PAZIENZA | Good drops no longer break your combo |
  | PIUMA | Blocks fall straight down, ignoring the swing |
  | DOPPIO | Perfect drops score ×2 (×3) |
  | AZZARDO | The crane is 20% faster, but all points ×2 (×2) |

- **Golden floors.** About one floor in fourteen arrives gilded. Landing one is worth ×3 points.
- **Your record.** A pennant marks the height of your best tower. Climb past it for *Nuovo record!* and confetti.
- **Wind.** From floor 25, gusts are announced in the HUD, then push falling blocks and the tower sideways.
- **Fallen floors.** Missed blocks and toppled floors crash into the street and pile up as rubble (a piece landing on another skids aside so the one behind still shows). A little bulldozer then drives in and shoves the whole pile off the screen together.
- **The sky.** It starts as a blue day over the Tuscan countryside (hills, cypresses, olive groves, a hill town with its bell tower) and turns to sunset, night and finally space as you climb. On the way up you pass clouds, a tricolore hot-air balloon, the moon and satellites, and up high, the occasional UFO. Pigeons land on the roof and flee from the next floor.
- **The palazzo.** Floors come with shutters (*persiane*), flower boxes, balconies with geraniums, arched windows and laundry lines. The building changes colour every 10 floors.
- **The results card.** When the run ends you get an airmail-style card with a picture of your tower, your score, floors, best combo and blessings, signed by Nonna. **Share** it (phones) or **Save image** (desktop), **Play again**, or go back to the **Menu**.

### A little Italian

| | |
|---|---|
| *Ciao, tesoro!* | Hi, sweetheart! |
| *Forza! / Andiamo!* | Come on! / Let's go! |
| *Piano piano...* | Easy, slowly... |
| *Attenzione! / Occhio!* | Careful! / Watch out! |
| *Mamma mia!* | Good grief! |
| *Che vento!* | What a wind! |
| *Pulizia! / Grazie, Mario!* | Clean-up! / Thanks, Mario! |
| *Via, piccione!* | Shoo, pigeon! |
| *Crollo!* | Collapse! |
| *Riprova! / Coraggio!* | Try again! / Chin up! |

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
src/config.js           every tuning number (physics, difficulty, scoring, wind)
src/game.js             rules and simulation, no drawing
src/cards.js            blessing cards and what they change
src/nonna.js            Nonna's moods and lines
src/render.js           low-res canvas renderer: sky, tower, HUD, menus, CRT pass
src/postcard.js         the end-of-run results card and sharing it
src/sprites.js          procedural pixel art: floors, city, clouds, UI icons
src/art.js              characters and props: Nonna, pigeons, balloon, moon, card icons
src/draw.js             small shared pixel-drawing helpers
src/font.js             5x7 bitmap font
src/audio.js            WebAudio chiptune SFX and a layered, looping tarantella
src/storage.js          best score / best height / mute setting in localStorage
tools/make-icons.mjs    draws the app icon and writes the PNGs in icons/
```

The game renders into a small virtual canvas, about 180 px wide on phones. It then scales up by the largest whole number that fits the screen, so pixels always stay square and sharp.

- To change difficulty, edit `src/config.js`. Card strengths are in `computeMods` in `src/cards.js`.
- After changing the icon art, run `node tools/make-icons.mjs`.
- If you add or rename files, list them in `ASSETS` in `sw.js` and bump `VERSION`.

For debugging, the running game is available as `window.torrondola` in the browser console.
