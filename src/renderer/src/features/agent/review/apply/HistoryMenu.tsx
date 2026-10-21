import { useId } from 'react';
import { AppButton, AppInput, AppRadioGroup, AppRadioGroupItem, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { isMissingName, type AddToOffer, type HistoryChoice } from './historyChoice';
import { HistoryRail } from './HistoryRail';
import type { HistoryRow } from './planHistoryRows';

interface HistoryMenuProps {
  choice: HistoryChoice;
  onChoiceChange: (choice: HistoryChoice) => void;
  offer: AddToOffer | null;
  rows: HistoryRow[];
  /** Apply chose Add to, but the version could no longer be added to. Nothing changed. */
  isRefused: boolean;
  onDone: () => void;
}

/** How Apply goes into history: chosen before Apply, with the rows it will add. */
export function HistoryMenu({
  choice,
  onChoiceChange,
  offer,
  rows,
  isRefused,
  onDone,
}: HistoryMenuProps) {
  const isBlocked = isMissingName(choice);
  const options = [
    offer && {
      mode: 'add' as const,
      title: `Add to ${offer.label}`,
      description:
        offer.refusal ??
        `Saved as ${offer.revisionLabel}, so this turn stays one version. ${offer.label} stays as it is.`,
      isDisabled: !!offer.refusal,
    },
    {
      mode: 'new' as const,
      title: offer ? 'Separate version' : 'Automatic version',
      description: 'Dimmed in the list like other automatic snapshots. Name or delete it later.',
      isDisabled: false,
    },
    {
      mode: 'named' as const,
      title: 'Name it',
      description: 'Kept for good and listed in the index.',
      isDisabled: false,
    },
  ].filter((option) => !!option);

  return (
    <div
      className="flex flex-col gap-1.5"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter' && !isBlocked) {
          event.preventDefault();
          onDone();
        }
      }}
    >
      <Text as="h3" variant="tag">
        In history
      </Text>
      {isRefused && (
        <Text
          as="p"
          role="alert"
          variant="secondary"
          className="my-1 rounded-md bg-warn-soft px-2.5 py-2 text-pretty text-ink-soft shadow-[inset_0_0_0_1px_var(--warn-line)]"
        >
          <b className="font-strong text-foreground">Nothing was applied.</b> Your draft changed
          after you chose Add to {offer?.label}, so it can’t be added to any more. It will go in as
          its own version; press Apply again.
        </Text>
      )}
      <AppRadioGroup
        aria-label="How Apply goes into history"
        value={choice.mode}
        onValueChange={(mode) => onChoiceChange({ ...choice, mode: mode as HistoryChoice['mode'] })}
        className="gap-1.5"
      >
        {options.map((option) => (
          <HistoryOption key={option.mode} {...option} isChosen={choice.mode === option.mode} />
        ))}
      </AppRadioGroup>
      {choice.mode === 'named' && (
        <AppInput
          autoFocus
          aria-label="Version name"
          placeholder="e.g. Tightened for Acme"
          maxLength={60}
          value={choice.name}
          onChange={(event) => onChoiceChange({ ...choice, name: event.target.value })}
          className="h-7.5"
        />
      )}
      <Text as="h3" variant="tag" className="mt-1.5 border-t border-line pt-2.25">
        Adds to history
      </Text>
      <HistoryRail rows={rows} />
      <div className="mt-1.5 flex items-center gap-2 border-t border-line pt-2.25">
        <Text variant="caption">
          {isBlocked ? 'Give it a name, or pick another option.' : 'Used when you press Apply.'}
        </Text>
        <span className="flex-1" />
        <AppButton variant="outline" size="sm" disabled={isBlocked} onClick={onDone}>
          Done
        </AppButton>
      </div>
    </div>
  );
}

function HistoryOption({
  mode,
  title,
  description,
  isDisabled,
  isChosen,
}: {
  mode: HistoryChoice['mode'];
  title: string;
  description: string;
  isDisabled: boolean;
  isChosen: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2.25 rounded-sm border border-line px-2.25 py-1.75',
        isChosen && 'border-line-heavy bg-line',
        isDisabled && 'cursor-default text-ink-faint'
      )}
    >
      <AppRadioGroupItem id={id} value={mode} disabled={isDisabled} className="mt-0.5" />
      <span>
        <Text as="span" variant="body" className="block font-control">
          {title}
        </Text>
        <Text as="span" variant="secondary" className="block text-ink-muted">
          {description}
        </Text>
      </span>
    </label>
  );
}
