import { useState, type ComponentProps } from 'react';
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
import {
  AppButton,
  AppMenu,
  AppMenuContent,
  AppMenuItem,
  AppMenuSeparator,
  AppMenuTrigger,
  AppInput,
  Note,
  Badge,
  Text,
} from '@/components/ui-kit';
import { ReadBoundary } from '@/components/ReadBoundary';
import { formatRelativeTime } from '@shared/time/formatTime';
import { cn } from '@/lib/utils';
import { useOverlayStore } from '@/stores/overlayStore';
import { usePreviewStore } from '@/stores/previewStore';
import { attempt, showToast } from '@/stores/toastStore';
import { useResumeStore } from '@/stores/resumeStore';
import { readVersion, useTemplateStore, useVersionHistory } from '@/stores/templateStore';
import type { TemplateSummary, VersionMeta } from '@shared/types/db';
import { DeleteTemplateDialog } from './DeleteTemplateDialog';
import type { HistoryFilter } from '@/types/history';
import { versionLabel } from '@/lib/versionLabel';
import { VersionList } from '@/features/history/version-list/VersionList';
import { showPlace } from '@/features/navigation/showPlace';
import { tourTargetProps } from '@/features/onboarding/tourTargets';

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
  const openDialog = useOverlayStore((s) => s.openDialog);
  const preview = usePreviewStore((s) => s.preview);
  const setPreview = usePreviewStore((s) => s.setPreview);
  const openSurface = useOverlayStore((s) => s.openSurface);
  // The draft has moved on from the newest version.
  const dirty = useResumeStore((s) => active && s.rev !== template.head.rev);
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

  const exportTemplate = () =>
    attempt(
      showPlace({
        kind: 'editor',
        templateId: template.id,
        dialog: { kind: 'export', version: null },
      }),
      'Could not open that template'
    );

  /** The version in the sheet, or else the newest one. */
  const exportVersion = async () => {
    try {
      const target =
        previewId && preview
          ? preview
          : {
              version: await readVersion(template.head.id),
              label: versionLabel(template.head),
            };
      openDialog({ kind: 'export', version: { ...target, templateName: template.name } });
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
      setPreview({ version: await readVersion(version.id), label });
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
        '@container overflow-clip rounded-[0.5625rem] border bg-pane-raised transition-colors duration-120',
        active ? 'border-amber-line' : 'border-line hover:border-line-strong'
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
              <AppInput
                defaultValue={template.name}
                aria-label="Template name"
                maxLength={200}
                autoFocus
                onBlur={(event) => rename(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') rename(event.currentTarget.value);
                  if (event.key === 'Escape') setRenaming(false);
                }}
                className="h-7 font-strong"
              />
            ) : (
              <AppButton
                variant="link"
                onClick={onToggle}
                className="h-auto min-w-0 shrink justify-start p-0 text-title"
              >
                <span className="truncate">{template.name}</span>
              </AppButton>
            )}
            {active && !renaming && <Badge tone="solid">open</Badge>}
          </div>
          <Text as="p" variant="secondary" className="mt-[0.1875rem] tabular-nums">
            {template.versionCount} {template.versionCount === 1 ? 'version' : 'versions'} ·{' '}
            {formatRelativeTime(template.head.createdAt)}
          </Text>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {active ? (
            <AppButton
              size="xs"
              variant={dirty ? 'accent' : 'outline'}
              title="Give this state a name so you can find it in history"
              aria-label="Name version"
              onClick={() => openDialog({ kind: 'nameVersion' })}
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
          <AppMenu>
            <AppMenuTrigger asChild>
              <AppButton
                variant="ghost"
                size="xs"
                shape="square"
                aria-label={`Options for ${template.name}`}
              >
                <MoreHorizontal className="size-3.5" />
              </AppButton>
            </AppMenuTrigger>
            <AppMenuContent align="end" className="w-48">
              <AppMenuItem disabled={active} onClick={() => void open()}>
                <LayoutTemplate />
                {active ? 'Already open' : 'Open template'}
              </AppMenuItem>
              <AppMenuItem onClick={() => setRenaming(true)}>
                <Pencil />
                Rename…
              </AppMenuItem>
              <AppMenuItem onClick={() => void duplicate()}>
                <Copy />
                Duplicate
              </AppMenuItem>
              <AppMenuSeparator />
              <AppMenuItem onClick={() => void exportTemplate()}>
                <Download />
                Export…
              </AppMenuItem>
              <AppMenuItem onClick={onToggle}>
                <Clock />
                {expanded ? 'Hide history' : 'Show history'}
              </AppMenuItem>
              <AppMenuItem onClick={() => openFullHistory()}>
                <ExternalLink />
                Open full history…
              </AppMenuItem>
              <AppMenuSeparator />
              <AppMenuItem variant="destructive" onClick={() => setPendingDelete(true)}>
                <Trash2 />
                Delete template…
              </AppMenuItem>
            </AppMenuContent>
          </AppMenu>
        </div>
      </div>

      {expanded && (
        <div
          className="border-t border-line bg-background px-3 pt-2.5 pb-3"
          {...(active && tourTargetProps('history'))}
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-0.5">
              <Text variant="eyebrow" className="inline-flex items-center gap-1.5">
                <Clock className="size-3" />
                History
              </Text>
              {active && (
                <AppButton
                  variant="ghost"
                  size="xs"
                  shape="square"
                  aria-label="What your draft is doing"
                  title={
                    dirty
                      ? 'Saved as you type. Name a version to keep this point in history.'
                      : `Your draft matches ${versionLabel(template.head)}.`
                  }
                >
                  <Info className="size-3" />
                </AppButton>
              )}
            </span>
            <Text variant="meta">newest first</Text>
          </div>

          <ReadBoundary
            failure="Could not load the history"
            fallback={
              <Text as="p" variant="secondary" className="mt-2 text-ink-faint">
                Loading history…
              </Text>
            }
          >
            <TemplateVersionList
              templateId={template.id}
              isCompact={!active}
              canPreview={active}
              previewId={previewId}
              onPreview={(version, label) => void togglePreview(version, label)}
              onRestore={(version) => void restore(version)}
              onDuplicate={(version) => void duplicate(version)}
              onOpenFullHistory={openFullHistory}
            />
          </ReadBoundary>

          {previewId && preview && (
            <Note icon={Eye} tone="amber" size="sm" className="mt-2">
              <span className="flex items-start gap-2">
                <span className="flex-1">
                  Previewing {preview.label}. Your draft is untouched. Restore from the banner if
                  you want this version back.
                </span>
                <AppButton variant="outline" size="xs" onClick={() => setPreview(null)}>
                  Exit
                </AppButton>
              </span>
            </Note>
          )}

          <AppButton
            variant="ghost"
            size="xs"
            className="mt-1.5"
            title={
              previewId && preview
                ? `Export ${preview.label}, the version you're previewing`
                : `Export ${versionLabel(template.head)}, the newest version`
            }
            onClick={() => void exportVersion()}
          >
            <Download className="size-3" />
            Export this version
          </AppButton>
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

type TemplateVersionListProps = Omit<ComponentProps<typeof VersionList>, 'versions'> & {
  templateId: string;
};

function TemplateVersionList({ templateId, ...listProps }: TemplateVersionListProps) {
  const versions = useVersionHistory(templateId);
  return <VersionList versions={versions} {...listProps} />;
}
