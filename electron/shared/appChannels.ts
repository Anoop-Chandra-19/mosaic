/** Main → renderer: the window is closing, save what is pending. */
export const FLUSH_REQUEST = 'app:flush';
/** Renderer → main: pending saves have landed (or failed); the window may close. */
export const FLUSH_DONE = 'app:flushed';
