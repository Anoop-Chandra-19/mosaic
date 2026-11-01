import { useNow } from '@/lib/hooks/useNow';
import { formatSeconds } from '@shared/time/formatTime';
import { isTimeShown } from './runTimeline';

const TICK_MS = 100;

/** The time since `since`, climbing on its own, so a tick redraws only this. */
export function LiveTime({ since, prefix = '' }: { since: number; prefix?: string }) {
  const elapsed = useNow(TICK_MS) - since;
  return isTimeShown(elapsed) ? `${prefix}${formatSeconds(elapsed)}` : null;
}
