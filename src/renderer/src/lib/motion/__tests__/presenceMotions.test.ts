import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOTION_EASE, MOTION_EASE_IN } from '../motionTiming';
import { pop, readPresenceFrame, type PresenceFrame } from '../presenceMotions';

function mockBrowser(resting: PresenceFrame = { opacity: '1', transform: 'none' }) {
  class FakeAnimation {
    id = '';
  }
  vi.stubGlobal('Animation', FakeAnimation);
  const animation = new Animation();
  const animate = vi.fn(() => animation);
  const element = { animate } as unknown as HTMLElement;
  const root = {};
  const rootStyle = { fontSize: '16px' };
  const getStyle = vi.fn((target: unknown) => (target === root ? rootStyle : resting));
  const matchMedia = vi.fn(() => ({ matches: false }));
  vi.stubGlobal('getComputedStyle', getStyle);
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('window', { matchMedia });
  return { element, animate, animation, rootStyle, getStyle, matchMedia };
}

afterEach(() => vi.unstubAllGlobals());

const hidden = { opacity: '0', transform: 'translateY(6px) scale(0.98)' };
const resting = { opacity: '1', transform: 'none' };

describe('readPresenceFrame', () => {
  it('reads the computed opacity and transform', () => {
    const frame = { opacity: '0.7', transform: 'matrix(1, 0, 0, 1, 4, 8)' };
    const browser = mockBrowser(frame);
    expect(readPresenceFrame(browser.element)).toEqual(frame);
    expect(browser.getStyle).toHaveBeenCalledExactlyOnceWith(browser.element);
    expect(browser.animate).not.toHaveBeenCalled();
  });
});

describe('pop', () => {
  it.each([
    ['enter', 200, MOTION_EASE],
    ['exit', 150, MOTION_EASE_IN],
  ] as const)('animates a normal %s', (phase, duration, easing) => {
    const browser = mockBrowser();
    expect(pop(browser.element, phase)).toBe(browser.animation);
    expect(browser.animate).toHaveBeenCalledExactlyOnceWith(
      phase === 'enter' ? [hidden, resting] : [resting, hidden],
      { duration, easing, fill: 'both' }
    );
    expect(browser.animation.id).toBe(`presence-${phase}`);
    expect(browser.matchMedia).toHaveBeenCalledExactlyOnceWith('(prefers-reduced-motion: reduce)');
  });

  it.each(['enter', 'exit'] as const)(
    'resumes an interrupted %s from its snapshot, preserving the base target',
    (phase) => {
      const base = { opacity: '0.9', transform: 'matrix(1, 0, 0, 1, 12, 3)' };
      const from = { opacity: '0.4', transform: 'translateY(2px) scale(0.99)' };
      const browser = mockBrowser(base);
      pop(browser.element, phase, from);
      const target =
        phase === 'enter'
          ? base
          : {
              opacity: '0',
              transform: `translateY(6px) scale(0.98) ${base.transform}`,
            };
      expect(browser.animate).toHaveBeenCalledExactlyOnceWith([from, target], expect.any(Object));
    }
  );

  it('preserves the base transform in a normal entrance', () => {
    const base = { opacity: '0.8', transform: 'scale(1.1)' };
    const browser = mockBrowser(base);
    pop(browser.element, 'enter');
    expect(browser.animate).toHaveBeenCalledExactlyOnceWith(
      [{ opacity: '0', transform: 'translateY(6px) scale(0.98) scale(1.1)' }, base],
      expect.any(Object)
    );
  });

  it('measures the rem offset from the current root font size on every call', () => {
    const browser = mockBrowser();
    browser.rootStyle.fontSize = '20px';
    pop(browser.element, 'enter');
    expect(browser.animate.mock.calls[0]).toEqual([
      [{ opacity: '0', transform: 'translateY(7.5px) scale(0.98)' }, resting],
      expect.any(Object),
    ]);
    browser.rootStyle.fontSize = '32px';
    pop(browser.element, 'exit');
    expect(browser.animate.mock.calls[1]).toEqual([
      [resting, { opacity: '0', transform: 'translateY(12px) scale(0.98)' }],
      expect.any(Object),
    ]);
  });

  it.each(['enter', 'exit'] as const)(
    'skips measuring and animating %s with reduced motion',
    (phase) => {
      const browser = mockBrowser();
      browser.matchMedia.mockReturnValue({ matches: true });
      expect(pop(browser.element, phase)).toBeNull();
      expect(browser.getStyle).not.toHaveBeenCalled();
      expect(browser.animate).not.toHaveBeenCalled();
    }
  );
});
