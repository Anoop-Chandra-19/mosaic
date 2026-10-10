import { useEffect, useState, type ReactNode } from 'react';
import { MOTION_MS, prefersReducedMotion } from '@/lib/motion/motionTiming';
import { cn } from '@/lib/utils';
import type { VersionMeta } from '@shared/types/db';
import type { NumberRowInfo } from './VersionRow';

/** Where a number's row sits: its own row, or an earlier revision listed under it. */
export type NumberRowPlace = { number: NumberRowInfo } | { isRevision: true };

/** Opening, each revision fades in as the stretch reaches it. */
const STAGGERED_REVISIONS =
  '[&>li:nth-child(2)]:[animation-delay:30ms] [&>li:nth-child(3)]:[animation-delay:60ms] [&>li:nth-child(n+4)]:[animation-delay:90ms]';

/**
 * A number's title: what its editing did. A session's closing revision says only where it
 * stopped ("Before applying suggestions"), so it never heads the row.
 */
function titleRevisions(revisions: VersionMeta[]): string {
  return (revisions.find((version) => version.source === 'edit') ?? revisions[0]).summary;
}

interface NumberRowProps {
  /** Newest first, at least two. */
  revisions: VersionMeta[];
  /** Inside an open fold, where rows hang off the fold's own line instead of the rail. */
  isNested: boolean;
  isOpen: boolean;
  onToggle: () => void;
  renderRow: (version: VersionMeta, place: NumberRowPlace) => ReactNode;
}

/**
 * A version number and its revisions: the newest is the row, the earlier ones open under it
 * on the number's stretch of rail, newest first. One line, never a fork: history is linear.
 */
export function NumberRow({ revisions, isNested, isOpen, onToggle, renderRow }: NumberRowProps) {
  const [newest, ...earlier] = revisions;
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    setIsClosing(!isOpen && !prefersReducedMotion());
  }
  useEffect(() => {
    if (!isClosing) return;
    const timer = setTimeout(() => setIsClosing(false), MOTION_MS.revisionsClose);
    return () => clearTimeout(timer);
  }, [isClosing]);

  const hasStretch = newest.kind !== 'named' && !isNested;
  const isShown = isOpen || isClosing;
  return (
    <>
      {renderRow(newest, {
        number: {
          title: titleRevisions(revisions),
          earlierCount: earlier.length,
          firstAt: revisions.at(-1)!.createdAt,
          isOpen,
          onToggle,
        },
      })}
      {isShown && (
        <li>
          <ol
            className={cn(
              'relative mb-2.5 ml-5.25 pl-3',
              // The number's stretch runs on as a bounded block: a named number has none.
              hasStretch &&
                'before:absolute before:-top-px before:bottom-0.5 before:-left-[1.0625rem] before:w-[0.1875rem] before:origin-top before:rounded-b-[0.125rem] before:bg-line-heavy',
              isClosing
                ? 'pointer-events-none before:[animation:seam-in_120ms_cubic-bezier(0.5,0,0.8,0.4)_reverse_forwards] [&>li]:[animation:note-in_80ms_ease-in_reverse_forwards]'
                : cn(
                    'before:animate-seam-in [&>li]:animate-note-in [&>li]:[animation-fill-mode:backwards]',
                    STAGGERED_REVISIONS
                  ),
              'motion-reduce:before:animate-none motion-reduce:[&>li]:animate-none'
            )}
          >
            {earlier.map((version) => renderRow(version, { isRevision: true }))}
          </ol>
        </li>
      )}
    </>
  );
}
