# CLAUDE.md

CloneMX Hero: a browser rhythm game played on YouTube songs, aimed at Mexican music. Players paste a YouTube link, record a chart by tapping along, then play it. Separate from the portfolio (`../mgrim`); it will be linked from there as a project.

## Commands

```bash
pnpm install
pnpm dev      # vite, http://localhost:5173
pnpm build    # tsc + vite build — the only real check; run it before finishing a change
pnpm preview  # serve the production build
```

There are no tests and no ESLint config yet. `pnpm build` type checks with `noUnusedLocals` / `noUnusedParameters`, so unused code fails the build.

## Stack

Vite 5, React 18, TypeScript (strict), plain CSS (`src/styles.css`), Canvas 2D for the highway, the YouTube IFrame Player API (types from `@types/youtube`, global `YT` namespace), Web Audio for calibration. No router, no state library, no backend yet.

## Layout

```
src/
  main.tsx                    entry; StrictMode (effects run twice in dev, the player hook handles it)
  App.tsx                     screen state machine: home | record | play | calibrate; owns settings
  styles.css                  all styles; tokens on :root
  components/
    Home.tsx                  new chart form, chart list (play/edit/export/import/delete), key rebinding
    Recorder.tsx              chart editor: tap lane keys while the video plays to add notes
    PlayScreen.tsx            the game: judging, HUD, results
    Calibrate.tsx             metronome that measures the player's offset; manual slider
  hooks/
    useYouTubePlayer.ts       mounts a YT.Player in hostRef; returns { player, clock, error }
    useFrame.ts               requestAnimationFrame loop with a ref'd callback
  lib/
    clock.ts                  SongClock: smoothed song time
    game.ts                   Game: hit windows, combo, multiplier, score, misses
    highway.ts                drawHighway(): canvas renderer, lane colors, LOOKAHEAD
    chart.ts                  Chart/Note types, localStorage persistence, best scores, import/export
    settings.ts               keys + offsetMs, persistence, reserved keys
    youtube.ts                API loader, parseVideoId(), thumbnails, player error messages
```

## How the timing works

Timing is the core of the game; be careful changing any of this.

- **Song time comes from `SongClock`, never straight from `player.getCurrentTime()`.** The player's time moves in coarse, jittery steps. The clock extrapolates from an anchor with `performance.now()`, nudges itself 10% toward each new reading, and snaps when they differ by more than 150 ms (seeks, buffering). Call `clock.sample(now)` once per frame, then `clock.now()` / `clock.timeAt(perf)`.
- **Presses are judged at `event.timeStamp`** through `clock.timeAt(e.timeStamp)`, not at the moment the handler runs.
- **`settings.offsetMs` is subtracted from song time everywhere:** drawing, judging and recording. Positive means the player hears and presses late (audio output plus input latency; Bluetooth is ~150–250 ms). Any new code that reads song time must apply it the same way, or charts recorded on one setup will feel wrong on another.
- **Hit windows** live in `JUDGMENTS` in `game.ts` (±45 / ±90 / ±140 ms). `Game.press` takes the earliest open note in the lane within reach; `Game.update(t)` marks notes older than the window as missed. Notes are sorted and scanned from a cursor.
- **Restart:** after `seekTo(0)` the clock still reports the old time for a moment, so `PlayScreen` holds judging (`restartingRef`) until the time is back under 1 s. Otherwise a new game instantly marks every earlier note as missed.
- **Frame-rate work stays out of React state.** Notes, pressed keys and popups live in refs and are drawn by `drawHighway` each frame; React state is only for coarse UI (phase, counts, a time readout throttled to 0.25 s).

## YouTube rules (non-negotiable)

- Audio and video play only through the official IFrame player. Never download, extract or proxy YouTube audio, and never store it. The app stores charts only: note times and lanes tied to a `videoId`.
- Keep the player visible (at least 200×200) and don't draw over it. The highway sits beside the video, not on top of it.
- Player errors 101/150 mean the owner turned off embedding; this is common for official music videos. Show the message from `playerErrorMessage()`; there is no workaround.
- The iframe gets `pointer-events: none` so clicks don't move keyboard focus into it. All controls are our own buttons and keys (`controls: 0`, `disablekb: 1`).
- `YT.Player` replaces the element it is given, so the hook mounts it in a child div that React doesn't own and clears the host on cleanup.

## Data

- Everything is in `localStorage` for now: `clonemx.charts.v1`, `clonemx.best.v1`, `clonemx.settings.v1`. Reads and writes go through try/catch helpers; keep it that way. If the shape changes, bump the key's version and migrate.
- Export format: `{ format: "clonemx-chart", version: 1, videoId, title, notes: [{ t, lane }] }`, with `t` in seconds rounded to ms. `parseChartFile()` validates it and gives the import a new id. Keep it backward compatible or bump `version`.
- `LANE_COUNT` is 5. Notes have no duration yet (no sustains or chords as a concept; two notes at the same `t` play as a chord).

## Conventions

- The UI text is in Spanish (es-MX); code, comments and identifiers are in English. Format numbers with `toLocaleString("es-MX")`.
- Keys are matched by `KeyboardEvent.code` (layout-independent). `RESERVED_KEYS` in `settings.ts` (Space, Escape, Backspace, arrows, Enter, Tab) are screen controls and can't be lane keys.
- Keyboard listeners go on `window` inside a `useEffect` with cleanup, and ignore `e.repeat` for lane presses.
- Lane colors are `LANE_COLORS` in `highway.ts` (rosa mexicano, naranja, amarillo, verde, turquesa). The look is original: don't copy art, branding or layouts from Guitar Hero, Clone Hero or other rhythm games.
- Pin dependency versions (as in `package.json`); `esbuild` is allowed to run its build script via `pnpm.onlyBuiltDependencies`.

## Roadmap

Rough order, open to change:

1. Shared charts, accounts and leaderboards. Likely a Supabase backend in the style of `../mgrim-portal` (migrations plus an API); the client would keep `lib/chart.ts` as the seam.
2. Sustain notes, difficulty levels, a note-by-note editor (move/delete individual notes, BPM grid snapping).
3. Importing Clone Hero `.chart` / `.mid` files.
4. Touch controls for phones.
5. Deploy on Vercel (static `dist/`), probably at a subdomain of mgrim.dev.

The name contains "Hero", which is close to the Guitar Hero trademark; it may be renamed before a public launch (the owner has a "Ritmo" banner in `../Ritmo`).
