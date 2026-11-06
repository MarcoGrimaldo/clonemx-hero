# CloneMX Hero

A browser rhythm game played on YouTube songs. Paste a YouTube link, record a chart by tapping along, then play it.

```bash
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # type check + production build
```

## How it works

- **Audio never leaves YouTube.** Songs play in the official YouTube IFrame player. The app only stores charts: note times and lanes, tied to a video id.
- **Sync.** `getCurrentTime()` updates in coarse steps, so `SongClock` (`src/lib/clock.ts`) extrapolates song time with `performance.now()` and nudges itself toward each new reading. Key presses are judged at their `event.timeStamp`, not when the handler runs.
- **Calibration.** A per-player offset (ms) accounts for audio output and input latency and shifts both drawing and judging. The calibration screen measures it with a Web Audio metronome.
- **Charts** are recorded live in the editor: play the video and press the lane keys on the beat. They are kept in `localStorage` and can be exported or imported as `.clonemx.json` files.
- **Scoring.** Windows of ±45 / ±90 / ±140 ms; the multiplier grows every 10 notes of combo, up to x4.

Some videos (often official music videos) have embedding turned off by their owner and cannot be played. Lyric videos, official audio uploads or live versions usually work.

## Layout

```
src/
  App.tsx                 screen switching: home, recorder, play, calibrate
  components/             the screens
  hooks/useYouTubePlayer  mounts the player, exposes it with a SongClock
  hooks/useFrame          requestAnimationFrame loop
  lib/clock.ts            smoothed song time
  lib/game.ts             hit detection and scoring
  lib/highway.ts          canvas renderer for the note highway
  lib/chart.ts            chart model, storage, import/export
  lib/settings.ts         keys and offset
  lib/youtube.ts          API loader, URL parsing, error messages
```

## Next steps

- Backend for shared charts, accounts and leaderboards (e.g. Supabase)
- Sustain notes, chords and difficulty levels
- Importing Clone Hero `.chart` / `.mid` files
- Touch controls for phones
