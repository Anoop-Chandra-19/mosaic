import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { cn } from '@/lib/utils';
import { BulletEditor } from './BulletEditor';
import { HIDDEN_WHILE_READING } from './editorClasses';

/** "Add bullet", which opens the bullet editor empty. Pasting several lines adds each. */
export function AddBulletButton({ onAdd }: { onAdd: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  // Alt+Enter saves and starts over with an empty editor: a fresh one, under a new key.
  const [round, setRound] = useState(0);

  if (open) {
    return (
      <BulletEditor
        key={round}
        initial=""
        onAddBelow={(text) => {
          if (!text) return setOpen(false);
          onAdd(text);
          setRound((current) => current + 1);
        }}
        onSave={(text) => {
          if (text) onAdd(text);
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
        onPasteLines={(lines) => {
          lines.forEach(onAdd);
          setOpen(false);
        }}
      />
    );
  }

  return (
    <AppButton
      variant="quiet"
      size="xs"
      onClick={() => setOpen(true)}
      className={cn(
        'mt-0.75 h-7 justify-start gap-2 self-start px-1.5 font-normal',
        HIDDEN_WHILE_READING
      )}
    >
      <Plus />
      Add bullet
    </AppButton>
  );
}
