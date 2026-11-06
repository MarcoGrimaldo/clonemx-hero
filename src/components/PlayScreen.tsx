import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "../hooks/useFrame";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { getBest, recordScore, type Chart } from "../lib/chart";
import { Game, JUDGMENTS } from "../lib/game";
import { drawHighway, type Popup } from "../lib/highway";
import { keyLabel, type Settings } from "../lib/settings";

type Phase = "ready" | "playing" | "paused" | "done";

interface Result {
  score: number;
  accuracy: number;
  maxCombo: number;
  counts: Game["counts"];
  total: number;
  newBest: boolean;
}

interface Props {
  chart: Chart;
  settings: Settings;
  onEdit: () => void;
  onExit: () => void;
}

export function PlayScreen({ chart, settings, onEdit, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef(new Game(chart.notes));
  const pressedRef = useRef<boolean[]>(settings.keys.map(() => false));
  const popupsRef = useRef<Popup[]>([]);
  /** Set by restart: judging waits until the seek back to 0 has landed. */
  const restartingRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("ready");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [result, setResult] = useState<Result | null>(null);
  const offset = settings.offsetMs / 1000;

  const finish = useCallback(() => {
    if (phaseRef.current === "done") return;
    const game = gameRef.current;
    game.finish();
    setResult({
      score: game.score,
      accuracy: game.accuracy,
      maxCombo: game.maxCombo,
      counts: { ...game.counts },
      total: game.notes.length,
      newBest: recordScore(chart.id, game.score),
    });
    setPhase("done");
  }, [chart.id]);

  const { hostRef, player, clock, error } = useYouTubePlayer(chart.videoId, (state) => {
    if (phaseRef.current === "done") return;
    if (state === YT.PlayerState.PLAYING) setPhase("playing");
    else if (state === YT.PlayerState.PAUSED) setPhase("paused");
    else if (state === YT.PlayerState.ENDED) finish();
  });

  const togglePause = useCallback(() => {
    if (!player) return;
    if (phaseRef.current === "playing") player.pauseVideo();
    else if (phaseRef.current !== "done") player.playVideo();
  }, [player]);

  const restart = useCallback(() => {
    if (!player) return;
    gameRef.current = new Game(chart.notes);
    popupsRef.current = [];
    restartingRef.current = true;
    setResult(null);
    setPhase("playing");
    player.seekTo(0, true);
    player.playVideo();
  }, [player, chart.notes]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) togglePause();
        return;
      }
      const lane = settings.keys.indexOf(e.code);
      if (lane < 0) return;
      e.preventDefault();
      if (e.repeat) return;
      pressedRef.current[lane] = true;
      if (phaseRef.current !== "playing" || restartingRef.current || !clock) return;
      const judgment = gameRef.current.press(lane, clock.timeAt(e.timeStamp) - offset);
      if (judgment) {
        const { label, color } = JUDGMENTS[judgment];
        popupsRef.current.push({ lane, text: label, color, at: performance.now() });
      }
    };
    const up = (e: KeyboardEvent) => {
      const lane = settings.keys.indexOf(e.code);
      if (lane >= 0) pressedRef.current[lane] = false;
    };
    const blur = () => pressedRef.current.fill(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [clock, settings.keys, offset, togglePause]);

  useFrame((now) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    clock?.sample(now);
    const t = (clock?.now() ?? 0) - offset;
    const game = gameRef.current;
    if (restartingRef.current && t < 1) restartingRef.current = false;
    if (phaseRef.current === "playing" && !restartingRef.current) {
      for (const note of game.update(t)) {
        popupsRef.current.push({ lane: note.lane, text: JUDGMENTS.miss.label, color: JUDGMENTS.miss.color, at: now });
      }
    }
    drawHighway(canvas, {
      t,
      now,
      notes: game.notes,
      pressed: pressedRef.current,
      popups: popupsRef.current,
      hud: { score: game.score, combo: game.combo, multiplier: game.multiplier },
    });
  });

  const best = getBest(chart.id);

  return (
    <div className="stage">
      <aside className="side">
        <button className="link" onClick={onExit}>
          ← Menú
        </button>
        <h2>{chart.title}</h2>
        <div className="video" ref={hostRef} />
        {error && <p className="error">{error}</p>}

        <div className="row">
          {phase === "ready" && (
            <button className="primary" disabled={!player} onClick={togglePause}>
              {player ? "Empezar" : "Cargando…"}
            </button>
          )}
          {(phase === "playing" || phase === "paused") && (
            <>
              <button onClick={togglePause}>{phase === "playing" ? "Pausa" : "Seguir"}</button>
              <button onClick={restart}>Reiniciar</button>
              <button onClick={finish}>Terminar</button>
            </>
          )}
        </div>

        <p className="hint">
          Teclas: {settings.keys.map(keyLabel).join(" · ")} — Espacio pausa
          {best !== undefined && (
            <>
              <br />
              Récord: {best.toLocaleString("es-MX")}
            </>
          )}
        </p>
      </aside>

      <div className="highway">
        <canvas ref={canvasRef} />
        {phase === "done" && result && (
          <div className="results">
            <h2>{result.newBest ? "¡Nuevo récord!" : "Resultado"}</h2>
            <p className="big">{result.score.toLocaleString("es-MX")}</p>
            <p>Precisión {(result.accuracy * 100).toFixed(1)}% · Combo máximo {result.maxCombo}</p>
            <ul>
              {(["perfect", "great", "good", "miss"] as const).map((j) => (
                <li key={j} style={{ color: JUDGMENTS[j].color }}>
                  {JUDGMENTS[j].label} {result.counts[j]}
                </li>
              ))}
            </ul>
            <div className="row">
              <button className="primary" onClick={restart}>
                Otra vez
              </button>
              <button onClick={onEdit}>Editar chart</button>
              <button onClick={onExit}>Menú</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
