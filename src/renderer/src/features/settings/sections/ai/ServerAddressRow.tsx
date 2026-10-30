import { useState, type ReactNode } from 'react';
import { AppButton, AppInput, textVariantClasses } from '@/components/ui-kit';
import { cn } from '@/lib/utils';
import { SettingRow } from '../../SettingRow';

export function ServerCommand({ children }: { children: ReactNode }) {
  return (
    <code
      className={cn(
        textVariantClasses('key'),
        'rounded-xs bg-line px-1 whitespace-nowrap text-foreground'
      )}
    >
      {children}
    </code>
  );
}

export function ServerNote({ tone, children }: { tone: 'error' | 'warning'; children: ReactNode }) {
  return (
    <span className={tone === 'error' ? 'mt-1 block text-del' : 'mt-1 block text-warn'}>
      {children}
    </span>
  );
}

interface ServerAddressRowProps {
  label: string;
  address: string;
  defaultAddress: string;
  /** The server's own rules for what counts as an address; null when the text isn't one. */
  normalize: (input: string) => string | null;
  /** Shown when what was typed isn't an address. */
  example: string;
  /** Where resume text will go from this address. */
  description: string;
  onChange: (address: string) => void;
}

/**
 * Where a model server is: this computer by default, or a box on the network. The address is
 * saved on Enter or when the field is left, never mid-typing, so a half-typed address is
 * never asked for anything.
 */
export function ServerAddressRow({
  label,
  address,
  defaultAddress,
  normalize,
  example,
  description,
  onChange,
}: ServerAddressRowProps) {
  // What is being typed; null while the field shows the saved address.
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && draft.trim() !== '' && normalize(draft) === null;

  const commit = () => {
    if (draft === null) return;
    const next = normalize(draft);
    if (next !== null) onChange(next);
    // An empty field goes back to the saved address; a bad one stays for fixing.
    if (next !== null || draft.trim() === '') setDraft(null);
  };

  return (
    <SettingRow
      label={label}
      description={
        <>
          {description}
          {invalid && (
            <ServerNote tone="error">
              That isn’t an address. For example: <ServerCommand>{example}</ServerCommand>
            </ServerNote>
          )}
        </>
      }
    >
      <AppInput
        value={draft ?? address}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
          if (event.key === 'Escape') setDraft(null);
        }}
        aria-label={label}
        aria-invalid={invalid}
        spellCheck={false}
        autoComplete="off"
        className="w-54 font-mono text-meta"
      />
      {address !== defaultAddress && (
        <AppButton
          variant="ghost"
          size="sm"
          onClick={() => {
            setDraft(null);
            onChange(defaultAddress);
          }}
        >
          Use this computer
        </AppButton>
      )}
    </SettingRow>
  );
}
