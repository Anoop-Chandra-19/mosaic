import { useState, type ClipboardEvent } from 'react';
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { AppButton, AppCheckbox, AppInput, Text } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { checkApiKey, removeApiKey, saveApiKey } from '@/stores/secretsStore';
import type { KeyCheck, KeyedProvider, SavedKey, SecretsStatus } from '@shared/types/secrets';
import { ApiKeyMessage, type KeyMessageContext } from './ApiKeyMessage';
import { describeSavedKey, withArticle } from './apiKeyWords';
import { detectKeyProvider } from './detectKeyProvider';
import type { KeyProblem } from './keyProblem';
import { KEY_PAGE_URLS, MODEL_PROVIDER_OPTION_BY_ID } from './modelProviderOptions';
import { SettingRow } from '../../SettingRow';

interface ApiKeyRowProps {
  provider: KeyedProvider;
  status: SecretsStatus | null;
  loadFailed: boolean;
  /** A key passed a check, or was saved without one. */
  onKeyChecked: (provider: KeyedProvider) => void;
}

/**
 * The API key row: a field and Save, which checks the key before keeping it; then the saved
 * key's dates, with Replace (the old key stays until the new one passes) and Remove (asked
 * once). Messages sit under the control, never in the description.
 */
export function ApiKeyRow({ provider, status, loadFailed, onKeyChecked }: ApiKeyRowProps) {
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<KeyProblem | null>(
    loadFailed ? { kind: 'error', text: 'Could not check for a saved key.' } : null
  );
  const [isChecking, setIsChecking] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [forgetOnClose, setForgetOnClose] = useState(false);
  // Just saved or checked: the tick pops once.
  const [isFresh, setIsFresh] = useState(false);

  const saved = status?.saved[provider];
  const showsField = !saved || isReplacing;
  const hasKeychain = status?.keychain !== 'unavailable';

  const finishCheck = (checked: KeyedProvider, result: KeyCheck) => {
    if (!result.ok) {
      setProblem({ kind: 'checkFailed', provider: checked, failure: result });
      return;
    }
    setDraft('');
    setIsReplacing(false);
    setIsFresh(true);
    onKeyChecked(checked);
  };

  const runCheck = async (
    checked: KeyedProvider,
    request: () => Promise<KeyCheck>,
    failureText: string
  ) => {
    setIsChecking(true);
    setProblem(null);
    setIsFresh(false);
    try {
      finishCheck(checked, await request());
    } catch (error) {
      console.error(failureText, error);
      setProblem({ kind: 'error', text: `${failureText} Try again.` });
    } finally {
      setIsChecking(false);
    }
  };

  /** Saves under `target`, checking first unless `check` is false. */
  const save = (target: KeyedProvider, check: boolean) => {
    const key = draft.trim();
    if (!key || isChecking) return;
    if (/\s/.test(key)) return setProblem({ kind: 'spaces' });
    const prefixSays = detectKeyProvider(key);
    if (check && target === provider && prefixSays && prefixSays !== provider) {
      return setProblem({ kind: 'otherProvider', other: prefixSays });
    }
    void runCheck(
      target,
      () => saveApiKey(target, key, { check, forgetOnClose }),
      'Could not save the key.'
    );
  };

  const checkSavedKey = () =>
    void runCheck(provider, () => checkApiKey(provider), 'Could not check the key.');

  const remove = async () => {
    try {
      await removeApiKey(provider);
      setIsConfirmingRemove(false);
      setProblem(null);
    } catch (error) {
      console.error('Could not remove the key', error);
      setProblem({
        kind: 'error',
        text: 'Could not remove the key. If the keychain is locked, unlock it and try again.',
      });
    }
  };

  const cancelReplace = () => {
    setIsReplacing(false);
    setDraft('');
    setProblem(null);
  };

  const context = readMessageContext(saved !== undefined, isReplacing);
  const isLoading = status === null && !loadFailed;

  return (
    <SettingRow
      label="API key"
      description={<KeyDescription provider={provider} hasKeychain={hasKeychain} />}
    >
      <div className="flex w-[19rem] flex-col gap-1.75">
        {!isLoading && showsField && (
          <KeyField
            label={label}
            draft={draft}
            isChecking={isChecking}
            isInvalid={isKeyTurnedDown(problem)}
            isReplacing={isReplacing}
            onDraft={(value) => {
              setDraft(value);
              setProblem(null);
            }}
            onSave={() => save(provider, true)}
            onCancel={cancelReplace}
          />
        )}
        {saved && !showsField && isConfirmingRemove && (
          <Text
            as="p"
            variant="secondary"
            className="flex animate-note-in items-center rounded-sm border border-del-line bg-del-soft px-2.5 py-2 text-foreground motion-reduce:animate-none"
          >
            Remove your {label} key? The assistant can’t use {label} until you add one.
          </Text>
        )}
        {saved && !showsField && !isConfirmingRemove && (
          <SavedKeySummary
            label={label}
            saved={saved}
            keychain={status?.keychain ?? 'unknown'}
            isChecking={isChecking}
            isFresh={isFresh}
          />
        )}

        {saved && !isReplacing && (
          <div className="flex justify-end gap-1.5">
            {isConfirmingRemove ? (
              <>
                <AppButton
                  variant="ghost"
                  size="xs"
                  autoFocus
                  onClick={() => setIsConfirmingRemove(false)}
                >
                  Keep it
                </AppButton>
                <AppButton variant="destructive" size="xs" onClick={() => void remove()}>
                  Remove key
                </AppButton>
              </>
            ) : (
              <>
                {(saved.checkedAt === null || saved.refusedAt !== undefined) && (
                  <AppButton
                    variant="outline"
                    size="xs"
                    disabled={isChecking}
                    onClick={checkSavedKey}
                  >
                    Check now
                  </AppButton>
                )}
                <AppButton
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    setIsReplacing(true);
                    setProblem(null);
                    setIsFresh(false);
                  }}
                >
                  Replace…
                </AppButton>
                <AppButton
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setIsConfirmingRemove(true);
                    setIsFresh(false);
                  }}
                >
                  Remove
                </AppButton>
              </>
            )}
          </div>
        )}

        <ApiKeyMessage
          provider={provider}
          problem={problem}
          context={context}
          isChecking={isChecking}
          onRetry={context === 'savedKey' ? checkSavedKey : () => save(provider, true)}
          onSaveUnchecked={() => save(provider, false)}
          onUseFor={(other) => save(other, true)}
        />

        {showsField && hasKeychain && (
          <Text
            as="label"
            variant="secondary"
            className="flex w-max cursor-pointer items-center gap-1.75 text-ink-muted hover:text-ink-soft"
          >
            <AppCheckbox
              size="sm"
              checked={forgetOnClose}
              disabled={isChecking}
              onCheckedChange={(checked) => setForgetOnClose(checked === true)}
            />
            Forget this key when Mosaic closes
          </Text>
        )}
      </div>
    </SettingRow>
  );
}

function readMessageContext(hasSavedKey: boolean, isReplacing: boolean): KeyMessageContext {
  if (!hasSavedKey) return 'newKey';
  return isReplacing ? 'replacingKey' : 'savedKey';
}

/** The field is edged red for what's wrong with the key itself. */
const isKeyTurnedDown = (problem: KeyProblem | null) =>
  problem?.kind === 'spaces' ||
  (problem?.kind === 'checkFailed' && problem.failure.reason === 'refused');

function KeyDescription({
  provider,
  hasKeychain,
}: {
  provider: KeyedProvider;
  hasKeychain: boolean;
}) {
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  return (
    <>
      {hasKeychain
        ? 'Kept in your system keychain. Once saved it can’t be shown again, only replaced or removed. '
        : 'This computer has no keychain, so the key is kept until Mosaic closes and asked for again next launch. '}
      {/* Opens in the system browser: the app never navigates away from itself. */}
      <a
        href={KEY_PAGE_URLS[provider]}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-0.75 text-ink-soft no-underline hover:text-foreground"
      >
        Get {withArticle(label)} key
        <ExternalLink aria-hidden className="size-2.75" />
      </a>
    </>
  );
}

function KeyField({
  label,
  draft,
  isChecking,
  isInvalid,
  isReplacing,
  onDraft,
  onSave,
  onCancel,
}: {
  label: string;
  draft: string;
  isChecking: boolean;
  isInvalid: boolean;
  isReplacing: boolean;
  onDraft: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [isRevealed, setIsRevealed] = useState(false);
  const canSave = draft.trim() !== '' && !isChecking;

  // A paste brings stray spaces and line breaks along; the key is what's between them.
  const pasteTrimmed = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').trim();
    if (!pasted) return;
    event.preventDefault();
    onDraft(pasted);
  };

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <AppInput
          type={isRevealed ? 'text' : 'password'}
          value={draft}
          disabled={isChecking}
          autoFocus={isReplacing}
          aria-invalid={isInvalid || undefined}
          onChange={(event) => onDraft(event.target.value)}
          onPaste={pasteTrimmed}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && isReplacing) {
              event.stopPropagation();
              onCancel();
            }
          }}
          placeholder="Paste your key"
          aria-label={`${label} API key`}
          autoComplete="off"
          spellCheck={false}
          className="pr-7.5 font-mono text-meta"
        />
        <AppButton
          type="button"
          variant="ghost"
          size="xs"
          shape="square"
          tabIndex={-1}
          disabled={!draft}
          className="absolute top-0.75 right-0.75 size-6.25"
          onClick={() => setIsRevealed((revealed) => !revealed)}
          aria-label={isRevealed ? 'Hide key' : 'Show key'}
        >
          {isRevealed ? <EyeOff /> : <Eye />}
        </AppButton>
      </div>
      <AppButton
        type="submit"
        variant={canSave ? 'solid' : 'outline'}
        size="sm"
        disabled={!canSave}
        className={cn(isChecking ? 'min-w-25.5' : 'min-w-16')}
      >
        {isChecking ? (
          <>
            <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" />
            Checking…
          </>
        ) : (
          'Save'
        )}
      </AppButton>
      {isReplacing && !isChecking && (
        <AppButton type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </AppButton>
      )}
    </form>
  );
}

function SavedKeySummary({
  label,
  saved,
  keychain,
  isChecking,
  isFresh,
}: {
  label: string;
  saved: SavedKey;
  keychain: SecretsStatus['keychain'];
  isChecking: boolean;
  isFresh: boolean;
}) {
  const { savedLine, checkedLine } = describeSavedKey(saved, keychain, label);
  const isChecked = saved.checkedAt !== null && saved.refusedAt === undefined;
  return (
    <div className="flex min-h-8 items-center gap-2">
      <span
        aria-hidden
        className={cn(
          'grid size-4.5 shrink-0 place-items-center rounded-full border',
          isChecked
            ? 'border-add-line bg-add-soft text-add'
            : 'border-warn-line bg-warn-soft text-warn',
          isFresh && 'animate-marker-pop motion-reduce:animate-none'
        )}
      >
        {isChecked ? (
          <Check className="size-2.75 stroke-[2.4]" />
        ) : (
          <AlertTriangle className="size-2.5" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <Text variant="body" className="font-control text-foreground">
          {isChecking ? 'Checking…' : savedLine}
        </Text>
        {!isChecking && (
          <Text variant="secondary" className="text-ink-faint">
            {checkedLine}
          </Text>
        )}
      </div>
    </div>
  );
}
