const STEP_MS = 100;

/** A two-column, four-row dot grid, ordered around its perimeter for the animation. */
const PLACES = [
  { x: 4, y: 1 },
  { x: 4, y: 4 },
  { x: 4, y: 7 },
  { x: 4, y: 10 },
  { x: 1, y: 10 },
  { x: 1, y: 7 },
  { x: 1, y: 4 },
  { x: 1, y: 1 },
];

/** Use amber for the reply's waiting indicator and muted dots for secondary indicators. */
const TONE_CLASS = { amber: 'fill-amber', muted: 'fill-ink-muted' } as const;

/** Indicates that the assistant is busy by lighting half the dots in sequence around the grid. */
export function TracingDots({ tone = 'amber' }: { tone?: keyof typeof TONE_CLASS }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 5 11"
      className={`ml-0.5 inline-block h-2.75 w-1.25 ${TONE_CLASS[tone]}`}
    >
      {PLACES.map(({ x, y }, index) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r="1"
          className="animate-dots-trace motion-reduce:animate-none"
          style={{ animationDelay: `${(index - PLACES.length) * STEP_MS}ms` }}
        />
      ))}
    </svg>
  );
}
