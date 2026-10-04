import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { Copy, Download, History } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { Text } from '@/components/Text';
import { ChangeList } from '@/features/document-diff/ChangeList';
import { MarkedVersionText } from '@/features/document-diff/MarkedVersionText';
import { collectPageMarks, putGoneBack } from '@/features/document-diff/pageMarks';
import { revealChangeMark } from '@/features/document-diff/revealChangeMark';
import { UnifiedDiff } from '@/features/document-diff/UnifiedDiff';
import { PAPER_DIMENSIONS_PT } from '@/features/preview/pageGeometry';
import { useOwnPageZoom, type PageZoom } from '@/features/preview/pageZoom';
import { ResumePreview } from '@/features/preview/ResumePreview';
import { usePreviewCanvas, type PreviewCanvas } from '@/features/preview/usePreviewCanvas';
import { startPaneResize } from '@/features/shell/paneResize';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { matchesAction } from '@/features/shortcuts/shortcutBindings';
import { isTypingField } from '@/lib/keyboardShortcuts';
import type { ShortcutId } from '@/lib/shortcutCatalog';
import { easeHeightChanges } from '@/lib/motion/easeHeightChanges';
import { cn } from '@/lib/utils';
import { HISTORY_READ_WIDTH, PREVIEW_DEFAULT_ZOOM, useUiStore } from '@/stores/uiStore';
import type { ResumeDiff } from '@shared/resume/changes/diffResumes';
import type { Version, VersionMeta, VersionSource } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import type { HistoryComparison } from '@/types/history';
import { formatHistoryDay, formatTimeOfDay } from '../groupVersionHistory';
import type { VersionPair } from './prepareHistoryOpening';
import { ReadPaneControls, type ReadPaneView } from './ReadPaneControls';
import { findReadingPlace, restoreReadingPlace, type ReadingPlace } from './readingPlace';
import type { VersionComparison } from './useVersionComparison';
import { VersionAsText } from './VersionAsText';

/** Below this the page is a thumbnail, not something to read, so the pane shows text. */
export const LEGIBLE_PAGE_SCALE = 0.66;
/** The body's padding either side of the page. */
const PAGE_GUTTER_PX = 24;

const AUTOMATIC_REASONS: Partial<Record<VersionSource, string>> = {
  import: 'import',
  restore: 'before restore',
  create: 'new template',
  duplicate: 'duplicate',
  switched: 'left off',
  closed: 'left off',
};

interface HistoryReadPaneProps {
  version: VersionMeta;
  label: string;
  isHead: boolean;
  /** The version against the one before it or the draft, as picked; the list shares it. */
  comparison: VersionComparison;
  onComparisonChange: (comparison: HistoryComparison) => void;
  /** The widest the pane may get, for saying whether widening it would help. */
  maxWidthCss: string;
  canWidenToPage: boolean;
  onRestore: (version: VersionMeta) => void;
  onDuplicate: (version: VersionMeta) => void;
  onExport: (version: Version, label: string) => void;
  /** The version's document and its parent's, read by the view before it selected them. */
  docs: VersionPair;
}

const ignorePreviewMeta = () => {};

/** The live preview's zoom keys, for the page being read. */
const ZOOM_SHORTCUTS: { id: ShortcutId; run: (canvas: PreviewCanvas) => void }[] = [
  { id: 'zoomIn', run: (canvas) => canvas.zoomByStep(1) },
  { id: 'zoomOut', run: (canvas) => canvas.zoomByStep(-1) },
  { id: 'fitPage', run: (canvas) => canvas.resetZoom() },
];

function describeDraftDistance(changeCount: number, hasFormatting: boolean): string {
  if (changeCount > 0) {
    return `${changeCount} printed ${changeCount === 1 ? 'line differs' : 'lines differ'} from your draft`;
  }
  return hasFormatting ? 'same words as your draft, formatting differs' : 'identical to your draft';
}

function describeRestore(isHead: boolean, isIdentical: boolean): string {
  if (isHead) return 'This is the newest version';
  if (isIdentical) return 'Your draft already matches this version';
  return 'Restore this version. Your current draft is saved to history first.';
}

function TextReadNote({ text, onShowPage }: { text: string; onShowPage: () => void }) {
  return (
    <Text
      as="p"
      variant="meta"
      className="mt-1 mb-3.5 flex flex-wrap items-center gap-2.5 rounded-sm border border-line px-2.5 py-2"
    >
      <span className="min-w-40 flex-1">{text}</span>
      <AppButton variant="outline" size="2xs" onClick={onShowPage}>
        Show the page
      </AppButton>
    </Text>
  );
}

interface VersionPageProps {
  version: Version;
  /** What it is compared with, and what changed: with marks on, drawn on the page. */
  base: ResumeData | null;
  diff: ResumeDiff | null;
  otherSide: string;
  isMarked: boolean;
  isTextRead: boolean;
  textReadNote: string;
  onShowPage: () => void;
  zoom: number;
  onLaidOut: () => void;
}

/** The version as the printed page, or as text when the pane is too narrow to read one. */
function VersionPage({
  version,
  base,
  diff,
  otherSide,
  isMarked,
  isTextRead,
  textReadNote,
  onShowPage,
  zoom,
  onLaidOut,
}: VersionPageProps) {
  const paperSize = useUiStore((s) => s.paperSize);
  const marked = isMarked && diff && base && diff.all.length > 0 ? { diff, base } : null;
  const note = <TextReadNote text={textReadNote} onShowPage={onShowPage} />;
  if (isTextRead) {
    return marked ? (
      <MarkedVersionText diff={marked.diff} otherSide={otherSide} note={note} />
    ) : (
      <VersionAsText resume={version.doc} note={note} />
    );
  }
  return (
    <div style={{ paddingInline: PAGE_GUTTER_PX }}>
      <ResumePreview
        paperSize={paperSize}
        previewZoom={zoom}
        doc={marked ? putGoneBack(version.doc, marked.base, marked.diff.all) : version.doc}
        marks={marked ? collectPageMarks(marked.diff.all, otherSide) : undefined}
        onMetaChange={ignorePreviewMeta}
        onLaidOut={onLaidOut}
      />
    </div>
  );
}

/**
 * The version being read, beside the list: what changed in it, then the version as the
 * printed page, as text when the pane is too narrow, or as only the lines that differ.
 */
export function HistoryReadPane({
  version,
  label,
  isHead,
  comparison,
  onComparisonChange,
  maxWidthCss,
  canWidenToPage,
  onRestore,
  onDuplicate,
  onExport,
  docs,
}: HistoryReadPaneProps) {
  const widthPx = useUiStore((s) => s.historyReadWidthPx);
  const setWidthPx = useUiStore((s) => s.setHistoryReadWidthPx);
  const paperSize = useUiStore((s) => s.paperSize);
  const isDetailed = useUiStore((s) => s.shouldShowHistoryDetails);
  const paneRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  const [view, setView] = useState<ReadPaneView>('page');
  const [isMarked, setIsMarked] = useState(true);
  /** Chosen over the text read in a narrow pane. */
  const [isPageChosen, setIsPageChosen] = useState(false);
  /**
   * The change list opened or closed by hand, kept through every step. Until then it is
   * one line, opened only when formatting is all that changed.
   */
  const [listChoice, setListChoice] = useState<'open' | 'closed' | null>(null);
  const loaded = docs.version?.id === version.id ? docs.version : null;
  const { diff, formatting, otherSide, draftChangeCount, hasDraftFormatting } = comparison;

  // Before paint, so the view transition that opens the pane captures the right choice
  // of page or text.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const sync = () => setBodyWidth(body.clientWidth);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  // The change stepped to starts over for each version and each comparison.
  const cursorKey = `${version.id}:${otherSide}`;
  const [cursorAt, setCursorAt] = useState({ key: cursorKey, index: 0 });
  const cursor = cursorAt.key === cursorKey ? cursorAt.index : 0;
  const changes = diff?.changes ?? [];
  const goToChange = (index: number) => {
    if (changes.length === 0) return;
    const wrapped = (index + changes.length) % changes.length;
    setCursorAt({ key: cursorKey, index: wrapped });
    revealChangeMark(bodyRef.current, changes[wrapped]);
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || isTypingField(event.target)) return;
    if (matchesAction(event, 'nextChange')) goToChange(cursor + 1);
    if (matchesAction(event, 'previousChange')) goToChange(cursor - 1);
  });
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isIdentical = draftChangeCount === 0 && !hasDraftFormatting;
  const isSameAsBase = diff !== null && changes.length === 0 && formatting.length === 0;
  const pageScale = (bodyWidth - PAGE_GUTTER_PX * 2) / PAPER_DIMENSIONS_PT[paperSize].width;
  const isLegible = bodyWidth === 0 || pageScale >= LEGIBLE_PAGE_SCALE;
  const isTextRead = view === 'page' && !isLegible && !isPageChosen;
  const isPageShown = loaded !== null && view === 'page' && !isTextRead;
  const reason = AUTOMATIC_REASONS[version.source];

  const ownZoom = useOwnPageZoom();
  // Zooming in from the text read shows the page instead; zooming out leaves the text.
  const pageZoom: PageZoom = {
    ...ownZoom,
    setZoom: (next) => {
      if (!isTextRead) return ownZoom.setZoom(next);
      if (next <= ownZoom.readZoom()) return ownZoom.readZoom();
      setIsPageChosen(true);
      return ownZoom.setZoom(next);
    },
  };
  const canvas = usePreviewCanvas(bodyRef, pageZoom);
  const onZoomKey = useEffectEvent((event: KeyboardEvent) => {
    if (view !== 'page' || event.defaultPrevented || isTypingField(event.target)) return;
    const shortcut = ZOOM_SHORTCUTS.find(({ id }) => matchesAction(event, id));
    if (!shortcut) return;
    event.preventDefault();
    shortcut.run(canvas);
  });
  useEffect(() => {
    window.addEventListener('keydown', onZoomKey);
    return () => window.removeEventListener('keydown', onZoomKey);
  }, []);
  const readAsText = () => {
    setIsPageChosen(false);
    ownZoom.setZoom(PREVIEW_DEFAULT_ZOOM);
  };

  // The line at the top of the pane, kept there when the page under it changes.
  const readingPlace = useRef<ReadingPlace | null>(null);
  const noteReadingPlace = () => {
    readingPlace.current = bodyRef.current ? findReadingPlace(bodyRef.current) : null;
  };
  const keepReadingPlace = () => {
    if (bodyRef.current && readingPlace.current) {
      restoreReadingPlace(bodyRef.current, readingPlace.current);
    }
  };
  return (
    <aside
      ref={paneRef}
      aria-label={`Reading ${label}`}
      className="relative flex min-h-0 shrink-0 flex-col border-l border-line bg-background"
      style={{ width: `max(${HISTORY_READ_WIDTH.minPx}px, min(${widthPx}px, ${maxWidthCss}))` }}
    >
      <AppTooltip side="left" content="Drag to resize · double-click to reset" shouldFollowPointer>
        <div
          onPointerDown={(event) =>
            startPaneResize(event, {
              pane: paneRef.current,
              anchor: 'right',
              limits: HISTORY_READ_WIDTH,
              onDone: setWidthPx,
            })
          }
          onDoubleClick={() => setWidthPx(HISTORY_READ_WIDTH.defaultPx)}
          className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-amber active:bg-amber-hover"
        />
      </AppTooltip>

      <header className="border-b border-line bg-background px-3.5 pt-3 pb-2.5">
        <Text as="h3" variant="title">
          {version.summary}
        </Text>
        <Text as="p" variant="meta" className="mt-1.25 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{label}</span>
          <span aria-hidden>·</span>
          {version.kind !== 'named' && (
            <>
              <span>automatic{reason ? `, ${reason}` : ''}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>
            {formatHistoryDay(version.createdAt)}, {formatTimeOfDay(version.createdAt)}
          </span>
          {draftChangeCount !== null && (
            <>
              <span aria-hidden>·</span>
              <span className={cn(draftChangeCount > 0 && 'text-amber')}>
                {describeDraftDistance(draftChangeCount, hasDraftFormatting)}
              </span>
            </>
          )}
        </Text>
        {loaded && (
          <ReadPaneControls
            versionLabel={label}
            isAgainstDraft={comparison.isAgainstDraft}
            canCompareWithParent={comparison.canCompareWithParent}
            onComparisonChange={onComparisonChange}
            view={view}
            onViewChange={setView}
            isMarked={isMarked}
            onMarkedChange={setIsMarked}
            canReadAsText={view === 'page' && !isLegible && isPageChosen}
            onReadAsText={readAsText}
            zoom={
              view === 'page'
                ? {
                    value: ownZoom.zoom,
                    isTextRead,
                    onStep: canvas.zoomByStep,
                    onReset: canvas.resetZoom,
                  }
                : null
            }
          />
        )}
      </header>

      {/* What changed differs in height from version to version: eased, not jumped. */}
      <div ref={easeHeightChanges} className="shrink-0 overflow-hidden">
        {diff &&
          (isSameAsBase ? (
            <Text
              as="p"
              variant="secondary"
              className="block border-b border-line bg-background px-3.5 py-2.25"
            >
              {comparison.isAgainstDraft
                ? 'Your draft is exactly this version. Nothing to restore.'
                : 'Nothing printed changed in this version.'}
            </Text>
          ) : (
            <ChangeList
              diff={diff}
              formatting={formatting}
              cursor={cursor}
              onPick={(change) => goToChange(changes.indexOf(change))}
              onStep={(direction) => goToChange(cursor + direction)}
              versionLabel={label}
              otherSide={otherSide}
              isAgainstDraft={comparison.isAgainstDraft}
              isDetailed={isDetailed}
              isOpen={listChoice === null ? changes.length === 0 : listChoice === 'open'}
              onOpenChange={(isOpen) => setListChoice(isOpen ? 'open' : 'closed')}
            />
          ))}
        {loaded && !comparison.canCompareWithParent && (
          <Text
            as="p"
            variant="meta"
            className="block border-b border-line bg-background px-3.5 py-2.25"
          >
            {label} is the first version, so it has no changes of its own. It is shown against your
            draft.
          </Text>
        )}
      </div>

      <div
        ref={bodyRef}
        onScroll={noteReadingPlace}
        onPointerDown={isPageShown ? canvas.onPointerDown : undefined}
        className={cn(
          // The reading place keeps the line in view, so the browser's own anchoring stays out.
          'min-h-0 flex-1 overflow-auto pt-3.5 pb-5 [overflow-anchor:none]',
          isPageShown && canvas.panning && 'cursor-grabbing select-none',
          isPageShown && !canvas.panning && canvas.readyToPan && 'cursor-grab',
          transitionClasses({ name: 'page', motion: 'handoff step' })
        )}
      >
        {loaded && view === 'changes' && diff && (
          <UnifiedDiff
            key={cursorKey}
            diff={diff}
            formatting={formatting}
            cursorId={changes[cursor]?.id ?? null}
            onPick={(change) => goToChange(changes.indexOf(change))}
            otherSide={otherSide}
            isDetailed={isDetailed}
          />
        )}
        {loaded && view === 'page' && (
          <VersionPage
            version={loaded}
            base={comparison.base}
            diff={diff}
            otherSide={otherSide}
            isMarked={isMarked}
            isTextRead={isTextRead}
            textReadNote={
              canWidenToPage
                ? 'Widen this pane to read it as the printed page.'
                : 'This window is too narrow to show the printed page. Reading it as text instead.'
            }
            onShowPage={() => setIsPageChosen(true)}
            zoom={ownZoom.zoom}
            onLaidOut={keepReadingPlace}
          />
        )}
      </div>

      <footer className="flex gap-1.5 border-t border-line bg-background px-3 py-2.25">
        <AppButton
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={isHead || isIdentical}
          title={describeRestore(isHead, isIdentical)}
          onClick={() => onRestore(version)}
        >
          <History />
          Restore
        </AppButton>
        <AppButton variant="outline" size="sm" onClick={() => onDuplicate(version)}>
          <Copy />
          Duplicate
        </AppButton>
        <AppButton
          variant="ghost"
          size="sm"
          shape="square"
          aria-label="Export this version"
          disabled={!loaded}
          onClick={() => loaded && onExport(loaded, label)}
        >
          <Download />
        </AppButton>
      </footer>
    </aside>
  );
}
