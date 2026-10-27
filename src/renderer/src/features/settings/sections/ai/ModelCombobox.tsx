import { useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  AppButton,
  AppCommand,
  AppCommandField,
  AppCommandGroup,
  AppCommandItem,
  AppCommandList,
  AppPopover,
  AppPopoverAnchor,
  AppPopoverContent,
  Text,
  textVariantClasses,
} from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/features/templates/formatRelativeTime';
import type { KeyedProvider, ModelListing } from '@shared/types/secrets';
import type { KeyState } from './apiKeyWords';
import { findQueryInName, groupModelChoices } from './groupModelChoices';
import { MODEL_PROVIDER_OPTION_BY_ID } from './modelProviderOptions';
import type { ModelListAnswer } from './useModelList';

/** What a provider's list leaves out, said after how many it hid. */
const HIDDEN_KINDS: Record<KeyedProvider, string> = {
  anthropic: 'embeddings, speech, images',
  openai: 'embeddings, speech, images',
  google: 'embeddings, speech, images',
  openrouter: 'no tool use',
};

const LIST_FAILURES: Record<
  Extract<ModelListing, { ok: false }>['reason'],
  (label: string, httpStatus?: number) => string
> = {
  refused: (label) => `${label} turned the key down, so there is no list.`,
  unreachable: (label) => `Couldn’t reach ${label} for the list.`,
  failed: (label, httpStatus) =>
    `${label} answered with an error${httpStatus ? ` (${httpStatus})` : ''}, so there is no list.`,
  keychain: () => 'The keychain didn’t hand over the key, so there is no list.',
  'no-key': () => 'Save a key to see every model it can reach.',
};

function describeListing(provider: KeyedProvider, listing: ModelListing): string {
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  if (!listing.ok) return LIST_FAILURES[listing.reason](label, listing.httpStatus);
  const { models, hiddenCount, listedAt } = listing.list;
  const count = `${models.length} chat ${models.length === 1 ? 'model' : 'models'}`;
  const others = hiddenCount === 1 ? '1 other' : `${hiddenCount} others`;
  const hidden = hiddenCount > 0 ? `, ${others} hidden (${HIDDEN_KINDS[provider]})` : '';
  return `${count} listed by ${label} ${formatRelativeTime(listedAt)}${hidden}`;
}

/** The footer's words, before any list or while one is on its way. */
function describeMissingList(
  provider: KeyedProvider,
  keyState: KeyState | null,
  isLoading: boolean
) {
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  if (isLoading) return `Asking ${label} for its models…`;
  return keyState === 'unchecked'
    ? 'Check the key to see every model it can reach.'
    : 'Save a key to see every model it can reach.';
}

/** A model's name with the part the query matched marked. */
function MatchedName({ model, query }: { model: string; query: string }) {
  const found = findQueryInName(model, query);
  if (!found) return model;
  return (
    <>
      {found.before}
      <b className="font-strong text-foreground underline decoration-line-heavy underline-offset-2">
        {found.match}
      </b>
      {found.after}
    </>
  );
}

function ModelRow({
  value,
  isCurrent,
  tag,
  children,
  onPick,
}: {
  /** cmdk's name for the row: the model, or what the row does. */
  value: string;
  isCurrent: boolean;
  tag?: string;
  children: ReactNode;
  onPick: () => void;
}) {
  return (
    <AppCommandItem
      value={value}
      onSelect={onPick}
      className="min-h-7 gap-2 py-0 font-mono text-meta"
    >
      <span className="grid w-3 shrink-0 place-items-center text-foreground">
        {isCurrent && <Check aria-hidden className="size-2.75" strokeWidth={2.2} />}
      </span>
      <span className="min-w-0 truncate">{children}</span>
      {tag && (
        <Text variant="secondary" className="ml-auto shrink-0 font-sans text-ink-faint">
          {tag}
        </Text>
      )}
    </AppCommandItem>
  );
}

interface ModelComboboxProps {
  provider: KeyedProvider;
  model: string;
  /** Mosaic's pick for the provider. */
  suggested: string;
  keyState: KeyState | null;
  modelList: ModelListAnswer;
  onChange: (model: string) => void;
}

/**
 * The model field, which is also the search: Mosaic's pick and the models used before come
 * first, then what the provider lists for the key. Any name can be used, listed or not.
 */
export function ModelCombobox({
  provider,
  model,
  suggested,
  keyState,
  modelList,
  onChange,
}: ModelComboboxProps) {
  const label = MODEL_PROVIDER_OPTION_BY_ID[provider].label;
  // What is typed while the list is open; null shows the model in settings.
  const [query, setQuery] = useState<string | null>(null);
  const [used, setUsed] = useState<string[]>([]);
  const fieldRef = useRef<HTMLDivElement>(null);
  const isOpen = query !== null;
  const { listing, isLoading, refresh } = modelList;

  const open = () => {
    if (isOpen) return;
    setQuery('');
    // Read each time it opens: a run since may have used another model.
    window.mosaic.modelProviders.usedModels().then(
      (models) =>
        setUsed(models.filter((each) => each.provider === provider).map((each) => each.model)),
      (error: unknown) => console.error('Could not read the models used before', error)
    );
  };
  const close = () => setQuery(null);
  const pick = (picked: string) => {
    onChange(picked);
    close();
  };

  const typed = query?.trim() ?? '';
  const groups = groupModelChoices({
    provider,
    suggested,
    used,
    listed: listing?.ok ? listing.list.models : [],
    query: typed,
  });
  const isTypedListed = groups.some((group) =>
    group.choices.some((choice) => choice.model === typed)
  );

  let footer: ReactNode = describeMissingList(provider, keyState, isLoading);
  if (listing && !isLoading) {
    footer = (
      <>
        <span>{describeListing(provider, listing)}</span>
        <AppButton
          variant="link"
          size="xs"
          onClick={refresh}
          className="h-auto shrink-0 p-0 text-ink-muted hover:text-foreground hover:no-underline"
        >
          {listing.ok ? 'Refresh' : 'Try again'}
        </AppButton>
      </>
    );
  }

  return (
    <AppCommand label={`${label} models`} className="h-auto w-auto overflow-visible">
      <AppPopover open={isOpen} onOpenChange={(next) => !next && close()}>
        <AppPopoverAnchor asChild>
          <div ref={fieldRef} className="w-[15.625rem]">
            <AppCommandField
              value={query ?? model}
              onValueChange={(text) => setQuery(text)}
              onFocus={open}
              onClick={open}
              onKeyDown={(event) => {
                if (!isOpen && event.key === 'ArrowDown') {
                  event.preventDefault();
                  open();
                }
              }}
              placeholder={isOpen ? 'Search models' : suggested}
              aria-label={`${label} model`}
              spellCheck={false}
              autoComplete="off"
              className="pr-8 font-mono text-meta"
              trailing={
                <AppButton
                  variant="ghost"
                  size="xs"
                  shape="square"
                  tabIndex={-1}
                  aria-label="Models"
                  onClick={isOpen ? close : open}
                >
                  <ChevronDown aria-hidden />
                </AppButton>
              }
            />
          </div>
        </AppPopoverAnchor>
        <AppPopoverContent
          align="end"
          sideOffset={4}
          className="flex w-[20.625rem] flex-col p-0"
          shouldHoldScroll
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // The field and its button sit outside the list but belong to it.
          onInteractOutside={(event) => {
            if (event.target instanceof Node && fieldRef.current?.contains(event.target)) {
              event.preventDefault();
            }
          }}
          // Choosing with the pointer keeps the typing in the field.
          onMouseDown={(event) => event.preventDefault()}
        >
          {query === '' && (
            <Text
              as="p"
              variant="secondary"
              className="border-b border-line px-2.5 py-1.75 text-ink-faint"
            >
              Using <span className={textVariantClasses('meta')}>{model}</span>
            </Text>
          )}
          <AppCommandList className="max-h-58 flex-none p-1.25">
            {groups.map((group) => (
              <AppCommandGroup
                key={group.heading ?? 'pick'}
                // cmdk takes a null heading for a ref and throws, so none is undefined.
                heading={
                  group.heading === null ? undefined : (
                    <>
                      <span>{group.heading}</span>
                      {group.count !== undefined && (
                        <span className="ml-auto font-mono font-regular tracking-normal normal-case">
                          {group.count}
                        </span>
                      )}
                    </>
                  )
                }
              >
                {group.choices.map((choice) => (
                  <ModelRow
                    key={choice.model}
                    value={choice.model}
                    isCurrent={choice.model === model}
                    tag={choice.tag}
                    onPick={() => pick(choice.model)}
                  >
                    <MatchedName model={choice.model} query={typed} />
                  </ModelRow>
                ))}
              </AppCommandGroup>
            ))}
            {typed && !isTypedListed && (
              // Curly quotes keep its value apart from every model's own name.
              <ModelRow
                value={`Use “${typed}”`}
                isCurrent={false}
                tag="not listed"
                onPick={() => pick(typed)}
              >
                Use “{typed}”
              </ModelRow>
            )}
          </AppCommandList>
          <div
            className={cn(
              textVariantClasses('secondary'),
              'flex items-baseline justify-between gap-2.5 border-t border-line px-2.5 py-1.75 text-ink-faint'
            )}
          >
            {footer}
          </div>
        </AppPopoverContent>
      </AppPopover>
    </AppCommand>
  );
}
