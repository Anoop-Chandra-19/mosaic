/*
 * How a change between two resumes is shown in the chrome. Start here.
 *
 * ChangeList is the list above the page: what changed, grouped by entry, stepped through
 * one at a time. UnifiedDiff is "Changes only": the lines that differ, before and after,
 * in hunks from groupDiffLines. Both draw an edit's words with PhraseText and word every
 * change, hover tips included, through the change model's describeChanges.
 *
 * On the page, pageMarks says what each place is marked with and puts back what only the
 * other side printed; the preview draws the marks with PageMarkParts. MarkedVersionText is
 * the same marks on the page read as text. revealChangeMark steps to a change's mark.
 *
 * Other modules use ChangeList, UnifiedDiff, pageMarks, MarkedVersionText and
 * revealChangeMark; the rest are their steps.
 */
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import {
  describeChange,
  describeChangeTip,
  describeFormattingChange,
} from '@shared/resume/changes/describeChanges';
import type { ResumeDiff } from '@shared/resume/changes/diffResumes';
import type { FormattingChange } from '@shared/resume/changes/diffFormatting';
import {
  countChangesByTone,
  getChangeGlyph,
  getChangeGroup,
  getChangeTone,
  type Change,
  type ChangeTone,
} from '@shared/resume/changes/resumeChange';
import { PhraseText } from './PhraseText';

const TONE_TEXT: Record<ChangeTone, string> = {
  edit: 'text-ink-soft',
  add: 'text-add',
  del: 'text-del',
};

interface ChangeListProps {
  diff: ResumeDiff;
  formatting: FormattingChange[];
  /** The change stepped to, by its place in `diff.changes`. */
  cursor: number;
  onPick: (change: Change) => void;
  onStep: (direction: 1 | -1) => void;
  versionLabel: string;
  /** What the version is compared with: "your draft", or the version before it. */
  otherSide: string;
  isAgainstDraft: boolean;
  isDetailed: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

function describeCountsInWords(counts: Record<ChangeTone, number>): string {
  const parts = [
    counts.edit && `${counts.edit} edited`,
    counts.add && `${counts.add} added`,
    counts.del && `${counts.del} removed`,
  ];
  return parts.filter(Boolean).join(', ');
}

function groupByPlace(changes: Change[]) {
  const groups = new Map<string, { change: Change; index: number }[]>();
  changes.forEach((change, index) => {
    const group = getChangeGroup(change);
    groups.set(group, [...(groups.get(group) ?? []), { change, index }]);
  });
  return [...groups];
}

function ChangeExcerpt({ change }: { change: Change }) {
  if (change.phrases) {
    return (
      <PhraseText
        phrases={change.phrases}
        side="after"
        insertedClassName="rounded-xs bg-add-soft text-ink-soft"
      />
    );
  }
  if (change.kind === 'move') return null;
  const isText = ['bullet', 'summaryLine', 'textLine'].includes(change.target.type);
  return describeChange(change).detail ?? (isText ? change.after || change.before : null);
}

/**
 * What changed, above the page: one line until opened, then grouped by entry. Formatting
 * comes last, never counted or stepped through.
 */
export function ChangeList({
  diff,
  formatting,
  cursor,
  onPick,
  onStep,
  versionLabel,
  otherSide,
  isAgainstDraft,
  isDetailed,
  isOpen,
  onOpenChange,
}: ChangeListProps) {
  const hasChanges = diff.changes.length > 0;
  const counts = countChangesByTone(diff.changes);
  const groups = groupByPlace(diff.changes);
  const places = [...new Set(groups.map(([group]) => group.split(' › ')[0]))];
  const noun = isDetailed ? 'line' : 'change';

  return (
    <div className="border-b border-line bg-background">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <AppButton
          variant="ghost"
          shape="text"
          aria-expanded={isOpen}
          onClick={() => onOpenChange(!isOpen)}
          className="flex min-w-0 shrink items-center gap-2 px-1.5 py-0.75 whitespace-nowrap"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3 shrink-0 text-ink-faint transition-transform duration-150',
              !isOpen && '-rotate-90'
            )}
          />
          {hasChanges ? (
            <>
              <span className="text-[0.78125rem] font-semibold text-foreground">
                {diff.changes.length} {noun}
                {diff.changes.length === 1 ? '' : 's'}
              </span>
              {isDetailed ? (
                <span className="inline-flex gap-1.5 font-mono text-[0.6875rem]">
                  {counts.edit > 0 && <span className="text-ink-soft">~{counts.edit}</span>}
                  {counts.add > 0 && <span className="text-add">+{counts.add}</span>}
                  {counts.del > 0 && <span className="text-del">−{counts.del}</span>}
                </span>
              ) : (
                <span className="text-xs text-ink-soft">{describeCountsInWords(counts)}</span>
              )}
              <span className="truncate text-xs text-ink-muted">in {places.join(', ')}</span>
            </>
          ) : (
            <span className="text-[0.78125rem] font-semibold text-foreground">Same words</span>
          )}
          {formatting.length > 0 && (
            <span className="text-xs text-ink-muted">
              {hasChanges ? 'and formatting' : 'formatting differs'}
            </span>
          )}
        </AppButton>
        <span className="flex-1" />
        {hasChanges && (
          <>
            <span className="font-mono text-xs whitespace-nowrap text-ink-faint">
              {cursor + 1} of {diff.changes.length}
            </span>
            <AppButton
              variant="ghost"
              size="2xs"
              shape="square"
              aria-label="Previous change (p)"
              onClick={() => onStep(-1)}
            >
              <ChevronDown className="size-3.25 rotate-180" />
            </AppButton>
            <AppButton
              variant="ghost"
              size="2xs"
              shape="square"
              aria-label="Next change (n)"
              onClick={() => onStep(1)}
            >
              <ChevronDown className="size-3.25" />
            </AppButton>
          </>
        )}
      </div>

      {isOpen && (
        <div className="max-h-52.5 overflow-auto px-2 pb-1.5" aria-label="Changes">
          {groups.map(([group, items]) => (
            <div key={group} className="[&+&]:mt-1">
              <div className="pt-1 pr-2 pb-0.75 pl-7.5 text-[0.6875rem] text-ink-faint">
                {group}
              </div>
              {items.map(({ change, index }) => {
                const tone = getChangeTone(change);
                const { noun: thing, verb } = describeChange(change);
                return (
                  <AppButton
                    key={change.id}
                    variant="ghost"
                    shape="text"
                    title={describeChangeTip(change, otherSide)}
                    aria-current={index === cursor || undefined}
                    onClick={() => onPick(change)}
                    className="grid w-full grid-cols-[1rem_auto_minmax(0,1fr)] items-baseline gap-2 px-2 py-1.25 text-[0.775rem] aria-current:bg-line-strong"
                  >
                    <span
                      className={cn(
                        'text-center font-mono text-[0.78125rem] font-bold',
                        TONE_TEXT[tone]
                      )}
                    >
                      {getChangeGlyph(change)}
                    </span>
                    <span className="whitespace-nowrap text-foreground">
                      {thing} <span className="text-ink-muted">{verb}</span>
                    </span>
                    <span
                      className={cn(
                        'truncate text-ink-faint',
                        tone === 'del' && 'line-through decoration-del-line'
                      )}
                    >
                      <ChangeExcerpt change={change} />
                    </span>
                  </AppButton>
                );
              })}
            </div>
          ))}
          {formatting.length > 0 && (
            <div className="mt-1.5 border-t border-line pt-0.5">
              <div className="pt-1 pr-2 pb-0.75 pl-7.5 text-[0.6875rem] text-ink-faint">
                Formatting
              </div>
              {formatting.map((change) => {
                const wording = describeFormattingChange(change, otherSide);
                return (
                  <div
                    key={`${change.setting}:${change.lineId}`}
                    title={`${wording.row}. Not marked on the page, not counted as a change.`}
                    className="grid grid-cols-[1rem_auto_minmax(0,1fr)] items-baseline gap-2 px-2 py-1.25 text-[0.775rem]"
                  >
                    <span aria-hidden />
                    <span className="whitespace-nowrap text-foreground">
                      {wording.subject} <span className="text-ink-muted">{wording.value}</span>
                    </span>
                    <span className="truncate text-ink-muted">{wording.otherValue}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-line px-4 pt-1.5 pb-2.25 text-[0.71875rem] text-ink-faint">
        {isAgainstDraft ? (
          <>
            Against your draft:
            <LegendMark tone="add">only in {versionLabel}</LegendMark>
            <LegendMark tone="del">only in your draft</LegendMark>
            Restoring {versionLabel} makes these changes.
          </>
        ) : (
          <>
            <span>
              What <b className="font-semibold text-ink-soft">{versionLabel}</b> changed from{' '}
              <b className="font-semibold text-ink-soft">{otherSide}</b>.
            </span>
            <LegendMark tone="add">new</LegendMark>
            <LegendMark tone="edit">edited</LegendMark>
            <LegendMark tone="del">gone</LegendMark>
          </>
        )}
      </p>
    </div>
  );
}

const LEGEND_BAR: Record<ChangeTone, string> = {
  add: 'before:bg-add',
  edit: 'before:bg-ink-muted',
  del: 'before:bg-del',
};

function LegendMark({ tone, children }: { tone: ChangeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.25 before:h-2.75 before:w-0.75 before:rounded-xs',
        LEGEND_BAR[tone]
      )}
    >
      {children}
    </span>
  );
}
