import { useState } from 'react';
import { Check } from 'lucide-react';
import { AppButton, Text, textVariantClasses } from '@/components/ui-kit';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { cn } from '@/lib/utils';

interface DevToolFailureProps {
  label: string;
  message: string;
  onRunAgain: () => void;
}

/** A tool that failed, in place of the list: its message as written, to run again or copy. */
export function DevToolFailure({ label, message, onRunAgain }: DevToolFailureProps) {
  const [isCopied, setIsCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(message).then(() => setIsCopied(true));
  };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1 pb-1.5">
      <div
        role="alert"
        className="mx-2 mt-1 rounded-sm border border-del-line bg-del-soft px-2.75 py-2.25"
      >
        <Text as="p" variant="strong" className="text-del">
          “{label}” didn’t finish
        </Text>
        <code
          className={cn(
            textVariantClasses('meta'),
            'mt-1 mb-1.5 block whitespace-pre-wrap wrap-break-word text-foreground'
          )}
        >
          {message}
        </code>
        <div className="mt-2.25 flex flex-wrap gap-1.5">
          <AppButton variant="outline" size="xs" onClick={onRunAgain}>
            Run again
            <ShortcutKeys combos={['Enter']} />
          </AppButton>
          <AppButton variant="ghost" size="xs" onClick={copy}>
            {isCopied && <Check />}
            {isCopied ? 'Copied' : 'Copy the error'}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
