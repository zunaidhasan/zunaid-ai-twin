"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Streams text into a message id, revealing chunk-by-chunk. */
export function useStreamer() {
  const [visible, setVisible] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const stream = useCallback((id: string, full: string, onDone: () => void) => {
    let i = 0;
    const step = Math.max(2, Math.round(full.length / 90));
    const t = setInterval(() => {
      i += step;
      setVisible((v) => ({ ...v, [id]: full.slice(0, i) }));
      if (i >= full.length) {
        clearInterval(t);
        delete timers.current[id];
        onDone();
      }
    }, 18);
    timers.current[id] = t;
  }, []);

  const stop = useCallback((id: string, full: string) => {
    if (timers.current[id]) {
      clearInterval(timers.current[id]);
      delete timers.current[id];
    }
    setVisible((v) => ({ ...v, [id]: full }));
  }, []);

  useEffect(() => {
    const timersMap = timers.current;
    return () => {
      for (const id of Object.keys(timersMap)) {
        clearInterval(timersMap[id]);
        delete timersMap[id];
      }
    };
  }, []);

  return { visible, stream, stop };
}
