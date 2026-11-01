const STEP_MS = 100;

/** A grid two dots wide and four tall, in the order the light goes round it. */
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

/** Waiting for the assistant's first words: half the dots go round the edge, a place at a time. */
export function TracingDots() {
  return (
    <svg aria-hidden viewBox="0 0 5 11" className="ml-0.5 inline-block h-2.75 w-1.25 fill-amber">
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
