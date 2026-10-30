import { useEffect, useState } from 'react';
import { AppButton, Text, textVariantClasses } from '@/components/ui-kit';
import { formatCount } from '@/features/import/formatCount';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { cn } from '@/lib/utils';
import { useTemplateStore } from '@/stores/templateStore';
import { devService } from '../devService';
import type { DataReplacement } from '../tools/devTool';

interface ReplaceDataConfirmProps {
  replacement: DataReplacement;
  onCancel: () => void;
  onReplace: () => void;
}

/** What is here now, as the confirm counts it. */
function useDataHere(): string {
  const templates = useTemplateStore((s) => s.templates);
  const versions = templates.reduce((sum, template) => sum + template.versionCount, 0);
  if (templates.length === 0) return 'Nothing is in this build’s data yet.';
  return `Deletes the ${formatCount(templates.length, 'template')} and ${formatCount(versions, 'version')} in this build’s data.`;
}

/**
 * Asked in place of the list before a tool replaces the data, naming the folder it lives in:
 * the development build's own, never an installed Mosaic's.
 */
export function ReplaceDataConfirm({ replacement, onCancel, onReplace }: ReplaceDataConfirmProps) {
  const here = useDataHere();
  const [folder, setFolder] = useState<string | null>(null);
  useEffect(() => {
    void devService.readDataFolder().then(setFolder);
  }, []);

  return (
    <div role="alertdialog" className="flex flex-col gap-2 px-4 pt-4 pb-3.5">
      <Text variant="eyebrow" className="text-info">
        Development data
      </Text>
      <Text as="h2" variant="title">
        Replace all development data with {replacement.replacement}?
      </Text>
      <Text as="p" variant="body" className="text-ink-soft">
        {here} {replacement.leaves}
      </Text>
      {folder && (
        <div
          className={cn(
            textVariantClasses('meta'),
            'rounded-sm border border-line bg-pane-sunken px-2 py-1.5 break-all text-ink-muted'
          )}
        >
          {folder}
        </div>
      )}
      <Text as="p" variant="secondary" className="text-ink-faint">
        Only the development build’s own folder on your computer. A release install keeps its data
        elsewhere and is not touched.
      </Text>
      <div className="mt-1.5 flex flex-wrap justify-end gap-2">
        <AppButton variant="outline" size="sm" onClick={onCancel}>
          Cancel
          <ShortcutKeys combos={['Esc']} />
        </AppButton>
        <AppButton variant="destructive" size="sm" onClick={onReplace}>
          Replace with {replacement.replacement}
          <ShortcutKeys combos={['Mod+Enter']} />
        </AppButton>
      </div>
    </div>
  );
}
