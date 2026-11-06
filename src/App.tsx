import { useCallback, useState } from "react";
import { Calibrate } from "./components/Calibrate";
import { Home } from "./components/Home";
import { PlayScreen } from "./components/PlayScreen";
import { Recorder } from "./components/Recorder";
import type { Chart } from "./lib/chart";
import { loadSettings, saveSettings, type Settings } from "./lib/settings";

type Screen = { name: "home" } | { name: "record"; chart: Chart } | { name: "play"; chart: Chart } | { name: "calibrate" };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [settings, setSettings] = useState(loadSettings);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const home = () => setScreen({ name: "home" });

  switch (screen.name) {
    case "home":
      return (
        <Home
          settings={settings}
          onSettings={updateSettings}
          onRecord={(chart) => setScreen({ name: "record", chart })}
          onPlay={(chart) => setScreen({ name: "play", chart })}
          onCalibrate={() => setScreen({ name: "calibrate" })}
        />
      );
    case "record":
      return (
        <Recorder
          key={screen.chart.id}
          chart={screen.chart}
          settings={settings}
          onSaved={(chart) => setScreen({ name: "record", chart })}
          onPlay={(chart) => setScreen({ name: "play", chart })}
          onExit={home}
        />
      );
    case "play":
      return (
        <PlayScreen
          key={screen.chart.id}
          chart={screen.chart}
          settings={settings}
          onEdit={() => setScreen({ name: "record", chart: screen.chart })}
          onExit={home}
        />
      );
    case "calibrate":
      return <Calibrate settings={settings} onChange={updateSettings} onExit={home} />;
  }
}
