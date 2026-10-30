import { Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import type { KeyState } from './apiKeyWords';

const KEY_STATES: Record<KeyState, { label: string; text: string; dot: string }> = {
  local: { label: 'On this computer', text: 'text-ink-faint', dot: 'bg-ink-muted' },
  none: { label: 'No key', text: 'text-ink-faint', dot: 'bg-line-heavy' },
  refused: { label: 'Key refused', text: 'text-warn-text', dot: 'bg-warn' },
  unchecked: {
    label: 'Saved, not checked',
    text: 'text-ink-faint',
    dot: 'ring-[1.5px] ring-warn ring-inset',
  },
  saved: { label: 'Key saved', text: 'text-ink-soft', dot: 'bg-add' },
  savedForSession: { label: 'Key saved for this session', text: 'text-ink-soft', dot: 'bg-add' },
};

/** A provider's key at a glance: a dot and a few words. */
export function KeyStatus({ state, className }: { state: KeyState; className?: string }) {
  const { label, text, dot } = KEY_STATES[state];
  return (
    <Text
      variant="secondary"
      className={cn('inline-flex items-center gap-1.25 whitespace-nowrap', text, className)}
    >
      <span aria-hidden className={cn('block size-1.5 shrink-0 rounded-full', dot)} />
      {label}
    </Text>
  );
}
