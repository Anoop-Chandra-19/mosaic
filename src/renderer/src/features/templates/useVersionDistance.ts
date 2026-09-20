import { useResumeStore } from '@/stores/resumeStore';
import { useActiveTemplate } from './useActiveTemplate';

/**
 * How far the draft has moved from the newest version in history. `changes` is only worth
 * printing when it is `counted`: undo and redo walk the draft back and forth, so the rev
 * alone can say "edited" about a draft that has been undone right back to the version.
 */
export interface VersionDistance {
  /** The draft is the newest version, as far as this can tell. */
  matches: boolean;
  /** Steps between them, always positive; 0 when they match or nothing was counted. */
  changes: number;
  /** Those steps were undone rather than made. */
  undone: boolean;
  /** The steps were counted from the version itself, so `changes` can be shown. */
  counted: boolean;
}

export function useVersionDistance(): VersionDistance {
  const template = useActiveTemplate();
  const rev = useResumeStore((s) => s.rev);
  const changesSinceBaseline = useResumeStore((s) => s.changesSinceBaseline);
  const baselineRev = useResumeStore((s) => s.baselineRev);
  const baselineReachable = useResumeStore((s) => s.baselineReachable);

  // Counting works when this session started at the version: the draft was opened clean,
  // or a named version made it clean, and no edit has dropped the states in between.
  const counted = template !== undefined && baselineReachable && template.head.rev === baselineRev;
  if (!counted) {
    return {
      matches: template !== undefined && rev === template.head.rev,
      changes: 0,
      undone: false,
      counted: false,
    };
  }
  return {
    matches: changesSinceBaseline === 0,
    changes: Math.abs(changesSinceBaseline),
    undone: changesSinceBaseline < 0,
    counted: true,
  };
}
