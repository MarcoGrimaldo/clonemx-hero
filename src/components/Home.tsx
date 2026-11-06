import { useEffect, useState } from "react";
import { deleteChart, downloadChart, getBest, listCharts, newChart, parseChartFile, saveChart, type Chart } from "../lib/chart";
import { LANE_COLORS } from "../lib/highway";
import { keyLabel, RESERVED_KEYS, type Settings } from "../lib/settings";
import { parseVideoId, thumbnailUrl } from "../lib/youtube";

interface Props {
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onRecord: (chart: Chart) => void;
  onPlay: (chart: Chart) => void;
  onCalibrate: () => void;
}

export function Home({ settings, onSettings, onRecord, onPlay, onCalibrate }: Props) {
  const [charts, setCharts] = useState(listCharts);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [binding, setBinding] = useState<number | null>(null);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = parseVideoId(url);
    if (!videoId) {
      setError("Pega un enlace de YouTube válido.");
      return;
    }
    onRecord(newChart(videoId, title.trim() || "Sin título"));
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      saveChart(parseChartFile(await file.text()));
      setCharts(listCharts());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = (chart: Chart) => {
    if (!confirm(`¿Borrar “${chart.title}”?`)) return;
    deleteChart(chart.id);
    setCharts(listCharts());
  };

  useEffect(() => {
    if (binding === null) return;
    const down = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code !== "Escape" && !RESERVED_KEYS.includes(e.code)) {
        const keys = settings.keys.map((k, i) => (i === binding ? e.code : k === e.code ? settings.keys[binding] : k));
        onSettings({ ...settings, keys });
      }
      setBinding(null);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [binding, settings, onSettings]);

  return (
    <div className="page">
      <header className="hero">
        <h1>
          CloneMX <span>Hero</span>
        </h1>
        <p>Toca tus rolas favoritas de YouTube.</p>
      </header>

      <section>
        <h2>Nueva canción</h2>
        <form className="card new" onSubmit={create}>
          <input placeholder="Enlace de YouTube" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="primary" type="submit">
            Crear chart
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section>
        <div className="section-head">
          <h2>Tus charts</h2>
          <label className="button">
            Importar
            <input type="file" accept=".json,application/json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
          </label>
        </div>
        {charts.length === 0 ? (
          <p className="hint">Todavía no tienes charts. Pega un enlace arriba y graba el primero.</p>
        ) : (
          <ul className="charts">
            {charts.map((chart) => {
              const best = getBest(chart.id);
              return (
                <li key={chart.id} className="card">
                  <img src={thumbnailUrl(chart.videoId)} alt="" loading="lazy" />
                  <div className="info">
                    <strong>{chart.title}</strong>
                    <span className="hint">
                      {chart.notes.length} notas{best !== undefined && ` · récord ${best.toLocaleString("es-MX")}`}
                    </span>
                  </div>
                  <div className="row">
                    <button className="primary" disabled={chart.notes.length === 0} onClick={() => onPlay(chart)}>
                      Jugar
                    </button>
                    <button onClick={() => onRecord(chart)}>Editar</button>
                    <button onClick={() => downloadChart(chart)}>Exportar</button>
                    <button className="danger" onClick={() => remove(chart)}>
                      Borrar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2>Ajustes</h2>
        <div className="card settings">
          <div>
            <span className="hint">Teclas (clic para cambiar)</span>
            <div className="row">
              {settings.keys.map((key, lane) => (
                <button
                  key={lane}
                  className="key"
                  style={{ borderColor: LANE_COLORS[lane] }}
                  onClick={() => setBinding(lane)}
                >
                  {binding === lane ? "…" : keyLabel(key)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="hint">Desfase de audio: {settings.offsetMs} ms</span>
            <div className="row">
              <button onClick={onCalibrate}>Calibrar</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="hint">
        Los videos se reproducen con el reproductor oficial de YouTube. CloneMX solo guarda los charts (tiempos y carriles),
        nunca el audio.
      </footer>
    </div>
  );
}
