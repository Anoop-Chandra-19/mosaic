import { AppTooltip } from '@/components/AppTooltip';
import { Badge } from '@/components/Badge';
import type { TemplateStatus } from './useTemplateStatus';

// Neutral on purpose: amber is kept for the assistant's pending suggestions, and the
// document's own state never competes with it.
const BADGES: Partial<
  Record<TemplateStatus, { label: string; title: string; tone: 'filled' | 'plain' }>
> = {
  edited: {
    label: 'edited',
    title: 'Saved as you type. Name a version when you want to find this state again.',
    tone: 'filled',
  },
  clean: {
    label: 'up to date',
    title: "Your draft matches the newest version in this template's history.",
    tone: 'plain',
  },
};

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  const badge = BADGES[status];
  if (!badge) return null;
  return (
    <AppTooltip content={badge.title}>
      <Badge tone={badge.tone}>{badge.label}</Badge>
    </AppTooltip>
  );
}
