import { useEffect, useState } from 'react';
import { formatSeconds, isTimeShown } from './runLineItems';

const TICK_MS = 100;

/** The time since `since`, climbing on its own, so a tick redraws only this. */
export function LiveTime({ since, prefix = '' }: { since: number; prefix?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const elapsed = now - since;
  return isTimeShown(elapsed) ? `${prefix}${formatSeconds(elapsed)}` : null;
}
