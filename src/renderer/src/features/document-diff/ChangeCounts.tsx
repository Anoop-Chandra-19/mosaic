import type { ChangeTone } from '@shared/resume/changes/resumeChange';

/** "~2 +1 −1": edited, added and removed, each in its colour; a tone with none is left out. */
export function ChangeCounts({ counts }: { counts: Record<ChangeTone, number> }) {
  return (
    <span className="inline-flex gap-1.5 font-mono text-[0.6875rem]">
      {counts.edit > 0 && <span className="text-ink-soft">~{counts.edit}</span>}
      {counts.add > 0 && <span className="text-add">+{counts.add}</span>}
      {counts.del > 0 && <span className="text-del">−{counts.del}</span>}
    </span>
  );
}
