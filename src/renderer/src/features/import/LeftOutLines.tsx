import { useState } from 'react';
import { Check, ChevronRight, Copy } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { copyText } from '@/features/export/exportResume';

const COPY_LABELS = { idle: 'Copy', copied: 'Copied', failed: 'Couldn’t copy' } as const;

/**
 * The lines a file had that Mosaic found no place for, listed under the review so they can
 * be copied into the editor after importing. Closed at first; the count says they're there.
 */
export function LeftOutLines({ lines }: { lines: string[] }) {
  // Said on the button itself: the workspace's toast sits behind the dialog.
  const [copyState, setCopyState] = useState<keyof typeof COPY_LABELS>('idle');

  const copy = async () => {
    try {
      await copyText(lines.join('\n'));
      setCopyState('copied');
    } catch (error) {
      console.error(error);
      setCopyState('failed');
    }
  };

  return (
    <Collapsible className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2 p-1">
        <CollapsibleTrigger asChild>
          <AppButton variant="ghost" size="sm" className="group h-7 gap-1.5 px-2">
            <ChevronRight className="size-3.5 text-zinc-500 transition-transform group-data-[state=open]:rotate-90" />
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Left out</span>
            <span className="text-xs font-normal text-zinc-600 dark:text-zinc-400">
              {lines.length === 1 ? '1 line' : `${lines.length} lines`}
            </span>
          </AppButton>
        </CollapsibleTrigger>
        <AppButton
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => void copy()}
        >
          {copyState === 'copied' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {COPY_LABELS[copyState]}
        </AppButton>
      </div>
      <CollapsibleContent>
        <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <p className="mb-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            Mosaic found no place for these. Copy what you need into the editor after importing.
          </p>
          <ul className="max-h-32 overflow-y-auto font-mono text-xs leading-5 text-zinc-900 dark:text-zinc-100">
            {lines.map((line, index) => (
              <li key={index} className="wrap-break-word">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
