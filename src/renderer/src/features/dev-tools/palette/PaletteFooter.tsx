import { Check } from 'lucide-react';
import { AppButton, textVariantClasses } from '@/components/ui-kit';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { cn } from '@/lib/utils';

/** A key the footer lists: its keycaps, and what it does. */
export interface FooterKey {
  keys: string[];
  label: string;
}

interface PaletteFooterProps {
  keys: FooterKey[];
  /** This view's address, with Copy. */
  here: string;
  isCopied: boolean;
  onCopy: () => void;
}

/** The keys that work now, and where the palette was opened over. */
export function PaletteFooter({ keys, here, isCopied, onCopy }: PaletteFooterProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line bg-chrome px-3 py-1.75 text-support text-ink-faint">
      <span className="flex flex-wrap gap-2.5">
        {keys.map(({ keys: combos, label }) => (
          <span key={label} className="inline-flex items-center gap-1">
            {combos.map((combo) => (
              <ShortcutKeys key={combo} combos={[combo]} />
            ))}
            {label}
          </span>
        ))}
      </span>
      <span className="ml-auto flex max-w-full min-w-0 items-center gap-1.5">
        <span
          title="This view’s address"
          className={cn(textVariantClasses('meta'), 'truncate text-ink-muted')}
        >
          {here}
        </span>
        <AppButton variant="outline" size="2xs" onClick={onCopy} className="shrink-0">
          {isCopied ? (
            <>
              <Check />
              Copied
            </>
          ) : (
            <>
              Copy
              <ShortcutKeys combos={['Mod+Shift+C']} />
            </>
          )}
        </AppButton>
      </span>
    </div>
  );
}
