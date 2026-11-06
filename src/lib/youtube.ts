declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** Loads the YouTube IFrame Player API once; resolves when `YT.Player` is usable. */
export function loadYouTubeApi(): Promise<void> {
  if (typeof YT !== "undefined" && YT.Player) return Promise.resolve();
  apiPromise ??= new Promise<void>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("No se pudo cargar YouTube"));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** Accepts a bare video id or any common YouTube URL. */
export function parseVideoId(input: string): string | null {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^(www|m|music)\./, "");
    if (host === "youtu.be") return idOrNull(url.pathname.slice(1, 12));
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = url.searchParams.get("v");
      if (v) return idOrNull(v);
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/);
      if (match) return match[1];
    }
  } catch {
    // not a URL
  }
  return null;
}

function idOrNull(id: string) {
  return /^[\w-]{11}$/.test(id) ? id : null;
}

export function thumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

export function playerErrorMessage(code: number) {
  switch (code) {
    case 2:
      return "El enlace del video no es válido.";
    case 5:
      return "Este video no se puede reproducir en el navegador.";
    case 100:
      return "El video no existe o es privado.";
    case 101:
    case 150:
      return "El dueño de este video no permite reproducirlo fuera de YouTube. Prueba con otra versión (lyric video, audio oficial, en vivo).";
    default:
      return `YouTube devolvió el error ${code}.`;
  }
}
