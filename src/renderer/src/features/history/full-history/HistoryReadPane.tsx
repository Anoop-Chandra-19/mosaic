import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react';
import { Copy, Download, History } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { ChangeList } from '@/features/document-diff/ChangeList';
import { MarkedVersionText } from '@/features/document-diff/MarkedVersionText';
import { collectPageMarks, putGoneBack } from '@/features/document-diff/pageMarks';
import { UnifiedDiff } from '@/features/document-diff/UnifiedDiff';
import { PAPER_DIMENSIONS_PT } from '@/features/preview/pageGeometry';
import { ResumePreview } from '@/features/preview/ResumePreview';
import { startPaneResize } from '@/features/shell/paneResize';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { isTypingField } from '@/lib/keyboardShortcuts';
import { prefersReducedMotion } from '@/lib/motion/motionTiming';
import { flashChange } from '@/lib/motion/rowMotions';
import { cn } from '@/lib/utils';
import { HISTORY_READ_WIDTH, useUiStore } from '@/stores/uiStore';
import type { ResumeDiff } from '@shared/resume/changes/diffResumes';
import type { Change } from '@shared/resume/changes/resumeChange';
import type { Version, VersionMeta, VersionSource } from '@shared/types/db';
import type { ResumeData } from '@shared/types/resume';
import { formatHistoryDay, formatTimeOfDay } from '../groupVersionHistory';
import { ReadPaneControls, type ReadPaneView } from './ReadPaneControls';
import { useVersionComparison } from './useVersionComparison';
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
  templateId: string;
  version: VersionMeta;
  label: string;
  /** The version before it, which it is compared with by default; null for the first. */
  parent: VersionMeta | null;
  parentLabel: string;
  isHead: boolean;
  /** The widest the pane may get, for saying whether widening it would help. */
  maxWidthCss: string;
  canWidenToPage: boolean;
  onRestore: (version: VersionMeta) => void;
  onDuplicate: (version: VersionMeta) => void;
  onExport: (version: Version, label: string) => void;
  /** The version's document, read by the view before it selected the version. */
  doc: Version | null;
}

const ignorePreviewMeta = () => {};

function describeDraftDistance(changeCount: number, hasFormatting: boolean): string {
  if (changeCount > 0) {
    return `${changeCount} printed ${changeCount === 1 ? 'line differs' : 'lines differ'} from your draft`;
  }
  return hasFormatting ? 'same words as your draft, formatting differs' : 'identical to your draft';
}

function describeRestore(isHead: boolean, isIdentical: boolean): string {
  if (isHead) return 'This is the newest version';
  if (isIdentical) return 'Your draft already matches this version';
  return 'Restore. What you have now is kept in history first.';
}

function TextReadNote({ text, onShowPage }: { text: string; onShowPage: () => void }) {
  return (
    <p className="mt-1 mb-3.5 flex flex-wrap items-center gap-2.5 rounded-md border border-line px-2.5 py-2 font-mono text-[0.6875rem] text-ink-faint">
      <span className="min-w-40 flex-1">{text}</span>
      <AppButton variant="outline" size="2xs" onClick={onShowPage}>
        Show the page
      </AppButton>
    </p>
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
        doc={marked ? putGoneBack(version.doc, marked.base, marked.diff.all) : version.doc}
        marks={marked ? collectPageMarks(marked.diff.all, otherSide) : undefined}
        onMetaChange={ignorePreviewMeta}
      />
    </div>
  );
}

/** The change's mark on the page or in Changes only: not the preview's offscreen copy. */
function findChangeMark(body: HTMLElement | null, change: Change): Element | undefined {
  const marks = body?.querySelectorAll(`[data-change-id="${CSS.escape(change.id)}"]`) ?? [];
  return [...marks].find((mark) => !mark.closest('[data-preview-measure]'));
}

/**
 * The version being read, beside the list: what changed in it, then the version as the
 * printed page, as text when the pane is too narrow, or as only the lines that differ.
 */
export function HistoryReadPane({
  templateId,
  version,
  label,
  parent,
  parentLabel,
  isHead,
  maxWidthCss,
  canWidenToPage,
  onRestore,
  onDuplicate,
  onExport,
  doc,
}: HistoryReadPaneProps) {
  const widthPx = useUiStore((s) => s.historyReadWidthPx);
  const setWidthPx = useUiStore((s) => s.setHistoryReadWidthPx);
  const paperSize = useUiStore((s) => s.paperSize);
  const isDetailed = useUiStore((s) => s.shouldShowHistoryDetails);
  const setComparison = useUiStore((s) => s.setHistoryComparison);
  const paneRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  const [view, setView] = useState<ReadPaneView>('page');
  const [isMarked, setIsMarked] = useState(true);
  /** Chosen over the text read in a narrow pane. */
  const [isPageChosen, setIsPageChosen] = useState(false);
  const loaded = doc?.id === version.id ? doc : null;
  const comparison = useVersionComparison({ templateId, version: loaded, parent, parentLabel });
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
  const revealChange = (change: Change) => {
    const target = findChangeMark(bodyRef.current, change);
    if (!target) return;
    target.scrollIntoView({
      block: 'center',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    flashChange(target);
  };
  const goToChange = (index: number) => {
    if (changes.length === 0) return;
    const wrapped = (index + changes.length) % changes.length;
    setCursorAt({ key: cursorKey, index: wrapped });
    revealChange(changes[wrapped]);
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingField(event.target)) return;
    if (event.key === 'n' || event.key === ']') goToChange(cursor + 1);
    if (event.key === 'p' || event.key === '[') goToChange(cursor - 1);
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
  const reason = AUTOMATIC_REASONS[version.source];
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
          className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-amber-500 active:bg-amber-600"
        />
      </AppTooltip>

      <header className="border-b border-line bg-card px-3.5 pt-3 pb-2.5">
        <h3 className="text-[0.84375rem] font-semibold tracking-[-0.01em]">{version.summary}</h3>
        <p className="mt-1.25 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] text-ink-faint">
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
              <span className={cn(draftChangeCount > 0 && 'text-amber-600 dark:text-amber-400')}>
                {describeDraftDistance(draftChangeCount, hasDraftFormatting)}
              </span>
            </>
          )}
        </p>
        {loaded && (
          <ReadPaneControls
            versionLabel={label}
            isAgainstDraft={comparison.isAgainstDraft}
            canCompareWithParent={comparison.canCompareWithParent}
            onComparisonChange={setComparison}
            view={view}
            onViewChange={setView}
            isMarked={isMarked}
            onMarkedChange={setIsMarked}
            canReadAsText={view === 'page' && !isLegible && isPageChosen}
            onReadAsText={() => setIsPageChosen(false)}
          />
        )}
      </header>

      {diff &&
        (isSameAsBase ? (
          <p className="border-b border-line bg-background px-3.5 py-2.25 text-[0.775rem] text-ink-muted">
            {comparison.isAgainstDraft
              ? 'Your draft is exactly this version. Nothing to restore.'
              : 'Nothing printed changed in this version.'}
          </p>
        ) : (
          <ChangeList
            key={`${cursorKey}:${isDetailed}`}
            diff={diff}
            formatting={formatting}
            cursor={cursor}
            onPick={(change) => goToChange(changes.indexOf(change))}
            onStep={(direction) => goToChange(cursor + direction)}
            versionLabel={label}
            otherSide={otherSide}
            isAgainstDraft={comparison.isAgainstDraft}
            isDetailed={isDetailed}
          />
        ))}
      {loaded && !comparison.canCompareWithParent && (
        <p className="border-b border-line bg-background px-3.5 py-2.25 font-mono text-[0.7rem] text-ink-faint">
          {label} is the first version, so it has no changes of its own. It is shown against your
          draft.
        </p>
      )}

      <div
        ref={bodyRef}
        className={cn(
          'min-h-0 flex-1 overflow-auto pt-3.5 pb-5',
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
          />
        )}
      </div>

      <footer className="flex gap-1.5 border-t border-line bg-card px-3 py-2.25">
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
