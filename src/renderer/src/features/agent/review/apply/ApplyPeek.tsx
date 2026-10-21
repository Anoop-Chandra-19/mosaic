import { Text } from '@/components/ui-kit';
import type { ApplyPlan } from '../../proposals/planApply';
import { HistoryRail } from './HistoryRail';
import type { HistoryRow } from './planHistoryRows';
import { SuggestionLines, type NameSuggestion } from './SuggestionLines';

/** What Apply will do, before it's pressed: shown on hover or focus of the button. */
export function ApplyPeek({
  plan,
  rows,
  name,
}: {
  plan: ApplyPlan;
  rows: HistoryRow[];
  name: NameSuggestion;
}) {
  return (
    <div className="flex flex-col">
      <Text as="h3" variant="strong" className="mb-1">
        What Apply does
      </Text>
      <SuggestionLines
        caption="Lands on your page"
        tone="land"
        proposals={plan.landed}
        name={name}
      />
      <SuggestionLines
        caption="Held back"
        tone="held"
        proposals={plan.held}
        name={name}
        note="Needs a number only you know. Stays here."
      />
      <SuggestionLines
        caption="Skipped"
        proposals={plan.skipped.map(({ proposal }) => proposal)}
        name={name}
        note="An earlier suggestion changes the same bullet first."
      />
      <SuggestionLines
        caption="Stays waiting"
        proposals={[...plan.waiting, ...plan.stale]}
        name={name}
        note="Nothing is dropped unless you drop it."
      />
      <SuggestionLines
        caption="Dropped"
        proposals={plan.dropped}
        name={name}
        note="The assistant hears what you dropped next turn."
      />
      <div className="mt-1 border-t border-line pt-2">
        <Text as="h4" variant="tag" className="mb-0.5">
          In history
        </Text>
        <HistoryRail rows={rows} />
        <Text as="p" variant="caption" className="mt-0.5">
          One undo step. Change how it goes into history with the button beside Apply.
        </Text>
      </div>
    </div>
  );
}
