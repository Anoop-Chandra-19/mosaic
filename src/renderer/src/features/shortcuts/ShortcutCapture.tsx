import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { formatShortcutLabel, readShortcutCombo } from '@/lib/keyboardShortcuts';
import {
  explainRefusedShortcut,
  findShortcutConflict,
  type ShortcutId,
} from '@/lib/shortcutCatalog';
import { useUiStore } from '@/stores/uiStore';
import { labelShortcut } from './shortcutList';

interface ShortcutCaptureProps {
  id: ShortcutId;
  /** Ended: with new keys, none, or the old ones kept. */
  onDone: () => void;
}

type Answer =
  | { kind: 'refused'; combo: string; reason: string }
  | { kind: 'taken'; combo: string; takenBy: ShortcutId };

/**
 * A row listening for its action's new keys. Keys something else owns are refused with the
 * reason; keys another action has are asked about, and taking them leaves that one unbound.
 * Esc cancels, and Tab still moves on to Unbind and Cancel.
 */
export function ShortcutCapture({ id, onDone }: ShortcutCaptureProps) {
  const bindings = useUiStore((s) => s.shortcutBindings);
  const bindShortcut = useUiStore((s) => s.bindShortcut);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => boxRef.current?.focus(), []);
  const label = labelShortcut(id);

  const listen = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onDone();
      return;
    }
    // Keys on Unbind or Cancel are theirs; only the box itself listens.
    if (event.target !== event.currentTarget || event.key === 'Tab') return;
    event.preventDefault();
    event.stopPropagation();
    const combo = readShortcutCombo(event.nativeEvent);
    if (!combo) return;
    const reason = explainRefusedShortcut(id, combo, {
      platform: window.mosaic.platform,
      isDevelopment: import.meta.env.DEV,
    });
    if (reason) return setAnswer({ kind: 'refused', combo, reason });
    const takenBy = findShortcutConflict(bindings, id, combo);
    if (takenBy) return setAnswer({ kind: 'taken', combo, takenBy });
    bindShortcut(id, combo);
    onDone();
  };

  const listenAgain = () => {
    setAnswer(null);
    boxRef.current?.focus();
  };

  return (
    <div
      tabIndex={0}
      ref={boxRef}
      role="group"
      aria-label={`New keys for ${label}`}
      // Esc here cancels the capture, not the dialog around it.
      data-keeps-escape=""
      onKeyDown={listen}
      className="my-0.5 rounded-sm border border-amber-line bg-pane-raised p-1.75 ring-3 ring-amber-soft outline-none"
    >
      <div className="flex items-center gap-2.5">
        <Text variant="body" className="min-w-0 flex-1 truncate text-foreground">
          {label}
        </Text>
        <Text variant="key" role="status" className="flex items-center gap-1.5 text-amber">
          <i
            aria-hidden
            className="block size-1.5 animate-pulse rounded-full bg-amber motion-reduce:animate-none"
          />
          {answer ? formatShortcutLabel(answer.combo) : 'listening'}
        </Text>
      </div>
      {answer?.kind === 'taken' ? (
        <ConflictNote
          combo={answer.combo}
          takenBy={answer.takenBy}
          onPickAnother={listenAgain}
          onReassign={() => {
            bindShortcut(id, answer.combo, answer.takenBy);
            onDone();
          }}
        />
      ) : (
        <div className="mt-2 flex items-center gap-1.5">
          <Text
            variant="secondary"
            className={answer ? 'min-w-0 flex-1 text-warn' : 'min-w-0 flex-1 text-ink-faint'}
          >
            {answer ? answer.reason : 'Press a combination, or'}
          </Text>
          <AppButton
            variant="ghost"
            size="xs"
            onClick={() => {
              bindShortcut(id, null);
              onDone();
            }}
          >
            Unbind
          </AppButton>
          <AppButton variant="ghost" size="xs" onClick={onDone}>
            Cancel
            <Text variant="key" className="text-ink-faint">
              esc
            </Text>
          </AppButton>
        </div>
      )}
    </div>
  );
}

interface ConflictNoteProps {
  combo: string;
  takenBy: ShortcutId;
  onPickAnother: () => void;
  onReassign: () => void;
}

function ConflictNote({ combo, takenBy, onPickAnother, onReassign }: ConflictNoteProps) {
  return (
    <div className="mt-2 rounded-sm border border-warn-line bg-warn-soft px-2.5 py-2.25">
      <Text as="p" variant="secondary" className="flex items-center gap-1.5 font-strong text-warn">
        <TriangleAlert className="size-3.25 shrink-0" />
        {formatShortcutLabel(combo)} is taken
      </Text>
      <Text as="p" variant="secondary" className="mt-0.75 text-ink-soft">
        Right now it is <b className="font-strong text-foreground">{labelShortcut(takenBy)}</b>.
        Assign it here and that action is left without a shortcut.
      </Text>
      <div className="mt-2 flex gap-1.5">
        <AppButton variant="outline" size="xs" onClick={onPickAnother}>
          Pick another combination
        </AppButton>
        <AppButton variant="accent" size="xs" onClick={onReassign}>
          Reassign anyway
        </AppButton>
      </div>
    </div>
  );
}
