import { useState } from 'react';
import { Check, Info, Save } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppDialog, AppDialogContent, AppDialogDescription } from '@/components/AppDialog';
import { AppInput } from '@/components/AppInput';
import { DialogFrameBody, DialogFrameFooter, DialogFrameHeader } from '@/components/DialogFrame';
import { Note } from '@/components/Note';
import { attempt, showToast, useOverlayStore } from '@/stores/overlayStore';
import { useTemplateStore } from '@/stores/templateStore';
import { useActiveTemplate } from './useActiveTemplate';
import { useTemplateStatus } from './useTemplateStatus';

/**
 * Naming only pins a point in history so it is easy to find — the draft is already saved,
 * and nothing is overwritten. A draft that matches the newest version names that version.
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

function NameVersionForm({ onDone }: { onDone: () => void }) {
  const template = useActiveTemplate();
  const status = useTemplateStatus();
  const nameVersion = useTemplateStore((s) => s.nameVersion);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed || saving) return;
    setSaving(true);
    const named = await attempt(nameVersion(trimmed), 'Could not name this version');
    setSaving(false);
    if (!named) return;
    showToast(`Named “${trimmed}”`);
    onDone();
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
        <AppDialogDescription className="font-mono text-meta text-ink-soft">
          {template?.name}
        </AppDialogDescription>
        <AppInput
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="A name you’ll recognise later, like “Sent to Striped”"
          aria-label="Version name"
          maxLength={200}
          autoFocus
        />
        <Note icon={Info} size="sm">
          {status === 'clean'
            ? 'Nothing has changed since the newest version, so this names that version rather than making a new one.'
            : 'Your draft is already saved. Naming pins it in history so you can find it later. Nothing is overwritten.'}
        </Note>
      </DialogFrameBody>
      <DialogFrameFooter>
        <AppButton type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </AppButton>
        <AppButton type="submit" variant="accent" size="sm" disabled={!trimmed || saving}>
          <Check />
          Name version
        </AppButton>
      </DialogFrameFooter>
    </form>
  );
}
