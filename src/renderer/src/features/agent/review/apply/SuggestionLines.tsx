import type { ReactNode } from 'react';
import { Text } from '@/components/Text';
import { cn } from '@/lib/utils';
import type { Proposal } from '@shared/types/agentProposal';

/** A suggestion as one line: its kind, then where. */
export interface SuggestionName {
  kind: string;
  where: string;
}

export type NameSuggestion = (proposal: Proposal) => SuggestionName;

/** What the tone of a group's caption says: landing, held back, or neither. */
export type LinesTone = 'land' | 'held' | 'plain';

const CAPTION_TONES: Record<LinesTone, string> = {
  land: 'text-add',
  held: 'text-warn',
  plain: '',
};

interface SuggestionLinesProps {
  caption: string;
  proposals: Proposal[];
  name: NameSuggestion;
  tone?: LinesTone;
  /** What follows each line: why it was held back or skipped, and what to do. */
  detail?: (proposal: Proposal) => ReactNode;
  /** A note under the group. */
  note?: ReactNode;
}

/** A group of suggestions by what Apply does with them: "Held back · 1", then each one. */
export function SuggestionLines({
  caption,
  proposals,
  name,
  tone = 'plain',
  detail,
  note,
}: SuggestionLinesProps) {
  if (!proposals.length) return null;
  return (
    <section className="border-t border-line py-1.5 first-of-type:border-t-0">
      <Text as="h4" variant="tag" className={cn('mb-0.75', CAPTION_TONES[tone])}>
        {caption} · {proposals.length}
      </Text>
      {proposals.map((proposal) => {
        const { kind, where } = name(proposal);
        return (
          <div key={proposal.id} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 py-0.5">
            <Text variant="secondary" className="text-ink-muted">
              {kind}
            </Text>
            <Text variant="secondary" className="truncate">
              {where}
            </Text>
            {detail && (
              <Text
                variant="secondary"
                className={cn('col-start-2', tone === 'held' ? 'text-warn' : 'text-ink-muted')}
              >
                {detail(proposal)}
              </Text>
            )}
          </div>
        );
      })}
      {note && (
        <Text as="p" variant="caption" className="mt-0.5">
          {note}
        </Text>
      )}
    </section>
  );
}
