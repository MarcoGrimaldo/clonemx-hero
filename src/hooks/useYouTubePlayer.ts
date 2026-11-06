import { useEffect, useMemo, useRef, useState } from "react";
import { SongClock } from "../lib/clock";
import { loadYouTubeApi, playerErrorMessage } from "../lib/youtube";

/**
 * Mounts a YouTube player inside `hostRef` and returns it once it is ready,
 * together with a smoothed song clock.
 */
export function useYouTubePlayer(videoId: string, onStateChange?: (state: YT.PlayerState) => void) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<YT.Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(onStateChange);
  stateRef.current = onStateChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // YT.Player replaces the element it is given, so give it one React does not own.
    const mount = document.createElement("div");
    host.appendChild(mount);
    let instance: YT.Player | undefined;
    let cancelled = false;
    setError(null);

    loadYouTubeApi()
      .then(() => {
        if (cancelled) return;
        instance = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            disablekb: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
          },
          events: {
            onReady: () => !cancelled && setPlayer(instance!),
            onError: (e) => !cancelled && setError(playerErrorMessage(e.data)),
            onStateChange: (e) => !cancelled && stateRef.current?.(e.data),
          },
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
      instance?.destroy();
      host.innerHTML = "";
      setPlayer(null);
    };
  }, [videoId]);

  const clock = useMemo(() => (player ? new SongClock(player) : null), [player]);
  return { hostRef, player, clock, error };
}
