import { useRef } from 'react';
import { Bookmark, Copy, Eye, History, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuSeparator,
  AppMenuTrigger,
} from '@/components/AppMenu';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';

interface VersionActionsProps {
  version: VersionMeta;
  label: string;
  isHead: boolean;
  isNested: boolean;
  isWide: boolean;
  /** Read in the sheet now: the pill stays up, the eye pressed. */
  isPreviewing: boolean;
  canPreview: boolean;
  onPreview: () => void;
  onRestore: () => void;
  onDuplicate: () => void;
  onStartNaming: () => void;
  onDelete: () => void;
}

/**
 * A row's actions, floating over its right end on a solid, ringed pill, so they reserve no
 * column and read the same over any row. Three are inline; ⋯ holds them all, and is all
 * there is in a narrow panel.
 */
export function VersionActions({
  version,
  label,
  isHead,
  isNested,
  isWide,
  isPreviewing,
  canPreview,
  onPreview,
  onRestore,
  onDuplicate,
  onStartNaming,
  onDelete,
}: VersionActionsProps) {
  const isNamed = version.kind === 'named';
  // Naming and the delete confirm open in the row once the menu has closed: while it is
  // open it holds focus, and would take it straight back from the field.
  const opensInRow = useRef<(() => void) | null>(null);
  const isPressed = isPreviewing && !isWide;
  // The full view's selected row is already beside the list, so Read would do nothing. In
  // the sidebar it is never dead: on the row being read it stops reading.
  const canRead = !(isWide && isPreviewing);
  const previewHint = isWide
    ? 'Read this version beside the list'
    : !canPreview
      ? 'Open this template to preview its versions'
      : isPressed
        ? 'Back to your draft'
        : 'Preview this version. Nothing changes until you restore.';

  return (
    <span
      className={cn(
        'pointer-events-none absolute right-1 z-2 flex gap-px rounded-[0.4375rem] bg-pane-raised p-0.5 opacity-0 shadow-floating ring-1 ring-line-strong transition-opacity duration-100',
        'group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 has-data-[state=open]:pointer-events-auto has-data-[state=open]:opacity-100 motion-reduce:transition-none',
        isNested ? 'top-0' : 'top-0.5',
        isPressed && 'pointer-events-auto opacity-100'
      )}
    >
      <span className="flex gap-px @max-[18.75rem]/history:hidden">
        {canRead && (
          <AppButton
            variant="ghost"
            size="2xs"
            shape="square"
            disabled={!canPreview}
            aria-pressed={isPressed}
            aria-label={`Read ${label}`}
            title={previewHint}
            onClick={onPreview}
            className={cn('rounded-[0.3125rem]', isPressed && 'bg-line-strong text-foreground')}
          >
            <Eye className="size-2.75" />
          </AppButton>
        )}
        {!isHead && (
          <AppButton
            variant="ghost"
            size="2xs"
            shape="square"
            aria-label={`Restore ${label}`}
            title="Restore this version. Your current draft is saved to history first."
            onClick={onRestore}
            className="rounded-[0.3125rem]"
          >
            <History className="size-2.75" />
          </AppButton>
        )}
        {isNamed ? (
          <AppButton
            variant="ghost"
            size="2xs"
            shape="square"
            aria-label={`Duplicate ${label} as a new template`}
            title="Duplicate as a new template"
            onClick={onDuplicate}
            className="rounded-[0.3125rem]"
          >
            <Copy className="size-2.75" />
          </AppButton>
        ) : (
          <AppButton
            variant="ghost"
            size="2xs"
            shape="square"
            aria-label={`Name ${label}`}
            title="Name this version to keep it for good"
            onClick={onStartNaming}
            className="rounded-[0.3125rem]"
          >
            <Bookmark className="size-2.75" />
          </AppButton>
        )}
      </span>
      <AppMenu>
        <AppMenuTrigger asChild>
          <AppButton
            variant="ghost"
            size="2xs"
            shape="square"
            aria-label={`Actions for ${label}`}
            className="rounded-[0.3125rem]"
          >
            <MoreHorizontal className="size-3" />
          </AppButton>
        </AppMenuTrigger>
        <AppMenuContent
          align="end"
          className="w-56.5"
          onCloseAutoFocus={(event) => {
            const open = opensInRow.current;
            opensInRow.current = null;
            if (!open) return;
            event.preventDefault();
            open();
          }}
        >
          {canRead && (
            <AppMenuItem disabled={!canPreview} onClick={onPreview}>
              <Eye />
              {isPressed ? 'Stop reading it' : 'Read this version'}
            </AppMenuItem>
          )}
          {!isHead && (
            <AppMenuItem onClick={onRestore}>
              <History />
              Restore
            </AppMenuItem>
          )}
          <AppMenuItem onClick={onDuplicate}>
            <Copy />
            Duplicate
          </AppMenuItem>
          <AppMenuItem
            onClick={() => {
              opensInRow.current = onStartNaming;
            }}
          >
            {isNamed ? <Pencil /> : <Bookmark />}
            {isNamed ? 'Rename' : 'Name it'}
          </AppMenuItem>
          <AppMenuSeparator />
          {isHead ? (
            <AppMenuItem disabled className="items-start">
              <Trash2 className="mt-0.5" />
              <span>
                Delete
                <Text variant="secondary" className="mt-0.5 block text-inherit">
                  The newest version can’t be deleted. Your draft is measured from it.
                </Text>
              </span>
            </AppMenuItem>
          ) : (
            <AppMenuItem
              variant="destructive"
              onClick={() => {
                if (isNamed) opensInRow.current = onDelete;
                else onDelete();
              }}
            >
              <Trash2 />
              {isNamed ? 'Delete…' : 'Delete'}
            </AppMenuItem>
          )}
        </AppMenuContent>
      </AppMenu>
    </span>
  );
}
