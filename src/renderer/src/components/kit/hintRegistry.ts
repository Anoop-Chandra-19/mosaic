import type { ReactNode } from 'react';

/** Marks an element with a hint; its value is the hint's id here. */
export const HINTED = 'data-app-tooltip';

export type HintSide = 'top' | 'right' | 'bottom' | 'left';

/** What an `AppTooltip` asks the hint layer to show for its element. */
export interface HintOptions {
  content: ReactNode;
  side: HintSide;
  align: 'start' | 'center' | 'end';
  isDisabled: boolean;
  shouldFollowPointer: boolean;
}

const hints = new Map<string, HintOptions>();
const listeners = new Set<(id: string) => void>();

export function hasHintContent(content: ReactNode): boolean {
  return content !== undefined && content !== null && content !== '';
}

export function readHint(id: string): HintOptions | undefined {
  return hints.get(id);
}

export function setHint(id: string, options: HintOptions) {
  hints.set(id, options);
  for (const listener of listeners) listener(id);
}

export function removeHint(id: string) {
  hints.delete(id);
  for (const listener of listeners) listener(id);
}

/** Calls `listener` with the id of every hint that changes or goes. */
export function watchHints(listener: (id: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
