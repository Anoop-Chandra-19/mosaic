import { useState } from 'react';
import { Info } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        {/* Remounted per opening, so the name starts empty each time. */}
        {open && <NameVersionForm onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
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
      className="grid gap-4"
    >
      <DialogHeader>
        <DialogTitle>Name this version</DialogTitle>
        <DialogDescription>{template?.name}</DialogDescription>
      </DialogHeader>

      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="A name you’ll recognise later, like “Sent to Striped”"
        aria-label="Version name"
        maxLength={200}
        autoFocus
      />

      <p className="flex gap-2 rounded-lg border border-line-strong bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        <Info className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />
        {status === 'clean'
          ? 'Nothing has changed since the newest version, so this names that version rather than making a new one.'
          : 'Your draft is already saved. Naming pins it in history so you can find it later. Nothing is overwritten.'}
      </p>

      <DialogFooter>
        <AppButton type="button" variant="ghost" onClick={onDone}>
          Cancel
        </AppButton>
        <AppButton type="submit" disabled={!trimmed || saving}>
          Name version
        </AppButton>
      </DialogFooter>
    </form>
  );
}
