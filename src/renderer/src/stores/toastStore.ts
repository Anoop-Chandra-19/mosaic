import { create } from 'zustand';

/**
 * The one toast showing at the foot of the workspace, and how the app reports to the user:
 * `showToast` for news, `attempt` for an action that may fail. Never persisted.
 */

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error';
  /** One follow-up, such as Undo. Running it dismisses the toast. */
  action?: ToastAction;
  /** Shown in place of a success's tick: `DEV` for the developer tools' news. */
  tag?: 'DEV';
}

interface ToastState {
  toast: Toast | null;
  dismissToast: () => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toast: null,
  dismissToast: () => set({ toast: null }),
}));

const TOAST_MS = 5000;
/** Long enough to read the message and reach the button. */
const TOAST_WITH_ACTION_MS = 10000;
let nextToastId = 1;

export function showToast(
  message: string,
  tone: Toast['tone'] = 'success',
  action?: ToastAction,
  tag?: Toast['tag']
): void {
  const id = nextToastId++;
  useToastStore.setState({ toast: { id, message, tone, action, tag } });
  setTimeout(
    () => {
      if (useToastStore.getState().toast?.id === id) useToastStore.setState({ toast: null });
    },
    action ? TOAST_WITH_ACTION_MS : TOAST_MS
  );
}

/** A failure whose message is written for the user, so it is shown as it is. */
export class ExplainedError extends Error {}

/** What to tell the user about `error`: its own words if it has them, else `fallback`. */
export function explainFailure(error: unknown, fallback: string): string {
  console.error(fallback, error);
  return error instanceof ExplainedError ? error.message : fallback;
}

/**
 * Run a store action the user started, and say so if it fails — main refused it or the
 * disk did, and either way nothing was written.
 */
export async function attempt(action: Promise<unknown>, failure: string): Promise<boolean> {
  try {
    await action;
    return true;
  } catch (error) {
    showToast(explainFailure(error, failure), 'error');
    return false;
  }
}
