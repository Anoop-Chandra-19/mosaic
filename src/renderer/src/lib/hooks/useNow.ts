import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs`, for a time on screen that has to keep up. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
