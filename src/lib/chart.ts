export const LANE_COUNT = 5;

export interface Note {
  /** Song time in seconds. */
  t: number;
  /** 0 … LANE_COUNT - 1 */
  lane: number;
}

export interface Chart {
  id: string;
  videoId: string;
  title: string;
  notes: Note[];
  updatedAt: number;
}

const CHARTS_KEY = "clonemx.charts.v1";
const BEST_KEY = "clonemx.best.v1";
const FILE_FORMAT = "clonemx-chart";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked; the chart can still be exported
  }
}

export function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => a.t - b.t || a.lane - b.lane);
}

export function newChart(videoId: string, title: string): Chart {
  return { id: crypto.randomUUID(), videoId, title, notes: [], updatedAt: Date.now() };
}

export function listCharts(): Chart[] {
  return read<Chart[]>(CHARTS_KEY, []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveChart(chart: Chart): Chart {
  const saved = { ...chart, notes: sortNotes(chart.notes), updatedAt: Date.now() };
  const others = read<Chart[]>(CHARTS_KEY, []).filter((c) => c.id !== chart.id);
  write(CHARTS_KEY, [saved, ...others]);
  return saved;
}

export function deleteChart(id: string) {
  write(
    CHARTS_KEY,
    read<Chart[]>(CHARTS_KEY, []).filter((c) => c.id !== id),
  );
  const best = read<Record<string, number>>(BEST_KEY, {});
  delete best[id];
  write(BEST_KEY, best);
}

export function getBest(id: string): number | undefined {
  return read<Record<string, number>>(BEST_KEY, {})[id];
}

/** Stores the score if it beats the previous best; returns whether it did. */
export function recordScore(id: string, score: number) {
  const best = read<Record<string, number>>(BEST_KEY, {});
  if (best[id] !== undefined && best[id] >= score) return false;
  best[id] = score;
  write(BEST_KEY, best);
  return true;
}

export function downloadChart(chart: Chart) {
  const data = {
    format: FILE_FORMAT,
    version: 1,
    videoId: chart.videoId,
    title: chart.title,
    notes: chart.notes.map((n) => ({ t: Math.round(n.t * 1000) / 1000, lane: n.lane })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(chart.title) || chart.videoId}.clonemx.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parses an exported chart file into a new chart. Throws with a readable message. */
export function parseChartFile(text: string): Chart {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es JSON válido.");
  }
  const d = data as Record<string, unknown>;
  if (d?.format !== FILE_FORMAT) throw new Error("El archivo no es un chart de CloneMX.");
  if (typeof d.videoId !== "string" || !/^[\w-]{11}$/.test(d.videoId)) {
    throw new Error("El chart no tiene un video válido.");
  }
  if (!Array.isArray(d.notes)) throw new Error("El chart no tiene notas.");
  const notes = d.notes.filter(
    (n): n is Note =>
      typeof n?.t === "number" &&
      n.t >= 0 &&
      Number.isInteger(n?.lane) &&
      n.lane >= 0 &&
      n.lane < LANE_COUNT,
  );
  const title = typeof d.title === "string" && d.title.trim() ? d.title.trim() : "Sin título";
  return { ...newChart(d.videoId, title), notes: sortNotes(notes) };
}

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
