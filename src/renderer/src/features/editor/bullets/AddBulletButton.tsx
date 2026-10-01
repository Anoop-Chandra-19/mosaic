import { useContext, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { carryTint, travelFrom } from '@/lib/motion/rowMotions';
import { ListMotionContext, useSwapMotion } from '@/lib/motion/useListMotion';
import { cn } from '@/lib/utils';
import type { LiveEdit } from '@/stores/liveEditStore';
import { BulletEditor } from './BulletEditor';
import { HIDDEN_WHILE_READING } from '../editorClasses';

/** "Add bullet", which opens the bullet editor empty. Pasting several lines adds each. */
export function AddBulletButton({
  onAdd,
  livePreview,
}: {
  onAdd: (text: string) => void;
  livePreview?: (text: string) => LiveEdit;
}) {
  const [open, setOpenNow] = useState(false);
  // Alt+Enter saves and starts over with an empty editor: a fresh one, under a new key.
  const [round, setRound] = useState(0);
  const slotRef = useRef<HTMLDivElement>(null);
  const motion = useContext(ListMotionContext);
  const beginSwap = useSwapMotion(open);

  const setOpen = (next: boolean) => {
    if (next !== open) beginSwap();
    setOpenNow(next);
  };

  // The new bullet settles from where the editor was.
  const add = (text: string) => {
    const fromTop = slotRef.current?.getBoundingClientRect().top;
    motion?.expect({
      arrive: (row) => {
        if (fromTop !== undefined) travelFrom(row, fromTop);
        carryTint(row.querySelector('[data-bullet-text]') ?? row);
      },
    });
    onAdd(text);
  };

  return (
    // Marked like a row, so it slides with them.
    <div ref={slotRef} data-sort-id="add-bullet" className="flex flex-col">
      {open ? (
        <BulletEditor
          key={round}
          initial=""
          livePreview={livePreview}
          onAddBelow={(text) => {
            if (!text) return setOpen(false);
            add(text);
            setRound((current) => current + 1);
          }}
          onSave={(text) => {
            if (text) add(text);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
          onPasteLines={(lines) => {
            lines.forEach(onAdd);
            setOpen(false);
          }}
        />
      ) : (
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
      )}
    </div>
  );
}
