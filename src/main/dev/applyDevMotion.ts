import type { WebContents } from 'electron';
import type { DevSwitches } from '@shared/types/devTools';

/** Slow motion plays every animation at this rate. */
const SLOW_MOTION_RATE = 0.1;

/**
 * Slow and reduced motion, through the page's debugger: it reaches CSS transitions and
 * animations, `element.animate()` and view transitions alike, with no app code. It sits
 * beside DevTools and e2e's own connection. Left unattached until a switch needs it.
 */
export async function applyDevMotion(page: WebContents, switches: DevSwitches): Promise<void> {
  const { debugger: pageDebugger } = page;
  if (!pageDebugger.isAttached()) {
    if (!switches.slowMotion && !switches.reducedMotion) return;
    pageDebugger.attach('1.3');
  }
  await pageDebugger.sendCommand('Animation.enable');
  await pageDebugger.sendCommand('Animation.setPlaybackRate', {
    playbackRate: switches.slowMotion ? SLOW_MOTION_RATE : 1,
  });
  await pageDebugger.sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: switches.reducedMotion ? 'reduce' : '' }],
  });
}
