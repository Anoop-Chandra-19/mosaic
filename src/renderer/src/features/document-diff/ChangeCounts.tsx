import { Text } from '@/components/Text';
import type { ChangeTone } from '@shared/resume/changes/resumeChange';

/** "~2 +1 −1": edited, added and removed, each in its colour; a tone with none is left out. */
export function ChangeCounts({ counts }: { counts: Record<ChangeTone, number> }) {
  return (
    <Text variant="meta" className="inline-flex gap-1.5">
      {counts.edit > 0 && <span className="text-ink-soft">~{counts.edit}</span>}
      {counts.add > 0 && <span className="text-add">+{counts.add}</span>}
      {counts.del > 0 && <span className="text-del">−{counts.del}</span>}
    </Text>
  );
}
