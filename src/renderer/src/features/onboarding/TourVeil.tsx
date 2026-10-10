import { cn } from '@/lib/utils';
import type { Box } from './placeTourCard';

const VEIL = 'pointer-events-auto absolute bg-veil';

interface TourVeilProps {
  /** None: the whole app dimmed, for a step with nothing to point at. */
  spot: Box | null;
  /** One ping as the spotlight lands, on the way to another tab. */
  isPinging?: boolean;
}

/**
 * The app dimmed around one live element, which stays usable. Four panels rather than a
 * spread shadow: they catch clicks around the target and leave the target itself usable.
 */
export function TourVeil({ spot, isPinging = false }: TourVeilProps) {
  if (!spot) return <div className={cn(VEIL, 'inset-0')} />;
  return (
    <>
      <div className={VEIL} style={{ top: 0, left: 0, right: 0, height: Math.max(0, spot.top) }} />
      <div className={VEIL} style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} />
      <div
        className={VEIL}
        style={{ top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height }}
      />
      <div
        className={VEIL}
        style={{ top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }}
      />
      <div
        aria-hidden
        data-tour-spot
        className={cn(
          'pointer-events-none absolute rounded-[0.625rem] border border-amber-line transition-[top,left,width,height] duration-160 ease-out motion-reduce:transition-none',
          isPinging && 'animate-attention-ping [animation-delay:160ms] motion-reduce:animate-none'
        )}
        style={spot}
      />
    </>
  );
}
