import { useState } from 'react';
import { ArrowRight, Check, Info, LayoutTemplate, Save } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppDialog, AppDialogContent, AppDialogDescription } from '@/components/AppDialog';
import { AppInput } from '@/components/AppInput';
import { AppRadioGroup, AppRadioGroupItem } from '@/components/AppRadioGroup';
import { DialogFrameBody, DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';
import { Note } from '@/components/Note';
import { Text } from '@/components/Text';
import { versionLabel } from '@/features/history/useTemplateVersions';
import { DbError } from '@/lib/storage/mosaicDb';
import { cn } from '@/lib/utils';
import { useOverlayStore } from '@/stores/overlayStore';
import { attempt, showToast } from '@/stores/toastStore';
import { useTemplateStore } from '@/stores/templateStore';
import { canAddToVersion } from '@shared/history/canAddToVersion';
import type { NamingMode, VersionMeta } from '@shared/types/db';
import { useActiveTemplate } from './useActiveTemplate';
import { useTemplateStatus } from './useTemplateStatus';

/**
 * Naming only pins a point in history so it is easy to find — the draft is already saved,
 * and nothing is overwritten. A draft that matches the newest version names that version.
 * One that doesn't can be a version of its own, or a revision of the user's own newest
 * version (v13.1), which leaves that version exactly as it was.
 */
export function NameVersionDialog() {
  const open = useOverlayStore((s) => s.nameVersionOpen);
  const setOpen = useOverlayStore((s) => s.setNameVersionOpen);

  return (
    <AppDialog open={open} onOpenChange={setOpen}>
      <AppDialogContent showCloseButton={false} className="w-[min(35rem,96vw)] gap-0 p-0">
        {/* Remounted per opening, so the name starts empty each time. */}
        {open && <NameVersionForm onDone={() => setOpen(false)} />}
      </AppDialogContent>
    </AppDialog>
  );
}

/** What Save does: name the newest version itself, or write a new row. */
type NamingAction = 'rename' | NamingMode;

/** The labels each choice writes, from the newest version. */
function targetsOf(head: VersionMeta) {
  return {
    head: versionLabel(head),
    next: `v${head.number + 1}`,
    revision: versionLabel({ ...head, revision: head.revision + 1 }),
  };
}

type Targets = ReturnType<typeof targetsOf>;

const TARGETS: Record<NamingAction, (targets: Targets) => string> = {
  rename: (t) => t.head,
  new: (t) => t.next,
  add: (t) => t.revision,
};

const NOTES: Record<NamingAction, (targets: Targets) => string> = {
  rename: (t) =>
    `Nothing has changed since ${t.head}, so this names that version rather than making a new one. Its contents stay exactly as they are.`,
  new: () =>
    'Your draft is already saved. Naming keeps this point in history for good, so you can find it and go back to it. Nothing is overwritten.',
  add: (t) =>
    `${t.revision} is your draft as it is now, kept for good under this name. Restoring ${t.head} still brings back ${t.head} as it was.`,
};

const isRefusedAdding = (error: unknown) => error instanceof DbError && error.code === 'stale-rev';

function NameVersionForm({ onDone }: { onDone: () => void }) {
  const template = useActiveTemplate();
  const status = useTemplateStatus();
  const nameVersion = useTemplateStore((s) => s.nameVersion);
  const head = template?.head;
  const isClean = status === 'clean';
  const [openedAt] = useState(Date.now);
  const canAdd = !!head && !isClean && canAddToVersion(head, 'name', openedAt);
  const [mode, setMode] = useState<NamingMode>('new');
  const [newName, setNewName] = useState('');
  // Adding to a named version starts from its name: most often it is the same thing, fixed.
  const [addName, setAddName] = useState(head?.kind === 'named' ? head.summary : '');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isAdding = canAdd && mode === 'add';
  const name = isAdding ? addName : newName;
  const setName = isAdding ? setAddName : setNewName;
  const trimmed = name.trim();
  const action: NamingAction = isClean ? 'rename' : isAdding ? 'add' : 'new';
  const targets = head ? targetsOf(head) : null;

  const choose = (next: NamingMode) => {
    setMode(next);
    setRefusal(null);
  };

  // Main checks Add again: if the newest version moved on meanwhile, nothing is saved and
  // the dialog falls back to a version of its own, keeping the name.
  const save = async () => {
    try {
      const version = await nameVersion(trimmed, isAdding ? 'add' : 'new');
      showToast(`Named “${trimmed}” as ${versionLabel(version)}`);
      onDone();
    } catch (error) {
      if (!isRefusedAdding(error)) throw error;
      setRefusal('The newest version changed while this was open.');
      setNewName(trimmed);
      setMode('new');
    }
  };

  const submit = async () => {
    if (!trimmed || saving) return;
    setSaving(true);
    await attempt(save(), 'Could not name this version');
    setSaving(false);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="contents"
    >
      <DialogFrameHeader
        icon={Save}
        title="Name this version"
        closeLabel="Close"
        onClose={onDone}
      />
      <DialogFrameBody>
        <AppDialogDescription className="flex flex-wrap items-center gap-1.75 font-mono text-meta text-ink-muted">
          <LayoutTemplate aria-hidden className="size-3.25" />
          <span className="text-ink-soft">{template?.name}</span>
          {targets &&
            (isClean ? (
              <span className="text-amber">{targets.head}</span>
            ) : (
              <>
                <span>{targets.head}</span>
                <ArrowRight aria-hidden className="size-3" />
                <span className="text-amber">{TARGETS[action](targets)}</span>
              </>
            ))}
        </AppDialogDescription>
        {canAdd && targets && (
          <div>
            <Text as="p" variant="eyebrow" className="mb-1.75">
              In history
            </Text>
            {refusal && (
              <Text
                as="p"
                role="alert"
                variant="secondary"
                className="mb-2 rounded-md bg-warn-soft px-2.5 py-2 text-pretty text-ink-soft shadow-[inset_0_0_0_1px_var(--warn-line)]"
              >
                <span className="font-strong text-foreground">Not saved yet.</span> {refusal} It
                will be {targets.next}; press Save again.
              </Text>
            )}
            <AppRadioGroup
              value={mode}
              onValueChange={(value) => choose(value as NamingMode)}
              aria-label="In history"
              className="gap-1.5"
            >
              <NamingOption
                value="new"
                isChosen={mode === 'new'}
                title={`New version, ${targets.next}`}
                description={`A version of its own, after ${targets.head}.`}
              />
              <NamingOption
                value="add"
                isChosen={mode === 'add'}
                title={`Add to ${targets.head}`}
                description={`Saved as ${targets.revision}, a revision of ${targets.head}. ${targets.head} stays exactly as it was.`}
              />
            </AppRadioGroup>
          </div>
        )}
        <div>
          <Text as="label" htmlFor="version-name" variant="eyebrow" className="mb-1.5 block">
            Name
          </Text>
          <AppInput
            id="version-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="A name you’ll recognise later, like “Sent to Striped”"
            aria-label="Version name"
            maxLength={200}
            autoFocus
          />
          {isAdding && head?.kind === 'named' && targets && (
            <Text as="p" variant="secondary" className="mt-1.25 text-ink-muted">
              From {targets.head}. Change it if this one is different.
            </Text>
          )}
        </div>
        {targets && (
          <Note icon={Info} size="sm">
            {NOTES[action](targets)}
          </Note>
        )}
      </DialogFrameBody>
      <DialogFrameFooter>
        <AppButton type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </AppButton>
        <AppButton type="submit" variant="accent" size="sm" disabled={!trimmed || saving}>
          <Check />
          {targets ? `${isClean ? 'Name' : 'Save'} ${TARGETS[action](targets)}` : 'Name version'}
        </AppButton>
      </DialogFrameFooter>
    </form>
  );
}

interface NamingOptionProps {
  value: NamingMode;
  isChosen: boolean;
  title: string;
  description: string;
}

function NamingOption({ value, isChosen, title, description }: NamingOptionProps) {
  const id = `naming-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-2.25 rounded-md border px-2.5 py-2',
        isChosen ? 'border-line-heavy bg-line' : 'border-line hover:border-line-strong'
      )}
    >
      <AppRadioGroupItem id={id} value={value} className="mt-0.5" />
      <span>
        <Text variant="body" className="block font-control text-foreground">
          {title}
        </Text>
        <Text variant="secondary" className="block text-pretty text-ink-muted">
          {description}
        </Text>
      </span>
    </label>
  );
}
