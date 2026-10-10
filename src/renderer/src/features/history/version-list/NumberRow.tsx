import type { ReactNode } from 'react';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';
import { stagger } from '@/lib/motion/staggerPresence';
import type { VersionMeta } from '@shared/types/db';
import type { NumberRowInfo } from './VersionRow';

/** Where a number's row sits: its own row, or an earlier revision listed under it. */
export type NumberRowPlace = { number: NumberRowInfo } | { isRevision: true };

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
  const { shown, isLeaving, ref } = usePresenceMotion<VersionMeta[], HTMLLIElement>(
    isOpen ? revisions : null,
    newest.number,
    stagger
  );
  const hasStretch = newest.kind !== 'named' && !isNested;
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
      {shown && (
        <li
          key="earlier-revisions"
          ref={ref}
          data-state={isLeaving ? 'closed' : 'open'}
          inert={isLeaving}
          aria-hidden={isLeaving || undefined}
          className="relative mb-2.5 ml-5.25 pl-3"
        >
          {/* The number's stretch runs as a bounded block: a named number has none. */}
          {hasStretch && (
            <i
              aria-hidden
              data-presence-stretch
              className="absolute -top-px bottom-0.5 -left-4.25 w-0.75 origin-top rounded-b-[0.125rem] bg-line-heavy"
            />
          )}
          <ol data-presence-list>
            {shown.slice(1).map((version) => renderRow(version, { isRevision: true }))}
          </ol>
        </li>
      )}
    </>
  );
}
