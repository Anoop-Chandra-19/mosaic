import { useEffect, useEffectEvent } from 'react';
import { create } from 'zustand';

/**
 * Keyboard targets: places a shortcut can jump to that are drawn deep inside a feature,
 * where the shell's key handler can't reach. The shortcut asks for a target by name
 * (`requestTarget`); the component that draws it answers (`useTargetRequest`) by opening
 * its menu, focusing its field, or scrolling to its row. Never persisted.
 *
 * A request waits for its owner: a shortcut that first switches to the Content tab is
 * answered once the tab has drawn the target. Each is answered once, then cleared.
 */

/**
 * Every keyboard target in the app. `addSectionMenu`: Add section, from the content pane's +.
 * `devTools`: the developer tools, in development builds. `assistantPrompt`: the assistant's
 * prompt box.
 */
export type KeyboardTarget = 'addSectionMenu' | 'devTools' | 'assistantPrompt';

interface TargetRequest {
  target: KeyboardTarget;
  /** Counts up, so the same target asked for again is a new request. */
  seq: number;
}

interface TargetState {
  request: TargetRequest | null;
  requestTarget: (target: KeyboardTarget) => void;
  /** Clears the request numbered `seq`, and leaves a newer one waiting. */
  clearRequest: (seq: number) => void;
}

let nextSeq = 1;

export const useTargetStore = create<TargetState>()((set) => ({
  request: null,
  requestTarget: (target) => set({ request: { target, seq: nextSeq++ } }),
  clearRequest: (seq) => set((state) => (state.request?.seq === seq ? { request: null } : state)),
}));

/** Answers requests for `target`, including one made before this component mounted. */
export function useTargetRequest(target: KeyboardTarget, onRequest: () => void): void {
  const request = useTargetStore((s) => (s.request?.target === target ? s.request : null));
  const answer = useEffectEvent(onRequest);
  useEffect(() => {
    if (!request) return;
    useTargetStore.getState().clearRequest(request.seq);
    answer();
  }, [request]);
}
