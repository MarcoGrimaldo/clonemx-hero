import { useEffect, useRef, useState } from "react";
import type { Settings } from "../lib/settings";

const BEATS = 20;
const INTERVAL = 0.6; // 100 BPM
const LEAD_IN = 1;

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onExit: () => void;
}

/**
 * Plays a metronome and measures how late the player taps on it. That covers
 * audio output and keyboard latency; the slider is there for whatever is left.
 */
export function Calibrate({ settings, onChange, onExit }: Props) {
  const [running, setRunning] = useState(false);
  const [taps, setTaps] = useState<number[]>([]);
  const audioRef = useRef<AudioContext | null>(null);
  const beatsRef = useRef<number[]>([]);

  const start = () => {
    audioRef.current?.close();
    const ctx = new AudioContext();
    audioRef.current = ctx;
    const first = ctx.currentTime + LEAD_IN;
    beatsRef.current = Array.from({ length: BEATS }, (_, i) => first + i * INTERVAL);
    for (const [i, at] of beatsRef.current.entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = i % 4 === 0 ? 1320 : 880;
      gain.gain.setValueAtTime(0.4, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.06);
    }
    setTaps([]);
    setRunning(true);
    window.setTimeout(() => setRunning(false), (LEAD_IN + BEATS * INTERVAL + 0.5) * 1000);
  };

  useEffect(() => {
    if (!running) return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      const ctx = audioRef.current;
      if (!ctx) return;
      // Map the key press onto the audio clock, at the moment the sound is heard.
      const stamp = ctx.getOutputTimestamp?.();
      const heardAt =
        stamp?.contextTime !== undefined && stamp.performanceTime !== undefined
          ? stamp.contextTime + (e.timeStamp - stamp.performanceTime) / 1000
          : ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - (performance.now() - e.timeStamp) / 1000;
      const nearest = beatsRef.current.reduce((a, b) => (Math.abs(b - heardAt) < Math.abs(a - heardAt) ? b : a));
      const diff = heardAt - nearest;
      if (Math.abs(diff) < INTERVAL / 2) setTaps((t) => [...t, diff * 1000]);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [running]);

  useEffect(() => () => void audioRef.current?.close(), []);

  const measured = taps.length >= 6 ? Math.round(median(taps)) : null;

  return (
    <div className="page">
      <button className="link" onClick={onExit}>
        ← Menú
      </button>
      <h1>Calibrar</h1>
      <p>
        Usa los mismos audífonos o bocinas con los que vas a jugar. Cuando empiece el metrónomo, presiona{" "}
        <kbd>Espacio</kbd> en cada clic.
      </p>
      <div className="row">
        <button className="primary" onClick={start} disabled={running}>
          {running ? `Escuchando… ${taps.length} toques` : "Empezar metrónomo"}
        </button>
      </div>

      {!running && measured !== null && (
        <div className="card">
          <p>
            Presionas en promedio <strong>{measured} ms</strong> {measured >= 0 ? "tarde" : "antes"}.
          </p>
          <button className="primary" onClick={() => onChange({ ...settings, offsetMs: measured })}>
            Usar {measured} ms
          </button>
        </div>
      )}
      {!running && taps.length > 0 && measured === null && <p className="error">Muy pocos toques. Inténtalo otra vez.</p>}

      <label className="field">
        Desfase: {settings.offsetMs} ms
        <input
          type="range"
          min={-300}
          max={300}
          step={5}
          value={settings.offsetMs}
          onChange={(e) => onChange({ ...settings, offsetMs: Number(e.target.value) })}
        />
      </label>
      <p className="hint">
        Si al jugar sientes que tienes que tocar antes de que la nota llegue a la línea, sube el desfase. Si tienes que
        tocar después, bájalo. Los audífonos Bluetooth suelen necesitar 150–250 ms.
      </p>
    </div>
  );
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
}
