import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Copy, Download, History } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { PAPER_DIMENSIONS_PT } from '@/features/preview/pageGeometry';
import { ResumePreview } from '@/features/preview/ResumePreview';
import { startPaneResize } from '@/features/shell/paneResize';
import { getDb } from '@/lib/storage/mosaicDb';
import { showToast } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { HISTORY_READ_WIDTH, useUiStore } from '@/stores/uiStore';
import type { Draft, Version, VersionMeta } from '@shared/types/db';
import { formatHistoryDay, formatTimeOfDay } from './groupVersionHistory';
import { VersionAsText } from './VersionAsText';
import { countChangedLines } from './versionDiff';

/** Below this the page is a thumbnail, not something to read, so the pane shows text. */
export const LEGIBLE_PAGE_SCALE = 0.66;
/** The body's padding either side of the page. */
const PAGE_GUTTER_PX = 24;

interface HistoryReadPaneProps {
  templateId: string;
  version: VersionMeta;
  label: string;
  isHead: boolean;
  /** The widest the pane may get, for saying whether widening it would help. */
  maxWidthCss: string;
  canWidenToPage: boolean;
  onRestore: (version: VersionMeta) => void;
  onDuplicate: (version: VersionMeta) => void;
  onExport: (version: Version, label: string) => void;
  /** Loaded before the view opened, so its page is there from the first frame. */
  initialVersion: Version | null;
}

const ignorePreviewMeta = () => {};

/**
 * The version being read, beside the list: as the printed page when there is room, as
 * text when there is not. Its header holds the one document comparison in the history.
 */
export function HistoryReadPane({
  templateId,
  version,
  label,
  isHead,
  maxWidthCss,
  canWidenToPage,
  onRestore,
  onDuplicate,
  onExport,
  initialVersion,
}: HistoryReadPaneProps) {
  const widthPx = useUiStore((s) => s.historyReadWidthPx);
  const setWidthPx = useUiStore((s) => s.setHistoryReadWidthPx);
  const paperSize = useUiStore((s) => s.paperSize);
  const paneRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyWidth, setBodyWidth] = useState(0);
  const loaded = useLoadedVersion(version.id, initialVersion);
  const draft = useComparedDraft(templateId);

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

  const changedLines = loaded && draft ? countChangedLines(loaded.doc, draft) : null;
  const pageScale = (bodyWidth - PAGE_GUTTER_PX * 2) / PAPER_DIMENSIONS_PT[paperSize].width;
  const isLegible = bodyWidth === 0 || pageScale >= LEGIBLE_PAGE_SCALE;
  return (
    <aside
      ref={paneRef}
      aria-label={`Reading ${label}`}
      data-history-read
      className="relative flex min-h-0 shrink-0 flex-col border-l border-line bg-background"
      style={{ width: `max(${HISTORY_READ_WIDTH.minPx}px, min(${widthPx}px, ${maxWidthCss}))` }}
    >
      <AppTooltip side="left" content="Drag to resize · double-click to reset">
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
          <span>
            {formatHistoryDay(version.createdAt)}, {formatTimeOfDay(version.createdAt)}
          </span>
          {changedLines !== null && (
            <>
              <span aria-hidden>·</span>
              <span className={changedLines > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}>
                {changedLines === 0
                  ? 'identical to your draft'
                  : `${changedLines} printed ${changedLines === 1 ? 'line differs' : 'lines differ'} from your draft`}
              </span>
            </>
          )}
        </p>
      </header>

      <div ref={bodyRef} data-page-viewport className="min-h-0 flex-1 overflow-auto pt-3.5 pb-5">
        {loaded &&
          (isLegible ? (
            <div style={{ paddingInline: PAGE_GUTTER_PX }}>
              <ResumePreview
                paperSize={paperSize}
                doc={loaded.doc}
                onMetaChange={ignorePreviewMeta}
              />
            </div>
          ) : (
            <VersionAsText
              resume={loaded.doc}
              note={
                canWidenToPage
                  ? 'Widen this pane to read it as the printed page.'
                  : 'This window is too narrow to show the printed page. Reading it as text instead.'
              }
            />
          ))}
      </div>

      <footer className="flex gap-1.5 border-t border-line bg-card px-3 py-2.25">
        <AppButton
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={isHead || changedLines === 0}
          title={
            isHead
              ? 'This is the newest version'
              : changedLines === 0
                ? 'Your draft already matches this version'
                : 'Restore. What you have now is kept in history first.'
          }
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

/** The version's document, once it has loaded; null while another is still showing. */
function useLoadedVersion(versionId: string, initial: Version | null): Version | null {
  const [loaded, setLoaded] = useState<Version | null>(initial);
  useEffect(() => {
    let isCurrent = true;
    getDb()
      .versions.get(versionId)
      .then(
        (version) => isCurrent && setLoaded(version),
        (error: unknown) => {
          console.error('Could not read that version', error);
          showToast('Could not read that version', 'error');
        }
      );
    return () => {
      isCurrent = false;
    };
  }, [versionId]);
  return loaded?.id === versionId ? loaded : null;
}

/**
 * The draft a version is compared with: the editor's, as typed, for the open template;
 * the stored one for any other, read without opening it.
 */
function useComparedDraft(templateId: string) {
  const isOpen = useResumeStore((s) => s.templateId === templateId);
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const [stored, setStored] = useState<Draft | null>(null);

  useEffect(() => {
    if (isOpen) return;
    let isCurrent = true;
    getDb()
      .drafts.get(templateId)
      .then(
        (draft) => isCurrent && setStored(draft),
        (error: unknown) => console.error('Could not read the draft', error)
      );
    return () => {
      isCurrent = false;
    };
  }, [templateId, isOpen]);

  if (isOpen) return { schemaVersion, contact, sections };
  return stored?.templateId === templateId ? stored.doc : null;
}
