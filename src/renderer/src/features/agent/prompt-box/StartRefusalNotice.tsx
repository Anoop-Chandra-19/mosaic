import { Settings, TriangleAlert } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import type { StartNoticeActionKind, StartRefusalWords } from './startRefusalWords';

const ACTION_ICONS: Partial<Record<StartNoticeActionKind, typeof Settings>> = {
  settings: Settings,
};

interface StartRefusalNoticeProps {
  words: StartRefusalWords;
  /** Provider and model, as the notice's source line. */
  who: string;
  onAction: (kind: StartNoticeActionKind) => void;
}

/** Why the message didn't go, over the prompt box: it needs the user before anything runs. */
export function StartRefusalNotice({ words, who, onAction }: StartRefusalNoticeProps) {
  return (
    <div
      role="alert"
      aria-label={`Can’t run. ${words.sentence}`}
      className="animate-notice-rise overflow-hidden rounded-[0.5625rem] border border-warn-line bg-pane-sunken motion-reduce:animate-none"
    >
      <div className="flex min-h-6.25 items-center gap-2 pt-1.75 pr-1.5 pl-2.5">
        <Text
          variant="tag"
          className="inline-flex h-4.5 shrink-0 items-center gap-1 rounded-[0.25rem] bg-warn px-1.5 text-warn-ink"
        >
          <TriangleAlert className="size-2.5" strokeWidth={2.6} />
          Can’t run
        </Text>
        <Text variant="meta" className="min-w-0 flex-1 truncate" title={who}>
          {who}
        </Text>
      </div>
      <Text as="p" variant="strong" className="px-2.5 pt-1.5 text-pretty">
        {words.sentence}
      </Text>
      <Text as="p" variant="secondary" className="mx-2.5 mt-1.5 text-pretty">
        {words.did}
      </Text>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 px-2.5 pt-2.25 pb-2.5">
        {words.actions.map(({ kind, label }, index) => {
          const Icon = ACTION_ICONS[kind];
          return (
            <AppButton
              key={kind}
              size="xs"
              variant={index === 0 ? 'solid' : 'outline'}
              onClick={() => onAction(kind)}
            >
              {Icon && <Icon className="size-2.75" />}
              {label}
            </AppButton>
          );
        })}
      </div>
    </div>
  );
}
