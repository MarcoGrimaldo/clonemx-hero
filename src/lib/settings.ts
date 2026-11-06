export interface Settings {
  /**
   * How late, in ms, the player hears the music and presses relative to the
   * video's clock. Applied to both drawing and judging.
   */
  offsetMs: number;
  /** `KeyboardEvent.code` for each lane. */
  keys: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  offsetMs: 0,
  keys: ["KeyD", "KeyF", "KeyJ", "KeyK", "KeyL"],
};

const KEY = "clonemx.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // keep working with in-memory settings
  }
}

/** Keys the screens use for their own controls; lanes cannot be bound to them. */
export const RESERVED_KEYS = ["Space", "Escape", "Backspace", "ArrowLeft", "ArrowRight", "Enter", "Tab"];

export function keyLabel(code: string) {
  return code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num ");
}
