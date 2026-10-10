import { isHistoryTipSeen } from '@/stores/uiStore';
import type { HistoryTips } from '@/types/history';
import type { HistoryItem } from '../groupVersionHistory';
import { HISTORY_TIPS, type HistoryTip, type HistoryTipContext } from './historyTips';

export interface ChosenHistoryTip {
  tip: HistoryTip;
  item: HistoryItem;
}

/**
 * The tip to show for the rows in view, newest first: the most basic kind not yet seen,
 * on the first row of that kind. Null when every kind in view is seen, or tips are off.
 */
export function chooseHistoryTip(
  inView: readonly HistoryItem[],
  tips: HistoryTips,
  context: HistoryTipContext
): ChosenHistoryTip | null {
  if (!tips.isOn) return null;
  for (const tip of HISTORY_TIPS) {
    if (isHistoryTipSeen(tips.seen[tip.id]) || (tip.applies && !tip.applies(context))) continue;
    const item = inView.find((candidate) => tip.matches(candidate));
    if (item) return { tip, item };
  }
  return null;
}
