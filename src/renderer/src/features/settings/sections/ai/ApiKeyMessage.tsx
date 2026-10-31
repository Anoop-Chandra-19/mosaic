import type { ReactNode } from 'react';
import { AlertTriangle, Info, X, type LucideIcon } from 'lucide-react';
import { AppButton, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { MODEL_PROVIDER_OPTION_BY_ID } from '@/lib/modelProviderOptions';
import type { KeyedProvider } from '@shared/types/secrets';
import { withArticle } from './apiKeyWords';
import type { KeyCheckFailure, KeyProblem } from './keyProblem';

type Tone = 'del' | 'warn' | 'info';

const TONES: Record<Tone, { icon: LucideIcon; className: string }> = {
  del: { icon: X, className: 'text-del' },
  warn: { icon: AlertTriangle, className: 'text-warn' },
  info: { icon: Info, className: 'text-ink-muted' },
};

/** Which key the message is about: a new one, one replacing a saved key, or the saved key. */
export type KeyMessageContext = 'newKey' | 'replacingKey' | 'savedKey';

const CHECK_FAILURES: Record<
  KeyCheckFailure['reason'],
  { tone: Tone; words: (label: string, httpStatus?: number) => string; wasNeverRefused: boolean }
> = {
  refused: {
    tone: 'del',
    words: (label) => `${label} turned this key down. Check it was copied in full.`,
    wasNeverRefused: false,
  },
  unreachable: {
    tone: 'warn',
    words: (label) => `Couldn’t reach ${label} to check this key.`,
    wasNeverRefused: true,
  },
  failed: {
    tone: 'warn',
    words: (label, httpStatus) =>
      `${label} answered with an error${httpStatus ? ` (${httpStatus})` : ''}, so the key wasn’t checked.`,
    wasNeverRefused: true,
  },
  keychain: {
    tone: 'del',
    words: () => 'The keychain didn’t hand over the saved key. Unlock it and try again.',
    wasNeverRefused: false,
  },
  'no-key': {
    tone: 'del',
    words: (label) => `No ${label} key is saved.`,
    wasNeverRefused: false,
  },
};

/** What happened to the key already saved, said after a check of a new one fails. */
function describeWhatWasKept(context: KeyMessageContext, wasNeverRefused: boolean): string {
  if (context === 'replacingKey') return ' Your saved key is unchanged.';
  return context === 'newKey' && wasNeverRefused ? ' Nothing is saved yet.' : '';
}

/** A message under a setting's control: an icon for its tone, words, and what can be done. */
export function KeyMessageLine({
  tone,
  children,
  actions,
}: {
  tone: Tone;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { icon: Icon, className } = TONES[tone];
  return (
    <div className="flex animate-note-in items-start gap-1.75 motion-reduce:animate-none">
      <Icon aria-hidden className={cn('mt-0.5 size-3.25 shrink-0', className)} />
      <div className="min-w-0">
        <Text as="p" variant="secondary" className="text-pretty text-ink-soft">
          {children}
        </Text>
        {actions && <div className="mt-1.5 flex flex-wrap gap-1.5">{actions}</div>}
      </div>
    </div>
  );
}

interface ApiKeyMessageProps {
  provider: KeyedProvider;
  problem: KeyProblem | null;
  context: KeyMessageContext;
  isChecking: boolean;
  onRetry: () => void;
  onSaveUnchecked: () => void;
  onUseFor: (provider: KeyedProvider) => void;
}

/** The line under the key field: what went wrong and what can be done, never in the description. */
export function ApiKeyMessage({
  provider,
  problem,
  context,
  isChecking,
  onRetry,
  onSaveUnchecked,
  onUseFor,
}: ApiKeyMessageProps) {
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  if (isChecking) return null;
  if (!problem) {
    return context === 'replacingKey' ? (
      <KeyMessageLine tone="info">Your saved key stays until the new one passes.</KeyMessageLine>
    ) : null;
  }

  switch (problem.kind) {
    case 'spaces':
      return (
        <KeyMessageLine tone="del">Keys have no spaces. Check what was pasted.</KeyMessageLine>
      );
    case 'error':
      return <KeyMessageLine tone="del">{problem.text}</KeyMessageLine>;
    case 'otherProvider': {
      const otherLabel = MODEL_PROVIDER_OPTION_BY_ID[problem.other].label;
      return (
        <KeyMessageLine
          tone="info"
          actions={
            <AppButton variant="outline" size="xs" onClick={() => onUseFor(problem.other)}>
              Use it for {otherLabel}
            </AppButton>
          }
        >
          This looks like {withArticle(otherLabel)} key, not {withArticle(label)} one. Nothing was
          sent.
        </KeyMessageLine>
      );
    }
    case 'checkFailed': {
      const { tone, words, wasNeverRefused } = CHECK_FAILURES[problem.failure.reason];
      const checkedLabel = MODEL_PROVIDER_OPTION_BY_ID[problem.provider].label;
      return (
        <KeyMessageLine
          tone={tone}
          actions={
            wasNeverRefused && (
              <>
                <AppButton variant="outline" size="xs" onClick={onRetry}>
                  Try again
                </AppButton>
                {context !== 'savedKey' && (
                  <AppButton variant="ghost" size="xs" onClick={onSaveUnchecked}>
                    Save without checking
                  </AppButton>
                )}
              </>
            )
          }
        >
          {words(checkedLabel, problem.failure.httpStatus)}
          {describeWhatWasKept(context, wasNeverRefused)}
        </KeyMessageLine>
      );
    }
  }
}
