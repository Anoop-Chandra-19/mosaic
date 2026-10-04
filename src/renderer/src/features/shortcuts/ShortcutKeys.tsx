import { Fragment } from 'react';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { formatShortcutKeys } from '@/lib/keyboardShortcuts';
import { cn } from '@/lib/utils';

const KEYCAP = cn(
  textVariantClasses('meta'),
  'inline-flex h-4.75 min-w-4.75 items-center justify-center rounded-[0.25rem] border px-1.25'
);

/** An action's keycaps, each combination after a slash; a dashed "unbound" when it has none. */
export function ShortcutKeys({ combos }: { combos: string[] }) {
  if (combos.length === 0) {
    return (
      <span className={cn(KEYCAP, 'shrink-0 border-dashed border-line-strong text-ink-faint')}>
        unbound
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-0.75">
      {combos.map((combo, index) => (
        <Fragment key={combo}>
          {index > 0 && (
            <Text variant="meta" className="mx-px">
              /
            </Text>
          )}
          {formatShortcutKeys(combo).map((key, keyIndex) => (
            <kbd key={keyIndex} className={cn(KEYCAP, 'border-line-strong bg-line text-ink-soft')}>
              {key}
            </kbd>
          ))}
        </Fragment>
      ))}
    </span>
  );
}
