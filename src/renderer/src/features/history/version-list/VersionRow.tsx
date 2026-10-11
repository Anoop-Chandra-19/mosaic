import { ChevronDown, ChevronRight, Save, Sparkles } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import type { TextVariant } from '@/components/textVariants';
import { ChangeCounts } from '@/features/document-diff/ChangeCounts';
import { tourTargetProps } from '@/features/onboarding/tourTargets';
import { cn } from '@/lib/utils';
import type { ChangeTone } from '@shared/resume/changes/resumeChange';
import type { VersionMeta, VersionSource } from '@shared/types/db';
import { formatTimeOfDay } from '../groupVersionHistory';
import { useVersionPreviewComparison } from '../useVersionPreviewComparison';
import { VersionActions } from './VersionActions';
import { VersionDeleteConfirm } from './VersionDeleteConfirm';
import { VersionNameField, VersionNameKeys } from './VersionNameField';

/**
 * Tags only where the source is news. Named versions and plain edits need none: the dot
 * and the weight of the summary already say which they are.
 */
const SOURCE_TAGS: Partial<Record<VersionSource, string>> = {
  import: 'import',
  'before-import': 'before import',
  restore: 'restore',
  'before-restore': 'before restore',
  create: 'created',
  duplicate: 'copy',
  switched: 'left off',
  closed: 'left off',
  assistant: 'assistant',
  'before-apply': 'before apply',
};

const TAG_TONES: Partial<Record<VersionSource, string>> = {
  restore: 'border-info-line text-info',
  switched: 'border-line-heavy text-ink-soft',
  closed: 'border-line-heavy text-ink-soft',
  assistant: 'border-amber-line text-amber',
};

/** Snapshots of content itself: a tick across the line. The rest mark a moment. */
const CONTENT_SOURCES: ReadonlySet<VersionSource> = new Set<VersionSource>(['edit', 'assistant']);

/**
 * The row's mark on the rail. Each fills the same 12px slot, and only named versions are
 * nodes; the rest sit across the line, so it reads unbroken.
 */
type RailMark = 'tick' | 'newest' | 'named' | 'leftOff' | 'event';

function chooseRailMark(version: VersionMeta, isHead: boolean): RailMark {
  if (version.kind === 'named') return 'named';
  if (isHead) return 'newest';
  if (version.source === 'switched' || version.source === 'closed') return 'leftOff';
  return CONTENT_SOURCES.has(version.source) ? 'tick' : 'event';
}

// The rail is 1px at 5px, so its centre is 5.5px. Each mark is an odd number of pixels wide
// and its margins put its centre there in whole pixels. A fractional box or a half-pixel
// transform is rounded when drawn, which blurs the mark or leans the diamond off the line.
const RAIL_MARKS: Record<RailMark, string> = {
  tick: 'mt-[0.5625rem] mr-0.5 ml-px h-px w-[0.5625rem] rounded-[0.0625rem] bg-ink-muted',
  newest: 'mt-2 mr-px h-[0.1875rem] w-[0.6875rem] rounded-[0.0625rem] bg-ink-soft',
  named:
    'mt-1.25 mr-0.5 ml-px size-[0.5625rem] rotate-45 rounded-[0.09375rem] bg-foreground shadow-[0_0_0_2.5px_var(--background)]',
  leftOff:
    'mt-1.5 mr-0.75 ml-0.5 size-[0.4375rem] rounded-[0.09375rem] bg-ink-muted shadow-[0_0_0_2px_var(--background)]',
  event:
    'mt-1.5 mr-0.75 ml-0.5 size-[0.4375rem] rounded-[0.09375rem] bg-background shadow-[inset_0_0_0_1.5px_var(--ink-faint),0_0_0_2px_var(--background)]',
};

/** Amber is only ever the version being read. */
const SELECTED_RAIL_MARKS: Record<RailMark, string> = {
  tick: 'bg-amber',
  newest: 'bg-amber',
  named: 'shadow-[0_0_0_2px_var(--background),0_0_0_3.5px_var(--amber)]',
  leftOff: 'bg-background shadow-[inset_0_0_0_1.5px_var(--amber),0_0_0_2px_var(--background)]',
  event: 'shadow-[inset_0_0_0_1.5px_var(--amber),0_0_0_2px_var(--background)]',
};

function railMarkClasses(
  mark: RailMark,
  isHead: boolean,
  isSelected: boolean,
  isConfirming: boolean
) {
  if (isConfirming) return cn(RAIL_MARKS[mark], 'bg-del shadow-[0_0_0_2.5px_var(--del-soft)]');
  if (isSelected) return cn(RAIL_MARKS[mark], SELECTED_RAIL_MARKS[mark]);
  return cn(
    RAIL_MARKS[mark],
    mark === 'named' &&
      isHead &&
      'shadow-[0_0_0_2px_var(--background),0_0_0_3.25px_var(--ink-muted)]'
  );
}

/**
 * A number with revisions: the rail thickens for its row, and its newest revision is a
 * mark across that stretch. A session closed by a stop or a "before" row is capped with
 * that row's square instead.
 */
type NumberMark = 'tick' | 'newest' | 'event' | 'leftOff';

function chooseNumberMark(newest: VersionMeta, isHead: boolean): NumberMark {
  if (newest.source === 'switched' || newest.source === 'closed') return 'leftOff';
  if (!CONTENT_SOURCES.has(newest.source)) return 'event';
  return isHead ? 'newest' : 'tick';
}

const NUMBER_MARKS: Record<NumberMark, string> = {
  tick: 'before:-left-[0.1875rem] before:top-3.5 before:h-px before:w-[0.5625rem] before:bg-ink-muted',
  newest:
    'before:-left-1 before:top-[0.8125rem] before:h-[0.1875rem] before:w-[0.6875rem] before:bg-ink-soft',
  event:
    'before:-left-0.5 before:top-[0.6875rem] before:size-[0.4375rem] before:rounded-[0.09375rem] before:bg-background before:shadow-[inset_0_0_0_1.5px_var(--ink-faint),0_0_0_2px_var(--background)]',
  leftOff:
    'before:-left-0.5 before:top-[0.6875rem] before:size-[0.4375rem] before:rounded-[0.09375rem] before:bg-ink-muted before:shadow-[0_0_0_2px_var(--background)]',
};

/** Amber only on the mark of the revision being read, never the whole stretch. */
const SELECTED_NUMBER_MARKS: Record<NumberMark, string> = {
  tick: 'before:bg-amber',
  newest: 'before:bg-amber',
  event: 'before:shadow-[inset_0_0_0_1.5px_var(--amber),0_0_0_2px_var(--background)]',
  leftOff: 'before:bg-amber',
};

function numberMarkClasses(newest: VersionMeta, isHead: boolean, isSelected: boolean) {
  const mark = chooseNumberMark(newest, isHead);
  return cn(
    'relative z-1 -my-1.25 mr-1.25 ml-1 w-[0.1875rem] shrink-0 self-stretch before:absolute',
    isHead ? 'bg-ink-muted' : 'bg-line-heavy',
    NUMBER_MARKS[mark],
    isSelected && SELECTED_NUMBER_MARKS[mark]
  );
}

/** An earlier revision's mark: a notch inside its number's stretch, or its own square. */
const REVISION_MARKS: Record<RailMark, string> = {
  tick: '-left-[1.375rem] top-[0.65625rem] h-px w-[0.3125rem] bg-ink-muted',
  newest: '-left-[1.375rem] top-[0.65625rem] h-px w-[0.3125rem] bg-ink-muted',
  named:
    '-left-6 top-1.5 size-[0.5625rem] rotate-45 rounded-[0.09375rem] bg-foreground shadow-[0_0_0_2.5px_var(--background)]',
  leftOff:
    '-left-[1.4375rem] top-[0.46875rem] size-[0.4375rem] rounded-[0.09375rem] bg-ink-muted shadow-[0_0_0_2px_var(--background)]',
  event:
    '-left-[1.4375rem] top-[0.46875rem] size-[0.4375rem] rounded-[0.09375rem] bg-background shadow-[inset_0_0_0_1.5px_var(--ink-faint),0_0_0_2px_var(--background)]',
};

const SELECTED_REVISION_MARKS: Record<RailMark, string> = {
  ...SELECTED_RAIL_MARKS,
  named: 'shadow-[0_0_0_1.5px_var(--amber),0_0_0_3px_var(--background)]',
};

/** "v12.1", the revision a step fainter so the number reads first. In an open number, the reverse. */
function VersionLabel({ label, isRevision }: { label: string; isRevision: boolean }) {
  const [number, revision] = label.split('.');
  if (revision === undefined) return <span>{label}</span>;
  return (
    <span
      title={`${label} is revision ${revision} of ${number}. Every revision is kept and restores exactly that document.`}
      className={isRevision ? 'text-ink-faint' : 'text-ink-muted'}
    >
      {number}
      <span className={isRevision ? 'text-ink-soft' : 'text-ink-faint'}>.{revision}</span>
    </span>
  );
}

/** A number's row, standing for its newest revision with the earlier ones under it. */
export interface NumberRowInfo {
  /** The number's title: what its editing did, never a closing row's own words. */
  title: string;
  earlierCount: number;
  /** When its first revision was taken. */
  firstAt: number;
  isOpen: boolean;
  onToggle: () => void;
}

/** "9:02 AM to 9:40 AM" for a number edited within a day; otherwise the row's own time. */
function describeNumberTime(number: NumberRowInfo, newest: VersionMeta, time: string): string {
  const from = formatTimeOfDay(number.firstAt);
  const to = formatTimeOfDay(newest.createdAt);
  const isSameDay =
    new Date(number.firstAt).toDateString() === new Date(newest.createdAt).toDateString();
  return isSameDay && from !== to ? `${from} to ${to}` : time;
}

/** A named version's summary carries the row; a row inside a run is a step smaller. */
function summaryVariant(isNamed: boolean, isNested: boolean): TextVariant {
  if (isNamed) return 'strong';
  return isNested ? 'secondary' : 'body';
}

function describePreviewDistance(placeCount: number, hasFormatting: boolean): string {
  if (placeCount > 0) return `differs in ${placeCount} ${placeCount === 1 ? 'place' : 'places'}`;
  return hasFormatting ? 'same words as your draft' : 'same as your draft';
}

/** How far the version being read in the sheet is from the draft. */
function PreviewDistance() {
  const comparison = useVersionPreviewComparison();
  if (!comparison) return null;
  return (
    <span title="Places where this version and your draft differ">
      {describePreviewDistance(comparison.diff.changes.length, comparison.formatting.length > 0)}
    </span>
  );
}

/** What a row can do with its version; the list's owner passes the same to every row. */
export interface VersionRowActions {
  /** Only the open template's versions can be read in the sheet. */
  canPreview: boolean;
  previewId: string | null;
  onPreview: (version: VersionMeta, label: string) => void;
  onRestore: (version: VersionMeta) => void;
  onDuplicate: (version: VersionMeta) => void;
}

/** A row open for naming, or asking before a named version is deleted. One at a time. */
export type VersionRowMode = 'name' | 'delete';

interface VersionRowProps extends VersionRowActions {
  version: VersionMeta;
  isHead: boolean;
  /** Inside an open fold: no dot of its own, a tick to its line instead. */
  isNested: boolean;
  /** Stands for a number with earlier revisions. */
  number?: NumberRowInfo | null;
  /** An earlier revision, listed under its number. */
  isRevision?: boolean;
  /** The history tour's example: read, never restored, named or deleted. */
  isReadOnly?: boolean;
  /** In the full view, reading shows the version beside the list, not in the sheet. */
  isWide: boolean;
  label: string;
  time: string;
  mode: VersionRowMode | null;
  /** Named a moment ago: it washes amber once. */
  isJustNamed: boolean;
  /** The full view's selected row, with all details on: what it changed from the one before. */
  counts?: Record<ChangeTone, number> | null;
  onModeChange: (mode: VersionRowMode | null) => void;
  onName: (version: VersionMeta, name: string) => void;
  onDelete: (version: VersionMeta) => void;
  onSelect?: (version: VersionMeta) => void;
}

export function VersionRow({
  version,
  isHead,
  isNested,
  number = null,
  isRevision = false,
  isReadOnly = false,
  isWide,
  label,
  time,
  mode,
  isJustNamed,
  counts,
  onModeChange,
  onName,
  onDelete,
  onSelect,
  canPreview,
  previewId,
  onPreview,
  onRestore,
  onDuplicate,
}: VersionRowProps) {
  const isNamed = version.kind === 'named';
  const tag = SOURCE_TAGS[version.source];
  const isPreviewing = previewId === version.id;
  const isConfirming = mode === 'delete';
  const railMark = chooseRailMark(version, isHead);
  const NumberChevron = number?.isOpen ? ChevronDown : ChevronRight;

  return (
    <li
      data-version-id={version.id}
      // Landmarks of the full history only: the sidebar's rows stay in the tree behind it.
      {...tourTargetProps(
        isWide && isNamed && 'namedVersion',
        isWide && isPreviewing && 'readVersion'
      )}
      // A pointer shortcut for the Read button, which is what the keyboard reaches.
      onClick={
        onSelect &&
        ((event) => {
          if (!(event.target as Element).closest('button, input, [role="alertdialog"]')) {
            onSelect(version);
          }
        })
      }
      className={cn(
        'group relative flex items-start gap-2.5 rounded-md hover:bg-row-hover',
        onSelect && !mode && 'cursor-pointer',
        isRevision
          ? '-ml-2 py-[0.21875rem] pl-2'
          : // A nested row's tick crosses its fold's line, as the marks cross the rail.
            isNested
            ? 'py-[0.21875rem] before:absolute before:top-3 before:-left-4 before:h-px before:w-1.75 before:bg-ink-faint'
            : // Tints start left of the slot, so a row's box never cuts its mark.
              '-ml-1.5 py-1.25 pl-1.5',
        isPreviewing &&
          (isWide
            ? 'bg-amber-wash shadow-[inset_0_0_0_1px_var(--amber-line)] hover:bg-amber-wash'
            : 'bg-amber-wash ring-4 ring-amber-wash hover:bg-amber-wash'),
        isConfirming &&
          'bg-del-soft pr-1.5 shadow-[inset_0_0_0_1px_var(--del-line)] hover:bg-del-soft',
        isJustNamed && 'animate-named-wash motion-reduce:animate-none'
      )}
    >
      {isRevision ? (
        <span
          aria-hidden
          className={cn(
            'absolute z-1',
            REVISION_MARKS[railMark],
            isPreviewing && SELECTED_REVISION_MARKS[railMark]
          )}
        />
      ) : number && !isNamed && !isNested ? (
        <span aria-hidden className={numberMarkClasses(version, isHead, isPreviewing)} />
      ) : (
        !isNested && (
          <span
            aria-hidden
            className={cn(
              'relative z-1 shrink-0',
              railMarkClasses(railMark, isHead, isPreviewing, isConfirming),
              isJustNamed && 'animate-marker-pop motion-reduce:animate-none'
            )}
          />
        )
      )}
      {isConfirming ? (
        <VersionDeleteConfirm
          version={version}
          label={label}
          onDelete={() => onDelete(version)}
          onKeep={() => onModeChange(null)}
        />
      ) : (
        <>
          <div className="min-w-0 flex-1">
            {mode === 'name' ? (
              <VersionNameField
                version={version}
                label={label}
                onCommit={(name) => onName(version, name)}
                onCancel={() => onModeChange(null)}
              />
            ) : (
              <Text
                as="p"
                variant={summaryVariant(isNamed, isNested || isRevision)}
                className={cn(!isNamed && 'text-ink-muted')}
              >
                {isNamed && (
                  <Save
                    className={cn(
                      'mr-1.25 inline size-2.5 align-baseline text-amber',
                      isJustNamed && 'animate-marker-pop motion-reduce:animate-none'
                    )}
                  />
                )}
                {version.source === 'assistant' && (
                  <Sparkles className="mr-1.25 inline size-2.5 align-[-1px] text-amber" />
                )}
                {number && !isNamed ? number.title : version.summary}
              </Text>
            )}
            <Text
              as="p"
              variant="meta"
              className="mt-0.75 flex flex-wrap items-center gap-x-1.75 gap-y-1 *:whitespace-nowrap"
            >
              {tag && (
                <Text
                  variant="tag"
                  className={cn(
                    'inline-flex h-4 items-center rounded-[0.25rem] border px-1.25',
                    TAG_TONES[version.source] ?? 'border-line-strong text-ink-muted'
                  )}
                >
                  {tag}
                </Text>
              )}
              <VersionLabel label={label} isRevision={isRevision} />
              {mode === 'name' ? (
                <VersionNameKeys />
              ) : (
                <span>{number ? describeNumberTime(number, version, time) : time}</span>
              )}
              {!mode && number && (
                <AppButton
                  variant="ghost"
                  shape="text"
                  aria-expanded={number.isOpen}
                  title={`${number.isOpen ? 'Hide' : 'Show'} the earlier revisions of this version`}
                  onClick={number.onToggle}
                  className={cn(
                    'inline-flex h-auto items-center gap-0.5 rounded-[0.3125rem] border py-0 pr-0.75 pl-1.25 text-meta whitespace-nowrap',
                    number.isOpen
                      ? 'border-line-heavy text-ink-soft'
                      : 'border-line-strong text-ink-muted hover:border-line-heavy hover:text-ink-soft'
                  )}
                >
                  {number.earlierCount} earlier
                  <NumberChevron aria-hidden className="size-2.5" />
                </AppButton>
              )}
              {!mode && isHead && <span className="text-amber">newest</span>}
              {!mode && isPreviewing && !isWide && <PreviewDistance />}
              {!mode && counts && <ChangeCounts counts={counts} />}
            </Text>
          </div>
          {!mode && !isReadOnly && (
            <VersionActions
              version={version}
              label={label}
              isHead={isHead}
              isNested={isNested || isRevision}
              isWide={isWide}
              isPreviewing={isPreviewing}
              canPreview={canPreview}
              onPreview={() => onPreview(version, label)}
              onRestore={() => onRestore(version)}
              onDuplicate={() => onDuplicate(version)}
              onStartNaming={() => onModeChange('name')}
              onDelete={() => (isNamed ? onModeChange('delete') : onDelete(version))}
            />
          )}
        </>
      )}
    </li>
  );
}
