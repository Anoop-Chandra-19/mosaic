import { use, useEffect, useRef, useState } from 'react';
import { Clock, List, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { PAPER_DIMENSIONS_PT } from '@/features/preview/pageGeometry';
import { cn } from '@/lib/utils';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import type { TemplateSummary, Version, VersionMeta } from '@shared/types/db';
import type { HistoryFilter } from './filterVersionHistory';
import { HistoryIndex } from './HistoryIndex';
import { HistoryReadPane, LEGIBLE_PAGE_SCALE } from './HistoryReadPane';
import { prepareHistoryOpening, type PreparedHistory } from './prepareHistoryOpening';
import { useTemplateVersions, versionLabel } from './useTemplateVersions';
import { VersionList, type HistoryReveal } from './VersionList';

/** The index is the first thing to give up its width; below this it starts folded. */
const INDEX_OPEN_MIN_WINDOW_PX = 1180;
const INDEX_WIDTH_PX = 204;
/** The list never gets narrower than this. */
const LIST_MIN_WIDTH_PX = 320;

interface HistoryWindowProps {
  /** The surface that opened it: what it first shows is loaded once per opening. */
  opening: object;
  templateId: string;
  filter?: HistoryFilter;
  versionId?: string;
}

/**
 * One template's whole history over the workspace: the named versions and months as a
 * table of contents, the list, and the version being read beside it. It reads any
 * template's history, not only the open one's. It suspends until its first page is
 * loaded, so it opens whole, inside the view transition that brings it in.
 */
export function HistoryWindow({ opening, templateId, filter, versionId }: HistoryWindowProps) {
  const prepared = use(prepareHistoryOpening(opening, templateId, versionId));
  const template = useTemplateStore((s) => s.templates.find((t) => t.id === templateId));
  const closeSurface = useOverlayStore((s) => s.closeSurface);

  // The template went away under the view, as a restore of all templates can do.
  useEffect(() => {
    if (!template) closeSurface('history');
  }, [template, closeSurface]);

  if (!template) return null;
  return (
    <HistoryWindowFrame
      key={templateId}
      template={template}
      filter={filter}
      versionId={versionId}
      prepared={prepared}
    />
  );
}

interface HistoryWindowFrameProps {
  template: TemplateSummary;
  filter?: HistoryFilter;
  versionId?: string;
  prepared: PreparedHistory | null;
}

function HistoryWindowFrame({ template, filter, versionId, prepared }: HistoryWindowFrameProps) {
  const versions = useTemplateVersions(template, true, prepared?.versions);
  const closeSurface = useOverlayStore((s) => s.closeSurface);
  const restoreVersion = useTemplateStore((s) => s.restoreVersion);
  const duplicateVersion = useTemplateStore((s) => s.duplicateVersion);
  const openExport = useOverlayStore((s) => s.openExport);
  const paperSize = useUiStore((s) => s.paperSize);
  const windowWidth = useWindowWidth();
  const [isIndexOpen, setIsIndexOpen] = useState(
    () => window.innerWidth >= INDEX_OPEN_MIN_WINDOW_PX
  );
  const [selectedId, setSelectedId] = useState(versionId ?? null);
  const [reveal, setReveal] = useState<HistoryReveal | null>(versionId ? { versionId } : null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Focus comes into the view, and goes back to whatever opened it.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rootRef.current?.focus();
    // A menu that opened the view hands focus back to its trigger as it closes, and that
    // trigger is inert now, so focus drops to the page. Take it once the menu is done.
    const frame = requestAnimationFrame(() => {
      if (!rootRef.current?.contains(document.activeElement)) rootRef.current?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  // Escape closes the view last: an open menu, a dialog, or the search row takes it first,
  // and each of those marks the key as handled.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) closeSurface('history');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeSurface]);
  const onClose = () => closeSurface('history');

  const selected = versions?.find((version) => version.id === selectedId) ?? versions?.[0];
  const labelOf = (version: VersionMeta) =>
    versions ? versionLabel(versions, versions.indexOf(version)) : '';
  const select = (version: VersionMeta) => setSelectedId(version.id);
  const goTo = (version: VersionMeta) => {
    setSelectedId(version.id);
    setReveal({ versionId: version.id });
  };

  const indexWidth = isIndexOpen ? INDEX_WIDTH_PX : 0;
  const maxReadWidth = windowWidth - indexWidth - LIST_MIN_WIDTH_PX;
  const pageNeedsPx = LEGIBLE_PAGE_SCALE * PAPER_DIMENSIONS_PT[paperSize].width + 48;

  const restore = async (version: VersionMeta) => {
    if (await attempt(restoreVersion(template.id, version.id), 'Could not restore that version')) {
      // What is behind the view just changed, so the view gives way to it.
      onClose();
      showToast(`Restored “${version.summary}”`);
    }
  };

  const duplicate = async (version: VersionMeta) => {
    try {
      const copy = await duplicateVersion(version.id);
      showToast(`Duplicated as “${copy.name}”`);
    } catch (error) {
      console.error(error);
      showToast('Could not duplicate the template', 'error');
    }
  };

  const exportVersion = (version: Version, label: string) =>
    openExport({ version, label, templateName: template.name });

  const namedCount = versions?.filter((version) => version.kind === 'named').length ?? 0;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label={`History of ${template.name}`}
      className="absolute inset-0 z-30 flex flex-col bg-background outline-none @container/history-window"
    >
      <header className="flex h-11.5 shrink-0 items-center gap-2.5 border-b border-line bg-card pr-2.5 pl-3.5">
        <Clock aria-hidden className="size-3.75 text-ink-muted" />
        <h2 className="text-[0.84375rem] font-semibold tracking-[-0.01em]">History</h2>
        <span aria-hidden className="text-ink-faint">
          ·
        </span>
        <span className="min-w-0 truncate text-[0.8125rem] text-ink-soft">{template.name}</span>
        {versions && (
          <span className="ml-1 hidden font-mono text-[0.71875rem] whitespace-nowrap text-ink-faint @min-[56rem]/history-window:inline">
            {versions.length.toLocaleString()} versions · {namedCount} named · nothing is ever
            removed
          </span>
        )}
        <span className="flex-1" />
        <AppButton
          variant="ghost"
          size="sm"
          shape="square"
          aria-label={isIndexOpen ? 'Hide the index' : 'Show named versions and months'}
          aria-pressed={isIndexOpen}
          onClick={() => setIsIndexOpen((open) => !open)}
          className={cn('size-6.75', isIndexOpen && 'bg-line-strong text-foreground')}
        >
          <List className="size-3.5" />
        </AppButton>
        <AppButton variant="outline" size="xs" onClick={onClose}>
          Back to the editor
        </AppButton>
        <AppButton
          variant="ghost"
          size="sm"
          shape="square"
          aria-label="Close the history"
          onClick={onClose}
          className="size-6.75"
        >
          <X className="size-3.5" />
        </AppButton>
      </header>

      <div className="flex min-h-0 flex-1">
        {isIndexOpen && versions && (
          <HistoryIndex
            versions={versions}
            selectedId={selected?.id ?? null}
            labelOf={labelOf}
            onGoTo={goTo}
          />
        )}
        {/* The same ground as the sidebar's history, which its sticky headers are painted in. */}
        <div className="min-w-80 flex-1 overflow-auto bg-white px-4 pb-6 dark:bg-zinc-950">
          {/* Padding above the scrolled content, not the box: rows would show above the
              pinned strip through the box's own padding. */}
          <div className="max-w-180 pt-1">
            {versions ? (
              <VersionList
                versions={versions}
                isWide
                initialFilter={filter}
                reveal={reveal}
                onSelect={select}
                canPreview
                previewId={selected?.id ?? null}
                onPreview={select}
                onRestore={(version) => void restore(version)}
                onDuplicate={(version) => void duplicate(version)}
              />
            ) : (
              <p className="mt-3 text-xs text-ink-faint">Loading history…</p>
            )}
          </div>
        </div>
        {versions && selected && (
          <HistoryReadPane
            templateId={template.id}
            version={selected}
            label={labelOf(selected)}
            isHead={selected.id === versions[0].id}
            maxWidthCss={`calc(100vw - ${indexWidth + LIST_MIN_WIDTH_PX}px)`}
            canWidenToPage={maxReadWidth >= pageNeedsPx}
            onRestore={(version) => void restore(version)}
            onDuplicate={(version) => void duplicate(version)}
            onExport={exportVersion}
            initialVersion={prepared?.version ?? null}
          />
        )}
      </div>
    </div>
  );
}

function useWindowWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const sync = () => setWidth(window.innerWidth);
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  return width;
}
