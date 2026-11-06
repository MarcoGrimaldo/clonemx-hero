import type { Note } from "./chart";

export type Judgment = "perfect" | "great" | "good" | "miss";

export const JUDGMENTS: Record<Judgment, { label: string; window: number; points: number; color: string }> = {
  perfect: { label: "¡Perfecto!", window: 0.045, points: 100, color: "#ffe066" },
  great: { label: "¡Bien!", window: 0.09, points: 70, color: "#7ee787" },
  good: { label: "Ok", window: 0.14, points: 40, color: "#79c0ff" },
  miss: { label: "Fallo", window: 0, points: 0, color: "#ff6b6b" },
};

/** Widest window in which a press still counts for a note, in seconds. */
export const HIT_WINDOW = JUDGMENTS.good.window;

export interface GameNote extends Note {
  result?: Judgment;
}

export class Game {
  readonly notes: GameNote[];
  score = 0;
  combo = 0;
  maxCombo = 0;
  counts: Record<Judgment, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
  /** Every note before this index is judged or out of reach. */
  private cursor = 0;

  constructor(notes: Note[]) {
    this.notes = [...notes].sort((a, b) => a.t - b.t).map((n) => ({ t: n.t, lane: n.lane }));
  }

  get multiplier() {
    return Math.min(4, 1 + Math.floor(this.combo / 10));
  }

  /** Share of the maximum points per note, ignoring the multiplier. 0 … 1 */
  get accuracy() {
    const judged = this.counts.perfect + this.counts.great + this.counts.good + this.counts.miss;
    if (judged === 0) return 1;
    const earned =
      this.counts.perfect * JUDGMENTS.perfect.points +
      this.counts.great * JUDGMENTS.great.points +
      this.counts.good * JUDGMENTS.good.points;
    return earned / (judged * JUDGMENTS.perfect.points);
  }

  /** A press on `lane` at song time `t`; hits the earliest open note in reach. */
  press(lane: number, t: number): Judgment | null {
    for (let i = this.cursor; i < this.notes.length; i++) {
      const note = this.notes[i];
      if (note.t - t > HIT_WINDOW) break;
      if (note.result || note.lane !== lane) continue;
      const error = Math.abs(note.t - t);
      if (error > HIT_WINDOW) continue;
      const judgment: Judgment =
        error <= JUDGMENTS.perfect.window ? "perfect" : error <= JUDGMENTS.great.window ? "great" : "good";
      note.result = judgment;
      this.counts[judgment]++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += JUDGMENTS[judgment].points * this.multiplier;
      return judgment;
    }
    return null;
  }

  /** Marks notes that slipped past the window as missed; returns them. */
  update(t: number): GameNote[] {
    const missed: GameNote[] = [];
    while (this.cursor < this.notes.length && this.notes[this.cursor].t < t - HIT_WINDOW) {
      const note = this.notes[this.cursor];
      if (!note.result) {
        note.result = "miss";
        this.counts.miss++;
        this.combo = 0;
        missed.push(note);
      }
      this.cursor++;
    }
    return missed;
  }

  finish() {
    this.update(Number.POSITIVE_INFINITY);
  }
}
