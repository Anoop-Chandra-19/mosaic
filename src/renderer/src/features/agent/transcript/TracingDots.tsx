/** Five dots close together, then the rest of the way round, as a share of the path's length. */
const DOTTED_LINE = '0 7 0 7 0 7 0 7 0 72';

/** Waiting for the assistant's first words: a short dotted line loops in a rectangle's shape. */
export function TracingDots() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 8 14"
      className="ml-0.5 inline-block h-5 w-3 fill-none stroke-[1.5] align-[-0.3125rem] [stroke-linecap:round]"
    >
      <rect
        x="1"
        y="1"
        width="6"
        height="12"
        rx="1"
        pathLength={100}
        strokeDasharray={DOTTED_LINE}
        className="animate-dots-trace stroke-amber motion-reduce:animate-none"
      />
    </svg>
  );
}
