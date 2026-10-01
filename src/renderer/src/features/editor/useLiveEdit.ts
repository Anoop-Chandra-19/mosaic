import { useEffect, useEffectEvent, useId } from 'react';
import { useLiveEditStore, type LiveEdit } from '@/stores/liveEditStore';

/** Shows `text` in the preview while it is typed; null when the editor isn't open. */
export function useLiveEdit(text: string | null, toLiveEdit?: (text: string) => LiveEdit) {
  const owner = useId();
  const show = useEffectEvent((typed: string) => {
    if (toLiveEdit) useLiveEditStore.getState().show(owner, toLiveEdit(typed));
  });

  useEffect(() => {
    if (text === null) return;
    show(text);
    return () => useLiveEditStore.getState().clear(owner);
  }, [text, owner]);
}
