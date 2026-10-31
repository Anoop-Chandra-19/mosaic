import {
  startTransition,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  ViewTransition,
} from 'react';
import { Clock, List, X } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { ReadBoundary } from '@/components/ReadBoundary';
import { PAPER_DIMENSIONS_PT } from '@/features/preview/pageGeometry';
import {
  SLIDE_AWAY_MOTION,
  transitionClasses,
} from '@/features/view-transitions/transitionClasses';
import { endHistoryTour } from '@/features/onboarding/history/endHistoryTour';
import { tourTargetProps } from '@/features/onboarding/tourTargets';
import { matchesAction } from '@/features/shortcuts/shortcutBindings';
import { isTypingField } from '@/lib/keyboardShortcuts';
import type { ShortcutId } from '@/lib/shortcutCatalog';
import { cn } from '@/lib/utils';
import { useOverlayStore } from '@/stores/overlayStore';
import { attempt, showToast } from '@/stores/toastStore';
import { readVersion, useTemplateStore, useVersionHistory } from '@/stores/templateStore';
import { useUiStore } from '@/stores/uiStore';
import { useViewPlaceStore } from '@/stores/viewPlaceStore';
import { countChangesByTone } from '@shared/resume/changes/resumeChange';
import type { TemplateSummary, Version, VersionMeta } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import type { HistoryComparison, HistoryFilter, ReadPaneView } from '@/types/history';
import { VersionList, type HistoryReveal } from '../version-list/VersionList';
import { versionLabel } from '@/lib/versionLabel';
import {
  buildExampleHistory,
  EXAMPLE_OPENING_ID,
  EXAMPLE_TEMPLATE_ID,
  EXAMPLE_TEMPLATE_NAME,
} from './exampleHistory';
import { HistoryIndex } from './HistoryIndex';
import { HistoryReadPane, LEGIBLE_PAGE_SCALE } from './HistoryReadPane';
import { HistorySettingsPopover } from './HistorySettingsPopover';
import { useSkimming } from './useSkimming';
import { useVersionComparison } from './useVersionComparison';
import type { VersionStep } from './useVersionStepMotion';
import {
  chooseOpeningVersion,
  findComparedBase,
  hasRevisions,
  prepareHistoryOpening,
  readVersionPair,
  resolveComparison,
  type VersionReader,
  type PreparedHistory,
  type VersionPair,
} from './prepareHistoryOpening';

/** The index is the first thing to give up its width; below this it starts folded. */
const INDEX_OPEN_MIN_WINDOW_PX = 1180;
const INDEX_WIDTH_PX = 204;
/** The list never gets narrower than this. */
const LIST_MIN_WIDTH_PX = 320;

/** Newest first, so an older version is further down the list. */
const VERSION_STEPS: { id: ShortcutId; offset: number }[] = [
  { id: 'olderVersion', offset: 1 },
  { id: 'newerVersion', offset: -1 },
];

/**
 * How a step brings its row into view: not at all (clicked, so already there), centered (a
 * jump from the index), or just enough (↑/↓ to the row beside).
 */
type RevealKind = 'none' | 'jump' | 'nearby';

interface FullHistoryProps {
  /** The surface that opened it: what it first shows is loaded once per opening. */
  opening: object;
  templateId: string;
  filter?: HistoryFilter;
  versionId?: string;
  comparison?: HistoryComparison;
  view?: ReadPaneView;
}

const OPENING_KEYS = new WeakMap<object, number>();
let nextOpeningKey = 0;

/** Each opening, a jump to another version included, starts the view afresh. */
function keyOpening(opening: object): number {
  let key = OPENING_KEYS.get(opening);
  if (key === undefined) {
    key = nextOpeningKey++;
    OPENING_KEYS.set(opening, key);
  }
  return key;
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
  view,
}: FullHistoryProps) {
  const prepared = use(prepareHistoryOpening(opening, templateId, versionId));
  const template = useTemplateStore((s) => s.templates.find((t) => t.id === templateId));
  const closeSurface = useOverlayStore((s) => s.closeSurface);
  const isTouring = useOverlayStore((s) => s.tour?.kind === 'history');

  // The template went away under the view, as a restore of all templates can do.
  useEffect(() => {
    if (!template) closeSurface('history');
  }, [template, closeSurface]);

  if (!template) return null;
  // The history tour shows the example; leaving the tour brings this template's back.
  if (isTouring) return <ExampleHistoryFrame key="example" />;
  return (
    <ReadBoundary
      key={`${templateId}-${keyOpening(opening)}`}
      failure="Could not read the history"
      onFailure={() => {
        showToast('Could not open the history', 'error');
        closeSurface('history');
      }}
    >
      <TemplateHistoryFrame
        template={template}
        filter={filter}
        versionId={versionId}
        comparison={comparison}
        view={view}
        prepared={prepared}
      />
    </ReadBoundary>
  );
}

/** Where the view's versions come from: a template's history, or the tour's example. */
interface HistorySource {
  templateId: string;
  name: string;
  /** Newest first; null while they load. */
  versions: VersionMeta[] | null;
  readVersion: VersionReader;
  /** The example compares with its own draft, and nothing in it can be changed. */
  example: { draft: ResumeData } | null;
}

interface TemplateHistoryFrameProps {
  template: TemplateSummary;
  filter?: HistoryFilter;
  versionId?: string;
  comparison?: HistoryComparison;
  view?: ReadPaneView;
  prepared: PreparedHistory | null;
}

function TemplateHistoryFrame({ template, prepared, ...rest }: TemplateHistoryFrameProps) {
  const versions = useVersionHistory(template.id);
  const source: HistorySource = {
    templateId: template.id,
    name: template.name,
    versions,
    readVersion,
    example: null,
  };
  return <FullHistoryFrame source={source} prepared={prepared} {...rest} />;
}

function ExampleHistoryFrame() {
  const [example] = useState(() => buildExampleHistory());
  const source: HistorySource = {
    templateId: EXAMPLE_TEMPLATE_ID,
    name: EXAMPLE_TEMPLATE_NAME,
    versions: example.versions,
    readVersion: async (id) => example.readVersion(id),
    example: { draft: example.draft },
  };
  return <FullHistoryFrame source={source} versionId={EXAMPLE_OPENING_ID} prepared={null} />;
}

interface FullHistoryFrameProps {
  source: HistorySource;
  filter?: HistoryFilter;
  versionId?: string;
  comparison?: HistoryComparison;
  view?: ReadPaneView;
  prepared: PreparedHistory | null;
}

function FullHistoryFrame({
  source,
  filter,
  versionId,
  comparison,
  view,
  prepared,
}: FullHistoryFrameProps) {
  const { versions, readVersion } = source;
  const isExample = source.example !== null;
  const closeSurface = useOverlayStore((s) => s.closeSurface);
  const restoreVersion = useTemplateStore((s) => s.restoreVersion);
  const duplicateVersion = useTemplateStore((s) => s.duplicateVersion);
  const openDialog = useOverlayStore((s) => s.openDialog);
  const paperSize = useUiStore((s) => s.paperSize);
  const isDetailed = useUiStore((s) => s.shouldShowHistoryDetails);
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [readView, setReadView] = useState<ReadPaneView>(view ?? 'page');
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
  // A deleted selection moves to the version that took its place in the list, not the newest.
  const [lastIndex, setLastIndex] = useState(0);
  const found = versions?.find((version) => version.id === readId);
  const selected = found ?? versions?.[Math.min(lastIndex, versions.length - 1)];
  const selectedIndex = selected && versions ? versions.indexOf(selected) : -1;
  if (found && selectedIndex !== lastIndex) setLastIndex(selectedIndex);
  const pickedComparison = openedComparison ?? storedComparison;
  const shownComparison = resolveComparison(pickedComparison, versions ?? [], selectedIndex);
  const base = versions ? findComparedBase(versions, selectedIndex, shownComparison) : null;
  // The documents of the version being read and the one it is compared with: the pair the
  // view opened on, then each read before its step lands, so the page and what changed in
  // it land together. Only ever the one pair, so nothing piles up while the view is open.
  const [docs, setDocs] = useState<VersionPair>(prepared?.opening ?? { version: null, base: null });
  const latestStep = useRef(0);
  const shownId = useRef(selected?.id);
  // The version last asked for, which keys step on from: the shown one changes only once
  // its read lands, and counting from it would repeat or lose steps.
  const askedId = useRef(selected?.id);
  const [lastStep, setLastStep] = useState<VersionStep | null>(null);
  const { isSkimming, noteStep } = useSkimming();
  const drawNewest = useNewestEachFrame();
  // Worked out once, for the read pane and the selected row's counts.
  const versionComparison = useVersionComparison({
    templateId: source.templateId,
    fixedDraft: source.example?.draft ?? null,
    version: docs.version?.id === selected?.id ? docs.version : null,
    base,
    baseVersion: docs.base?.id === base?.id ? docs.base : null,
    baseLabel: base ? versionLabel(base) : '',
    comparison: shownComparison,
    hasParent: !!versions?.[selectedIndex + 1],
  });

  // Where the reader is, for the view's address. The example's place is the tour's.
  const baseLabel = shownComparison === 'draft' ? 'draft' : base ? versionLabel(base) : null;
  const selectedLabel = selected ? versionLabel(selected) : null;
  useEffect(() => {
    if (isExample || !selectedLabel) return;
    useViewPlaceStore.setState({
      history: { version: selectedLabel, base: baseLabel, reading: readView },
    });
  }, [isExample, selectedLabel, baseLabel, readView]);
  useEffect(() => () => useViewPlaceStore.setState({ history: null }), []);

  // When the view couldn't read its first version ahead of opening, the history list
  // changed under it, or another comparison was picked, read the selected one now.
  const isPairRead =
    docs.version?.id === selected?.id && (docs.base?.id ?? null) === (base?.id ?? null);
  useEffect(() => {
    if (!selected || !versions || isPairRead) return;
    let isCurrent = true;
    readVersionPair(versions, selected.id, shownComparison, readVersion).then(
      (read) => isCurrent && setDocs(read),
      (error: unknown) => console.error('Could not read that version', error)
    );
    return () => {
      isCurrent = false;
    };
  }, [selected, versions, isPairRead, shownComparison, readVersion]);
  // A step through time: the version is read first, then the list row, the header and the
  // page change together, and the page's words come in the way the history runs (older from
  // the left). Not a view transition, which would hold back the next key. The newest read
  // to land is drawn, once a frame, so a held key passes over versions rather than queueing.
  const step = (version: VersionMeta, reveal: RevealKind, isRepeat = false) => {
    const ticket = ++latestStep.current;
    askedId.current = version.id;
    noteStep(isRepeat);
    const show = (read: VersionPair) =>
      drawNewest(ticket, () => {
        if (!versions) return;
        const from = versions.findIndex(({ id }) => id === shownId.current);
        const to = versions.indexOf(version);
        shownId.current = version.id;
        // Newest first, so a version further down the list is older: a step back.
        if (from >= 0 && to >= 0 && from !== to) {
          setLastStep({ versionId: version.id, direction: to > from ? -1 : 1 });
        }
        setSelectedId(version.id);
        setDocs(read);
        if (reveal !== 'none') setReveal({ versionId: version.id, isNearby: reveal === 'nearby' });
      });
    if (!versions) return;
    const stepComparison = resolveComparison(pickedComparison, versions, versions.indexOf(version));
    readVersionPair(versions, version.id, stepComparison, readVersion).then(
      show,
      (error: unknown) => {
        // Still selected, so the list and the pane agree on which version this is.
        console.error('Could not read that version', error);
        showToast('Could not read that version', 'error');
        show({ version: null, base: null });
      }
    );
  };
  const select = (version: VersionMeta) => step(version, 'none');
  const goTo = (version: VersionMeta) => step(version, 'jump');

  // ↑ and ↓ step through the versions, unless something else has the key.
  const onArrowKey = useEffectEvent((event: KeyboardEvent) => {
    if (!versions || event.defaultPrevented || isTypingField(event.target)) return;
    const offset = VERSION_STEPS.find(({ id }) => matchesAction(event, id))?.offset;
    if (!offset) return;
    const asked = versions.findIndex(({ id }) => id === askedId.current);
    const next = versions[(asked >= 0 ? asked : selectedIndex) + offset];
    if (!next) return;
    event.preventDefault();
    step(next, 'nearby', event.repeat);
  });
  useEffect(() => {
    window.addEventListener('keydown', onArrowKey);
    return () => window.removeEventListener('keydown', onArrowKey);
  }, []);

  const indexWidth = isIndexOpen ? INDEX_WIDTH_PX : 0;
  const maxReadWidth = windowWidth - indexWidth - LIST_MIN_WIDTH_PX;
  const pageNeedsPx = LEGIBLE_PAGE_SCALE * PAPER_DIMENSIONS_PT[paperSize].width + 48;

  const restore = async (version: VersionMeta) => {
    if (isExample) return;
    if (
      await attempt(restoreVersion(source.templateId, version.id), 'Could not restore that version')
    ) {
      // What is behind the view just changed, so the view gives way to it.
      onClose();
      showToast(`Restored “${version.summary}”`);
    }
  };

  const duplicate = async (version: VersionMeta) => {
    if (isExample) return;
    try {
      const copy = await duplicateVersion(version.id);
      showToast(`Duplicated as “${copy.name}”`);
    } catch (error) {
      console.error(error);
      showToast('Could not duplicate the template', 'error');
    }
  };

  const exportVersion = (version: Version, label: string) =>
    openDialog({ kind: 'export', version: { version, label, templateName: source.name } });

  const namedCount = versions?.filter((version) => version.kind === 'named').length ?? 0;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-label={`History of ${source.name}`}
      className="absolute inset-0 z-30 flex flex-col bg-background outline-none @container/full-history"
    >
      <header className="flex h-11.5 shrink-0 items-center gap-2.5 border-b border-line bg-chrome pr-2.5 pl-3.5">
        <Clock aria-hidden className="size-3.75 text-ink-muted" />
        <Text as="h2" variant="title">
          History
        </Text>
        <span aria-hidden className="text-ink-faint">
          ·
        </span>
        <Text variant="body" className="min-w-0 truncate">
          {source.name}
        </Text>
        {versions && (
          <Text
            variant="meta"
            className="ml-1 hidden whitespace-nowrap @min-[56rem]/full-history:inline"
          >
            {versions.length.toLocaleString()} versions · {namedCount} named
          </Text>
        )}
        <span className="flex-1" />
        <HistorySettingsPopover isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
        <AppButton
          variant="ghost"
          size="sm"
          shape="square"
          aria-label={isIndexOpen ? 'Hide the index' : 'Show named versions and months'}
          aria-pressed={isIndexOpen}
          onClick={() => startTransition(() => setIsIndexOpen((open) => !open))}
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
      {isExample && (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line bg-pane-raised py-1.5 pr-2.5 pl-3.5">
          <Text
            variant="tag"
            className="rounded-[0.25rem] border border-line-strong px-1.25 py-px text-ink-soft"
          >
            Example
          </Text>
          <Text variant="secondary" className="min-w-0 flex-1 text-ink-soft">
            An example history, so every kind of row is there to see. Your own versions are
            untouched.
          </Text>
          <AppButton variant="ghost" size="xs" onClick={() => endHistoryTour()}>
            Back to your history
          </AppButton>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {isIndexOpen && versions && (
          <ViewTransition
            enter={SLIDE_AWAY_MOTION.start.in}
            exit={SLIDE_AWAY_MOTION.start.out}
            update="none"
          >
            <HistoryIndex
              versions={versions}
              selectedId={selected?.id ?? null}
              onGoTo={goTo}
              shouldShowMonths={isDetailed}
            />
          </ViewTransition>
        )}
        {/* The same ground as the sidebar's history, which its sticky headers are painted in. */}
        <div
          {...tourTargetProps('historyList')}
          className={cn(
            'min-w-80 flex-1 overflow-auto bg-background px-4 pb-6',
            transitionClasses({ name: 'history-list', motion: 'reclaim' })
          )}
        >
          {/* Padding above the scrolled content, not the box: rows would show above the
              pinned strip through the box's own padding. */}
          <div className="max-w-180 pt-1">
            {versions ? (
              <VersionList
                versions={versions}
                isWide
                isReadOnly={isExample}
                initialFilter={filter}
                reveal={reveal}
                onSelect={select}
                canPreview
                previewId={selected?.id ?? null}
                onPreview={select}
                onRestore={(version) => void restore(version)}
                onDuplicate={(version) => void duplicate(version)}
                onChangeFolding={() => setIsSettingsOpen(true)}
                selectedCounts={
                  isDetailed && !versionComparison.isAgainstDraft && versionComparison.diff
                    ? countChangesByTone(versionComparison.diff.changes)
                    : null
                }
              />
            ) : (
              <Text as="p" variant="secondary" className="mt-3 text-ink-faint">
                Loading history…
              </Text>
            )}
          </div>
        </div>
        {versions && selected && (
          <HistoryReadPane
            version={selected}
            label={versionLabel(selected)}
            numberLabel={hasRevisions(versions, selectedIndex) ? `v${selected.number}` : null}
            isHead={selected.id === versions[0].id}
            isReadOnly={isExample}
            comparison={versionComparison}
            onComparisonChange={pickComparison}
            maxWidthCss={`calc(100vw - ${indexWidth + LIST_MIN_WIDTH_PX}px)`}
            canWidenToPage={maxReadWidth >= pageNeedsPx}
            onRestore={(version) => void restore(version)}
            onDuplicate={(version) => void duplicate(version)}
            onExport={exportVersion}
            docs={docs}
            step={lastStep}
            isSkimming={isSkimming}
            view={readView}
            onViewChange={setReadView}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Draws the newest of what is offered, at most once a frame. Offers rank by `ticket`, and
 * one older than what was last drawn is dropped: reads land out of order, and faster than
 * a page can be drawn.
 */
function useNewestEachFrame() {
  const pending = useRef<{ ticket: number; draw: () => void } | null>(null);
  const drawnTicket = useRef(0);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return (ticket: number, draw: () => void) => {
    if (ticket <= drawnTicket.current || ticket < (pending.current?.ticket ?? 0)) return;
    pending.current = { ticket, draw };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const next = pending.current;
      pending.current = null;
      if (!next) return;
      drawnTicket.current = next.ticket;
      next.draw();
    });
  };
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
