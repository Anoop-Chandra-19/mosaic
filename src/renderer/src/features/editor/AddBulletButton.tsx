import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { BulletEditor } from './BulletEditor';

/** "Add bullet", which opens the bullet editor empty. Pasting several lines adds each. */
export function AddBulletButton({ onAdd }: { onAdd: (text: string) => void }) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <BulletEditor
        initial=""
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
      className="mt-[0.1875rem] h-7 justify-start gap-2 self-start px-1.5 font-normal"
    >
      <Plus />
      Add bullet
    </AppButton>
  );
}
