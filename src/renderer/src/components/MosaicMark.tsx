import { cn } from '@/lib/utils';

/** The app's mark: the top bar's, the Start panel's, and About's, each a step larger. */
const SIZE_CLASSES = {
  sm: 'size-6 rounded-[0.4375rem] text-title',
  md: 'size-8.5 rounded-lg text-editor',
  lg: 'size-9.5 rounded-[0.625rem] text-heading',
} as const;

export function MosaicMark({ size }: { size: keyof typeof SIZE_CLASSES }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center bg-amber font-tag text-background',
        SIZE_CLASSES[size]
      )}
    >
      M
    </span>
  );
}
