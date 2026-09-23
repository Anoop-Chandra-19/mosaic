import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Info,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { getDb } from '@/lib/storage/mosaicDb';
import { cn } from '@/lib/utils';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import type { TemplateSummary, VersionMeta } from '@shared/types/db';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import { formatRelativeTime } from './formatRelativeTime';
import type { HistoryFilter } from '@/features/history/filterVersionHistory';
import { useTemplateVersions, versionLabel } from '@/features/history/useTemplateVersions';
import { VersionList } from '@/features/history/VersionList';

interface TemplateCardProps {
  template: TemplateSummary;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
}

export function TemplateCard({ template, active, expanded, onToggle }: TemplateCardProps) {
  const isLast = useTemplateStore((s) => s.templates.length === 1);
  const openTemplate = useTemplateStore((s) => s.openTemplate);
  const renameTemplate = useTemplateStore((s) => s.renameTemplate);
  const duplicateTemplate = useTemplateStore((s) => s.duplicateTemplate);
  const duplicateVersion = useTemplateStore((s) => s.duplicateVersion);
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate);
  const restoreDeleted = useTemplateStore((s) => s.restoreDeleted);
  const restoreVersion = useTemplateStore((s) => s.restoreVersion);
  const setNameVersionOpen = useOverlayStore((s) => s.setNameVersionOpen);
  const openExport = useOverlayStore((s) => s.openExport);
  const preview = useOverlayStore((s) => s.preview);
  const setPreview = useOverlayStore((s) => s.setPreview);
  const openSurface = useOverlayStore((s) => s.openSurface);
  // The draft has moved on from the newest version.
  const dirty = useResumeStore((s) => active && s.rev !== template.head.rev);
  const versions = useTemplateVersions(template, expanded);
  const [renaming, setRenaming] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const previewId = active && preview ? preview.version.id : null;

  const open = async () => {
    if (await attempt(openTemplate(template.id), 'Could not open that template')) {
      showToast(`Opened “${template.name}”`);
    }
  };

  const rename = (name: string) => {
    setRenaming(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== template.name) {
      void attempt(renameTemplate(template.id, trimmed), 'Could not rename the template');
    }
  };

  const duplicate = async (version?: VersionMeta) => {
    try {
      const copy = await (version ? duplicateVersion(version.id) : duplicateTemplate(template.id));
      showToast(`Duplicated as “${copy.name}”`);
    } catch (error) {
      console.error(error);
      showToast('Could not duplicate the template', 'error');
    }
  };

  const exportTemplate = async () => {
    if (!active && !(await attempt(openTemplate(template.id), 'Could not open that template'))) {
      return;
    }
    openExport();
  };

  /** The version in the sheet, or else the newest one. */
  const exportVersion = async () => {
    if (!versions) return;
    try {
      const target =
        previewId && preview
          ? preview
          : {
              version: await getDb().versions.get(versions[0].id),
              label: versionLabel(versions, 0),
            };
      openExport({ ...target, templateName: template.name });
    } catch (error) {
      console.error(error);
      showToast('Could not read that version', 'error');
    }
  };

  const togglePreview = async (version: VersionMeta, label: string) => {
    if (previewId === version.id) {
      setPreview(null);
      return;
    }
    try {
      setPreview({ version: await getDb().versions.get(version.id), label });
    } catch (error) {
      console.error(error);
      showToast('Could not read that version', 'error');
    }
  };

  const openFullHistory = (filter?: HistoryFilter) =>
    openSurface({ kind: 'history', templateId: template.id, filter });

  const restore = async (version: VersionMeta) => {
    if (await attempt(restoreVersion(template.id, version.id), 'Could not restore that version')) {
      showToast(`Restored “${version.summary}”`);
    }
  };

  const remove = () => {
    const count = template.versionCount;
    const deleting = deleteTemplate(template.id).then((deleted) =>
      showToast(
        `Deleted “${template.name}” and its ${count} ${count === 1 ? 'version' : 'versions'}`,
        'success',
        {
          label: 'Undo',
          run: () =>
            void attempt(restoreDeleted(deleted), 'Could not bring the template back').then(
              (restored) => restored && showToast(`Brought back “${template.name}”`)
            ),
        }
      )
    );
    void attempt(deleting, 'Could not delete the template');
  };

  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={cn(
        // Clip, not hidden: a card that could scroll would pin the history's day headers
        // inside itself instead of to the sidebar.
        '@container overflow-clip rounded-lg border bg-zinc-50 transition-colors dark:bg-zinc-900',
        active
          ? 'border-amber-300 dark:border-amber-800'
          : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
      )}
    >
      <div className="flex items-start gap-2 px-3 py-2.5">
        {/* The negative margins keep the chevron where it sat before it had a button's box. */}
        <AppButton
          variant="quiet"
          size="2xs"
          shape="square"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Hide' : 'Show'} history of ${template.name}`}
          className="-mx-1 -mt-0.5"
        >
          <Chevron className="size-3.5" />
        </AppButton>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {renaming ? (
              <Input
                defaultValue={template.name}
                aria-label="Template name"
                maxLength={200}
                autoFocus
                onBlur={(event) => rename(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') rename(event.currentTarget.value);
                  if (event.key === 'Escape') setRenaming(false);
                }}
                className="h-7 text-sm font-semibold"
              />
            ) : (
              <AppButton
                variant="link"
                onClick={onToggle}
                className="h-auto min-w-0 shrink justify-start p-0 text-sm font-semibold"
              >
                <span className="truncate">{template.name}</span>
              </AppButton>
            )}
            {active && !renaming && (
              <span className="shrink-0 rounded bg-zinc-900 px-1.5 py-px text-[0.7rem] font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                open
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {template.versionCount} {template.versionCount === 1 ? 'version' : 'versions'} ·{' '}
            {formatRelativeTime(template.head.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {active ? (
            <AppButton
              size="xs"
              variant={dirty ? 'accent' : 'outline'}
              title="Give this state a name so you can find it in history"
              aria-label="Name version"
              onClick={() => setNameVersionOpen(true)}
            >
              <Save className="size-3" />
              {/* In a narrow sidebar the template's name needs the room more. */}
              <span className="hidden @[20rem]:inline">Name version</span>
            </AppButton>
          ) : (
            <AppButton size="xs" variant="outline" onClick={() => void open()}>
              Open
            </AppButton>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <AppButton
                variant="ghost"
                size="xs"
                shape="square"
                aria-label={`Options for ${template.name}`}
              >
                <MoreHorizontal className="size-3.5" />
              </AppButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem disabled={active} onClick={() => void open()}>
                <LayoutTemplate />
                {active ? 'Already open' : 'Open template'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRenaming(true)}>
                <Pencil />
                Rename…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void duplicate()}>
                <Copy />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void exportTemplate()}>
                <Download />
                Export…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggle}>
                <Clock />
                {expanded ? 'Hide history' : 'Show history'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openFullHistory()}>
                <ExternalLink />
                Open full history…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(true)}>
                <Trash2 />
                Delete template…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-200 bg-white px-3 pt-2.5 pb-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-0.5">
              <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-wider text-zinc-500 uppercase">
                <Clock className="size-3" />
                History
              </span>
              {active && versions && (
                <AppButton
                  variant="ghost"
                  size="xs"
                  shape="square"
                  aria-label="What the working draft is doing"
                  title={
                    dirty
                      ? 'Working draft · saved as you type. It gets snapshotted on its own. Name it to make it easy to find.'
                      : `Working draft matches ${versionLabel(versions, 0)}.`
                  }
                >
                  <Info className="size-3" />
                </AppButton>
              )}
            </span>
            <span className="font-mono text-[0.7rem] text-zinc-500">newest first</span>
          </div>

          {versions ? (
            <VersionList
              versions={versions}
              isCompact={!active}
              canPreview={active}
              previewId={previewId}
              onPreview={(version, label) => void togglePreview(version, label)}
              onRestore={(version) => void restore(version)}
              onDuplicate={(version) => void duplicate(version)}
            />
          ) : (
            <p className="mt-2 text-xs text-zinc-500">Loading history…</p>
          )}

          {previewId && preview && (
            <Note icon={Eye} tone="amber">
              <span className="flex-1">
                Showing {preview.label} in the sheet. Your draft is untouched. Restore from the
                banner if you want this version back.
              </span>
              <AppButton variant="outline" size="xs" onClick={() => setPreview(null)}>
                Exit
              </AppButton>
            </Note>
          )}

          {versions && (
            <AppButton
              variant="ghost"
              size="xs"
              className="mt-1.5"
              title={
                previewId && preview
                  ? `Export ${preview.label}, the version in the sheet`
                  : `Export ${versionLabel(versions, 0)}, the newest version`
              }
              onClick={() => void exportVersion()}
            >
              <Download className="size-3" />
              Export this version
            </AppButton>
          )}
        </div>
      )}

      <DeleteTemplateDialog
        template={template}
        open={pendingDelete}
        active={active}
        last={isLast}
        onOpenChange={setPendingDelete}
        onDelete={remove}
      />
    </div>
  );
}

function Note({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Info;
  tone?: 'amber';
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs leading-relaxed text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      <Icon
        className={cn(
          'mt-0.5 size-3.5 shrink-0',
          tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'
        )}
      />
      {children}
    </div>
  );
}
