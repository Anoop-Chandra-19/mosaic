import { Fragment, useState, type RefObject } from 'react';
import { ChevronDown, ChevronUp, Eye, History } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { revealChangeMark } from '@/features/document-diff/revealChangeMark';
import { cn } from '@/lib/utils';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import {
  describeDifference,
  describeFormattingDifference,
  type DifferencePhrase,
} from '@shared/resume/changes/describeChanges';
import type { ChangeTone } from '@shared/resume/changes/resumeChange';
import type { VersionPreviewComparison } from './useVersionPreviewComparison';

/** Each swatch is drawn as the mark its phrase stands for on the page. */
const SWATCHES: Record<ChangeTone, { className: string; title: string }> = {
  add: {
    className:
      'h-2.5 w-4.5 rounded-xs bg-swatch-add shadow-[inset_0_-1.5px_0_var(--swatch-add-line)]',
    title: 'Highlighted on the page',
  },
  del: {
    className:
      'h-2.5 w-4.5 bg-[linear-gradient(transparent_4px,var(--swatch-del)_4px,var(--swatch-del)_5.5px,transparent_5.5px)]',
    title: 'Struck through on the page',
  },
  edit: {
    className: 'h-2.75 w-0.75 rounded-xs bg-swatch-edit',
    title: 'Bar in the margin, what changed marked',
  },
};

function Swatch({ tone }: { tone: ChangeTone }) {
  const { className, title } = SWATCHES[tone];
  return <i title={title} className={cn('mr-0.75 ml-px inline-block align-[-1px]', className)} />;
}

function PhraseList({ phrases }: { phrases: DifferencePhrase[] }) {
  return phrases.map((phrase, index) => (
    <Fragment key={phrase.text}>
      {index > 0 && (index === phrases.length - 1 ? ' and ' : ', ')}
      <Swatch tone={phrase.tone} />
      <b className="font-semibold text-foreground">{phrase.text}</b>
    </Fragment>
  ));
}

/** "Compared with your draft, it has … and is missing … in Experience." */
function DifferenceSentence({ comparison }: { comparison: VersionPreviewComparison }) {
  const { diff, formatting } = comparison;
  const formattingSentence = describeFormattingDifference(formatting, 'your draft');
  if (diff.changes.length === 0) {
    return formattingSentence
      ? `Same words as your draft. ${formattingSentence}`
      : 'Same as your draft.';
  }
  const { has, missing, where } = describeDifference(diff.changes);
  const clauses = [
    { verb: 'has', phrases: has },
    { verb: 'is missing', phrases: missing },
  ].filter(({ phrases }) => phrases.length > 0);
  return (
    <>
      Compared with your draft, it {clauses.length === 0 && 'differs'}
      {clauses.map(({ verb, phrases }, index) => (
        <Fragment key={verb}>
          {index > 0 && ', and '}
          {verb} <PhraseList phrases={phrases} />
        </Fragment>
      ))}
      {where.length > 0 && ` in ${where.join(' and ')}`}.
      {formattingSentence && ` ${formattingSentence}`}
    </>
  );
}

interface PlaceStepperProps {
  comparison: VersionPreviewComparison;
  pageRef: RefObject<HTMLElement | null>;
}

/** Steps through the places the version differs, on the page. */
function PlaceStepper({ comparison, pageRef }: PlaceStepperProps) {
  const isMarked = useOverlayStore((s) => s.arePreviewMarksShown);
  const toggleMarks = useOverlayStore((s) => s.togglePreviewMarks);
  /** -1 until the first step. */
  const [stepped, setStepped] = useState(-1);
  const { changes } = comparison.diff;
  const cursor = stepped < changes.length ? stepped : -1;

  const step = (direction: 1 | -1) => {
    const firstIndex = direction > 0 ? 0 : changes.length - 1;
    const index = cursor < 0 ? firstIndex : (cursor + direction + changes.length) % changes.length;
    setStepped(index);
    if (isMarked) {
      revealChangeMark(pageRef.current, changes[index]);
      return;
    }
    // A place is found by its mark, so the marks go back on and it is shown once drawn.
    toggleMarks();
    requestAnimationFrame(() => revealChangeMark(pageRef.current, changes[index]));
  };

  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {changes.length === 1 ? (
        <AppButton variant="ghost" size="xs" onClick={() => step(1)}>
          Show me
        </AppButton>
      ) : (
        <>
          <span className="font-mono text-[0.6875rem] text-ink-faint">
            {cursor < 0 ? `${changes.length} places` : `${cursor + 1} of ${changes.length}`}
          </span>
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            aria-label="Previous place"
            title="Previous place"
            onClick={() => step(-1)}
          >
            <ChevronUp className="size-3" />
          </AppButton>
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            aria-label="Next place"
            title="Next place"
            onClick={() => step(1)}
          >
            <ChevronDown className="size-3" />
          </AppButton>
        </>
      )}
      <AppButton
        variant="ghost"
        size="xs"
        title={isMarked ? 'Read the page without the marks' : 'Mark the differences on the page'}
        onClick={toggleMarks}
      >
        {isMarked ? 'Hide marks' : 'Show marks'}
      </AppButton>
    </span>
  );
}

interface VersionPreviewBannerProps {
  comparison: VersionPreviewComparison;
  /** The scrolling box the page is in, for stepping to a place. */
  pageRef: RefObject<HTMLElement | null>;
}

/**
 * Over the sheet while a version is being read: which one, how it differs from the draft,
 * where, and the ways out. Restoring is a decision made after reading, never before.
 */
export function VersionPreviewBanner({ comparison, pageRef }: VersionPreviewBannerProps) {
  const setPreview = useOverlayStore((s) => s.setPreview);
  const openSurface = useOverlayStore((s) => s.openSurface);
  const restoreVersion = useTemplateStore((s) => s.restoreVersion);
  const { version, label } = comparison.preview;

  const restore = async () => {
    if (
      await attempt(
        restoreVersion(version.templateId, version.id),
        'Could not restore that version'
      )
    ) {
      showToast(`Restored “${version.summary}”`);
    }
  };

  const openFullHistory = () =>
    openSurface({
      kind: 'history',
      templateId: version.templateId,
      versionId: version.id,
      comparison: 'draft',
    });

  return (
    <div className="flex flex-wrap items-center gap-x-2.25 gap-y-1.5 border-b border-amber-line bg-amber-soft px-3.5 py-2 text-[0.78125rem] text-ink-soft">
      <Eye className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="min-w-0 flex-[1_1_16.25rem] leading-normal">
        <span className="text-ink-muted">
          Reading{' '}
          <span className="mr-1.5 ml-0.75 font-mono font-semibold text-amber-600 dark:text-amber-400">
            {label}
          </span>
          <span className="text-ink-soft italic">{version.summary}</span>
        </span>
        <span className="mt-px block text-pretty text-ink-soft">
          <DifferenceSentence comparison={comparison} />
        </span>
      </span>
      {comparison.diff.changes.length > 0 && (
        <PlaceStepper comparison={comparison} pageRef={pageRef} />
      )}
      <AppButton
        variant="ghost"
        size="xs"
        title="List every change, with the whole history beside it"
        onClick={openFullHistory}
      >
        Full history
      </AppButton>
      <AppButton variant="ghost" size="xs" onClick={() => setPreview(null)}>
        Back to draft
      </AppButton>
      <AppButton variant="accent" size="xs" onClick={() => void restore()}>
        <History />
        Restore this version
      </AppButton>
    </div>
  );
}
