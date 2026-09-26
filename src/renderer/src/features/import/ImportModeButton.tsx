import { Check, ChevronDown } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ImportMode } from './buildImportedResume';

const MODES: { id: ImportMode; label: string; hint: string }[] = [
  {
    id: 'new',
    label: 'New template',
    hint: 'Opens as its own template. The one you have open stays as it is.',
  },
  {
    id: 'replace',
    label: 'Replace',
    hint: 'Replaces what’s in the editor. Your draft is kept in history first, so you can restore it.',
  },
  {
    id: 'merge',
    label: 'Add to this resume',
    hint: 'Adds these sections to the open resume. Your draft is kept in history first.',
  },
];

const IMPORT_LABELS: Record<ImportMode, string> = {
  new: 'Import as new template',
  replace: 'Replace resume',
  merge: 'Add to resume',
};

/** The import button, with the mode chosen from its menu. Without a choice, only "new". */
export function ImportModeButton({
  mode,
  onModeChange,
  canChoose,
  disabled,
  onImport,
}: {
  mode: ImportMode;
  onModeChange: (mode: ImportMode) => void;
  canChoose: boolean;
  disabled: boolean;
  onImport: () => void;
}) {
  const importButton = (
    <AppButton
      size="sm"
      disabled={disabled}
      onClick={onImport}
      className={canChoose ? 'rounded-r-none' : undefined}
    >
      {IMPORT_LABELS[mode]}
    </AppButton>
  );
  if (!canChoose) return importButton;

  return (
    <div className="flex">
      {importButton}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <AppButton size="sm" aria-label="How to import" className="ml-px rounded-l-none px-1.75">
            <ChevronDown className="size-3" />
          </AppButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-75">
          {MODES.map((option) => (
            <DropdownMenuItem
              key={option.id}
              role="menuitemradio"
              aria-checked={option.id === mode}
              onSelect={() => onModeChange(option.id)}
              className="grid grid-cols-[0.875rem_minmax(0,1fr)] items-center gap-x-1.75 gap-y-px py-1.5"
            >
              <span className="grid place-items-center text-foreground">
                {option.id === mode && <Check className="size-3" />}
              </span>
              <span className="font-medium text-foreground">{option.label}</span>
              <span />
              <span className="text-[0.71875rem] leading-[1.45] text-pretty text-ink-muted">
                {option.hint}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
