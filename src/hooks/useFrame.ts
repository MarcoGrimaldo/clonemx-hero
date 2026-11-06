import { useEffect, useRef } from "react";

/** Runs `callback` on every animation frame while the component is mounted. */
export function useFrame(callback: (now: number) => void) {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    let id = 0;
    const loop = (now: number) => {
      ref.current(now);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}
