import {
  addTransitionType,
  startTransition,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { Clock, List, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { PAPER_DIMENSIONS_PT } from '@/features/preview/pageGeometry';
import { TRANSITION_TYPE } from '@/features/view-transitions/transitionClasses';
import { isTypingField } from '@/lib/keyboardShortcuts';
import { cn } from '@/lib/utils';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import type { TemplateSummary, Version, VersionMeta } from '@shared/types/db';
import type { HistoryComparison, HistoryFilter } from '@/types/history';
import { VersionList, type HistoryReveal } from '../version-list/VersionList';
import { useTemplateVersions, versionLabel } from '../useTemplateVersions';
import { HistoryIndex } from './HistoryIndex';
import { HistoryReadPane, LEGIBLE_PAGE_SCALE } from './HistoryReadPane';
import {
  chooseOpeningVersion,
  prepareHistoryOpening,
  readVersionPair,
  type PreparedHistory,
  type VersionPair,
} from './prepareHistoryOpening';

/** The index is the first thing to give up its width; below this it starts folded. */
const INDEX_OPEN_MIN_WINDOW_PX = 1180;
const INDEX_WIDTH_PX = 204;
/** The list never gets narrower than this. */
const LIST_MIN_WIDTH_PX = 320;

/** Newest first, so down is older. */
const ARROW_STEPS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

interface FullHistoryProps {
  /** The surface that opened it: what it first shows is loaded once per opening. */
  opening: object;
  templateId: string;
  filter?: HistoryFilter;
  versionId?: string;
  comparison?: HistoryComparison;
}

/**
 * One template's whole history over the workspace: the named versions and months as a
 * table of contents, the list, and the version being read beside it. It reads any
 * template's history, not only the open one's. It suspends until its first page is
 * loaded, so it opens whole, inside the view transition that brings it in.
 */
export function FullHistory({
  opening,
  templateId,
  filter,
  versionId,
  comparison,
}: FullHistoryProps) {
  const prepared = use(prepareHistoryOpening(opening, templateId, versionId));
  const template = useTemplateStore((s) => s.templates.find((t) => t.id === templateId));
  const closeSurface = useOverlayStore((s) => s.closeSurface);

  // The template went away under the view, as a restore of all templates can do.
  useEffect(() => {
    if (!template) closeSurface('history');
  }, [template, closeSurface]);

  if (!template) return null;
  return (
    <FullHistoryFrame
      key={templateId}
      template={template}
      filter={filter}
      versionId={versionId}
      comparison={comparison}
      prepared={prepared}
    />
  );
}

interface FullHistoryFrameProps {
  template: TemplateSummary;
  filter?: HistoryFilter;
  versionId?: string;
  comparison?: HistoryComparison;
  prepared: PreparedHistory | null;
}

function FullHistoryFrame({
  template,
  filter,
  versionId,
  comparison,
  prepared,
}: FullHistoryFrameProps) {
  const versions = useTemplateVersions(template, true, prepared?.versions);
  const closeSurface = useOverlayStore((s) => s.closeSurface);
  const restoreVersion = useTemplateStore((s) => s.restoreVersion);
  const duplicateVersion = useTemplateStore((s) => s.duplicateVersion);
  const openExport = useOverlayStore((s) => s.openExport);
  const paperSize = useUiStore((s) => s.paperSize);
  const isDetailed = useUiStore((s) => s.shouldShowHistoryDetails);
  const setIsDetailed = useUiStore((s) => s.setShouldShowHistoryDetails);
  const storedComparison = useUiStore((s) => s.historyComparison);
  const setStoredComparison = useUiStore((s) => s.setHistoryComparison);
  // Opened from a version being read, the view keeps to that comparison until one is picked.
  const [openedComparison, setOpenedComparison] = useState(comparison);
  const pickComparison = (picked: HistoryComparison) => {
    setOpenedComparison(undefined);
    setStoredComparison(picked);
  };
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

  const readId = selectedId ?? (versions && chooseOpeningVersion(versions, versionId));
  const selected = versions?.find((version) => version.id === readId) ?? versions?.[0];
  const selectedIndex = selected && versions ? versions.indexOf(selected) : -1;
  const parent = (selectedIndex >= 0 && versions?.[selectedIndex + 1]) || null;
  // The documents of the version being read and the one before it: the pair the view
  // opened on, then each read before its step lands, so the page and what changed in it
  // land together. Only ever the one pair, so nothing piles up while the view is open.
  const [docs, setDocs] = useState<VersionPair>(
    prepared?.opening ?? { version: null, parent: null }
  );
  const latestStep = useRef(0);
  const shownId = useRef(selected?.id);

  // When the view couldn't read its first version ahead of opening, or the history list
  // changed under it, read the selected one now.
  const isPairRead =
    docs.version?.id === selected?.id && (docs.parent?.id ?? null) === (parent?.id ?? null);
  useEffect(() => {
    if (!selected || !versions || isPairRead) return;
    let isCurrent = true;
    readVersionPair(versions, selected.id).then(
      (read) => isCurrent && setDocs(read),
      (error: unknown) => console.error('Could not read that version', error)
    );
    return () => {
      isCurrent = false;
    };
  }, [selected, versions, isPairRead]);
  const labelOf = (version: VersionMeta) =>
    versions ? versionLabel(versions, versions.indexOf(version)) : '';
  // A step through time: the page slides the way the history runs, older to the left. The
  // version is read first, so the slide lands on its page rather than an empty pane. Only
  // the latest step lands: reads can finish out of order, and a slower one must not win.
  const step = (version: VersionMeta, shouldReveal: boolean) => {
    const ticket = ++latestStep.current;
    const show = (read: VersionPair) => {
      if (ticket !== latestStep.current || !versions) return;
      const from = versions.findIndex(({ id }) => id === shownId.current);
      const to = versions.indexOf(version);
      shownId.current = version.id;
      startTransition(() => {
        if (from >= 0 && to >= 0 && from !== to) {
          // Older versions sit back in time, so a step to one is a step back.
          addTransitionType(to > from ? TRANSITION_TYPE.stepBack : TRANSITION_TYPE.stepForward);
        }
        setSelectedId(version.id);
        setDocs(read);
        if (shouldReveal) setReveal({ versionId: version.id });
      });
    };
    if (!versions) return;
    readVersionPair(versions, version.id).then(show, (error: unknown) => {
      // Still selected, so the list and the pane agree on which version this is.
      console.error('Could not read that version', error);
      showToast('Could not read that version', 'error');
      show({ version: null, parent: null });
    });
  };
  const select = (version: VersionMeta) => step(version, false);
  const goTo = (version: VersionMeta) => step(version, true);

  // ↑ and ↓ step through the versions, unless something else has the key.
  const onArrowKey = useEffectEvent((event: KeyboardEvent) => {
    const offset = ARROW_STEPS[event.key];
    if (!offset || !versions || event.defaultPrevented || isTypingField(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const next = versions[selectedIndex + offset];
    if (!next) return;
    event.preventDefault();
    goTo(next);
  });
  useEffect(() => {
    window.addEventListener('keydown', onArrowKey);
    return () => window.removeEventListener('keydown', onArrowKey);
  }, []);

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
      className="absolute inset-0 z-30 flex flex-col bg-background outline-none @container/full-history"
    >
      <header className="flex h-11.5 shrink-0 items-center gap-2.5 border-b border-line bg-card pr-2.5 pl-3.5">
        <Clock aria-hidden className="size-3.75 text-ink-muted" />
        <h2 className="text-[0.84375rem] font-semibold tracking-[-0.01em]">History</h2>
        <span aria-hidden className="text-ink-faint">
          ·
        </span>
        <span className="min-w-0 truncate text-[0.8125rem] text-ink-soft">{template.name}</span>
        {versions && (
          <span className="ml-1 hidden font-mono text-[0.71875rem] whitespace-nowrap text-ink-faint @min-[56rem]/full-history:inline">
            {versions.length.toLocaleString()} versions · {namedCount} named
          </span>
        )}
        <span className="flex-1" />
        <AppTooltip content="The months index, symbol counts, and line numbers in Changes only">
          <label className="flex cursor-pointer items-center gap-1.5 px-1.5 text-xs text-ink-muted select-none">
            <Checkbox
              checked={isDetailed}
              onCheckedChange={(checked) => setIsDetailed(checked === true)}
              className="size-3.5"
            />
            Show all details
          </label>
        </AppTooltip>
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
            shouldShowMonths={isDetailed}
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
            parent={parent}
            parentLabel={parent ? labelOf(parent) : ''}
            isHead={selected.id === versions[0].id}
            comparison={openedComparison ?? storedComparison}
            onComparisonChange={pickComparison}
            maxWidthCss={`calc(100vw - ${indexWidth + LIST_MIN_WIDTH_PX}px)`}
            canWidenToPage={maxReadWidth >= pageNeedsPx}
            onRestore={(version) => void restore(version)}
            onDuplicate={(version) => void duplicate(version)}
            onExport={exportVersion}
            docs={docs}
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
