import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "../hooks/useFrame";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { saveChart, type Chart, type Note } from "../lib/chart";
import { drawHighway } from "../lib/highway";
import { keyLabel, type Settings } from "../lib/settings";

interface Props {
  chart: Chart;
  settings: Settings;
  onSaved: (chart: Chart) => void;
  onPlay: (chart: Chart) => void;
  onExit: () => void;
}

export function Recorder({ chart, settings, onSaved, onPlay, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const notesRef = useRef<Note[]>([...chart.notes]);
  /** Notes in the order they were tapped, for undo. */
  const historyRef = useRef<Note[]>([]);
  const pressedRef = useRef<boolean[]>(settings.keys.map(() => false));
  const [title, setTitle] = useState(chart.title);
  const [count, setCount] = useState(chart.notes.length);
  const [dirty, setDirty] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const offset = settings.offsetMs / 1000;

  const { hostRef, player, clock, error } = useYouTubePlayer(chart.videoId, (state) =>
    setPlaying(state === YT.PlayerState.PLAYING),
  );

  const changed = () => {
    setCount(notesRef.current.length);
    setDirty(true);
  };

  const addNote = (note: Note) => {
    const notes = notesRef.current;
    let i = notes.length;
    while (i > 0 && notes[i - 1].t > note.t) i--;
    notes.splice(i, 0, note);
    historyRef.current.push(note);
    changed();
  };

  const undo = useCallback(() => {
    const note = historyRef.current.pop();
    if (!note) return;
    const i = notesRef.current.indexOf(note);
    if (i >= 0) notesRef.current.splice(i, 1);
    changed();
  }, []);

  const clearFromHere = () => {
    if (!clock) return;
    const t = clock.now() - offset;
    const removed = notesRef.current.filter((n) => n.t >= t).length;
    if (removed === 0 || !confirm(`¿Borrar ${removed} notas desde ${formatTime(t)}?`)) return;
    notesRef.current = notesRef.current.filter((n) => n.t < t);
    historyRef.current = historyRef.current.filter((n) => n.t < t);
    changed();
  };

  const seekBy = useCallback(
    (seconds: number) => {
      if (!player) return;
      player.seekTo(Math.max(0, player.getCurrentTime() + seconds), true);
    },
    [player],
  );

  const togglePlay = useCallback(() => {
    if (!player) return;
    if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  }, [player]);

  const save = () => {
    const saved = saveChart({ ...chart, title: title.trim() || "Sin título", notes: notesRef.current });
    setDirty(false);
    onSaved(saved);
    return saved;
  };

  const leave = () => {
    if (!dirty || confirm("Hay cambios sin guardar. ¿Salir de todos modos?")) onExit();
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) togglePlay();
        return;
      }
      if (e.code === "Backspace") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.preventDefault();
        seekBy(e.code === "ArrowLeft" ? -5 : 5);
        return;
      }
      const lane = settings.keys.indexOf(e.code);
      if (lane < 0) return;
      e.preventDefault();
      if (e.repeat) return;
      pressedRef.current[lane] = true;
      if (!clock || player?.getPlayerState() !== YT.PlayerState.PLAYING) return;
      const t = Math.round((clock.timeAt(e.timeStamp) - offset) * 1000) / 1000;
      addNote({ t: Math.max(0, t), lane });
    };
    const up = (e: KeyboardEvent) => {
      const lane = settings.keys.indexOf(e.code);
      if (lane >= 0) pressedRef.current[lane] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [clock, player, settings.keys, offset, togglePlay, undo, seekBy]);

  useFrame((now) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    clock?.sample(now);
    const t = (clock?.now() ?? 0) - offset;
    drawHighway(canvas, { t, now, notes: notesRef.current, pressed: pressedRef.current });
    // Coarse enough that React re-renders only a few times a second
    const shown = Math.floor(Math.max(0, t) * 4) / 4;
    if (shown !== time) setTime(shown);
  });

  return (
    <div className="stage">
      <aside className="side">
        <button className="link" onClick={leave}>
          ← Menú
        </button>
        <label className="field">
          Título
          <input value={title} onChange={(e) => (setTitle(e.target.value), setDirty(true))} />
        </label>
        <div className="video" ref={hostRef} />
        {error && <p className="error">{error}</p>}

        <p className="status">
          <span className={playing ? "rec on" : "rec"} /> {playing ? "Grabando" : "En pausa"} · {formatTime(time)} ·{" "}
          {count} notas
        </p>

        <div className="row">
          <button className="primary" disabled={!player} onClick={togglePlay}>
            {playing ? "Pausa" : "Grabar"}
          </button>
          <button disabled={!player} onClick={() => seekBy(-5)}>
            −5 s
          </button>
          <button disabled={!player} onClick={() => player?.seekTo(0, true)}>
            Al inicio
          </button>
        </div>
        <div className="row">
          <button onClick={undo}>Deshacer</button>
          <button disabled={!player} onClick={clearFromHere}>
            Borrar desde aquí
          </button>
        </div>
        <div className="row">
          <button className="primary" onClick={save}>
            Guardar
          </button>
          <button disabled={count === 0} onClick={() => onPlay(save())}>
            Guardar y jugar
          </button>
        </div>

        <p className="hint">
          Dale play y toca {settings.keys.map(keyLabel).join(" · ")} al ritmo de la canción. Cada toque es una nota.
          <br />
          Espacio: play/pausa · ← →: 5 s · Retroceso: deshacer
          <br />
          Para corregir una parte: regresa, usa “Borrar desde aquí” y vuelve a grabar.
        </p>
      </aside>

      <div className="highway">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}
