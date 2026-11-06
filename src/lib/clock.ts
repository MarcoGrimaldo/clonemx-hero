/**
 * Smooth song time on top of the YouTube player.
 *
 * `getCurrentTime()` advances in coarse steps and with jitter, which makes notes
 * stutter if drawn from it directly. The clock instead extrapolates from an
 * anchor with `performance.now()` and nudges that anchor toward each new reading
 * from the player, snapping only when they disagree by a lot (seek, buffering).
 */
export class SongClock {
  private anchorSong = 0;
  private anchorPerf = 0;
  private lastRaw = Number.NaN;
  private running = false;
  private rate = 1;

  constructor(private readonly player: YT.Player) {}

  /** Call once per animation frame. */
  sample(now = performance.now()) {
    const raw = this.player.getCurrentTime() ?? 0;
    const playing = this.player.getPlayerState() === YT.PlayerState.PLAYING;
    this.rate = this.player.getPlaybackRate() || 1;

    if (!playing || !this.running) {
      this.running = playing;
      this.reanchor(raw, now);
      return;
    }
    if (raw === this.lastRaw) return;
    this.lastRaw = raw;
    const error = raw - this.timeAt(now);
    if (Math.abs(error) > 0.15) this.reanchor(raw, now);
    else this.anchorSong += error * 0.1;
  }

  /** Song time, in seconds, at a `performance.now()` / `event.timeStamp` instant. */
  timeAt(perf: number) {
    if (!this.running) return this.anchorSong;
    return this.anchorSong + ((perf - this.anchorPerf) / 1000) * this.rate;
  }

  now() {
    return this.timeAt(performance.now());
  }

  private reanchor(raw: number, now: number) {
    this.anchorSong = raw;
    this.anchorPerf = now;
    this.lastRaw = raw;
  }
}
