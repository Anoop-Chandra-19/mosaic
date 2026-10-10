import { afterEach, describe, expect, it, vi } from 'vitest';
import { MOTION_EASE, MOTION_EASE_IN } from '../motionTiming';
import { type PresenceFrame, type PresenceFrames } from '../presenceMotions';
import { stagger } from '../staggerPresence';

const resting = { opacity: '1', transform: 'none' };
const hiddenRow = { opacity: '0', transform: 'translateY(-3px)' };
const hiddenStretch = { opacity: '1', transform: 'scaleY(0)' };

class FakeHTMLElement {
  animation = { id: '' } as Animation;
  animate = vi.fn<(frames: Keyframe[], options: KeyframeAnimationOptions) => Animation>(
    () => this.animation
  );
  children: unknown[] = [];
  querySelector = vi.fn<(selector: string) => FakeHTMLElement | null>(() => null);
  frame: PresenceFrame = resting;

  get element(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

function mockBrowser(rowCount = 5, hasStretch = true) {
  vi.stubGlobal('HTMLElement', FakeHTMLElement);
  const root = new FakeHTMLElement();
  const list = new FakeHTMLElement();
  const rows = Array.from({ length: rowCount }, () => new FakeHTMLElement());
  const stretch = new FakeHTMLElement();
  list.children = rows;
  root.querySelector.mockImplementation((selector) => {
    if (selector === '[data-presence-list]') return list;
    if (selector === '[data-presence-stretch]' && hasStretch) return stretch;
    return null;
  });
  const documentRoot = {};
  const rootStyle = { fontSize: '16px' };
  const getStyle = vi.fn((target: unknown) =>
    target === documentRoot ? rootStyle : (target as FakeHTMLElement).frame
  );
  const matchMedia = vi.fn(() => ({ matches: false }));
  vi.stubGlobal('getComputedStyle', getStyle);
  vi.stubGlobal('document', { documentElement: documentRoot });
  vi.stubGlobal('window', { matchMedia });
  return { root, list, rows, stretch, rootStyle, getStyle, matchMedia };
}

afterEach(() => vi.unstubAllGlobals());

describe('stagger', () => {
  it.each([
    ['enter', 160, 180, MOTION_EASE],
    ['exit', 80, 120, MOTION_EASE_IN],
  ] as const)(
    'returns the row and stretch animations for %s',
    (phase, rowDuration, stretchDuration, easing) => {
      const browser = mockBrowser();
      expect(stagger(browser.root.element, phase)).toEqual([
        ...browser.rows.map((row) => row.animation),
        browser.stretch.animation,
      ]);
      const delays = phase === 'enter' ? [0, 30, 60, 90, 90] : [0, 0, 0, 0, 0];
      browser.rows.forEach((row, index) => {
        expect(row.animate).toHaveBeenCalledExactlyOnceWith(
          phase === 'enter' ? [hiddenRow, resting] : [resting, hiddenRow],
          { duration: rowDuration, delay: delays[index], easing, fill: 'both' }
        );
        expect(row.animation.id).toBe(`presence-${phase}`);
      });
      expect(browser.stretch.animate).toHaveBeenCalledExactlyOnceWith(
        phase === 'enter' ? [hiddenStretch, resting] : [resting, hiddenStretch],
        { duration: stretchDuration, delay: 0, easing, fill: 'both' }
      );
      expect(browser.stretch.animation.id).toBe(`presence-${phase}`);
      expect(browser.root.animate).not.toHaveBeenCalled();
      expect(browser.list.animate).not.toHaveBeenCalled();
      expect(browser.matchMedia).toHaveBeenCalledExactlyOnceWith(
        '(prefers-reduced-motion: reduce)'
      );
    }
  );

  it('animates only direct HTML children, with no stretch required', () => {
    const browser = mockBrowser(2, false);
    const nested = new FakeHTMLElement();
    const nonHtml = { animate: vi.fn() };
    browser.rows[0].children = [nested];
    browser.list.children = [browser.rows[0], nonHtml, browser.rows[1]];
    expect(stagger(browser.root.element, 'enter')).toEqual(
      browser.rows.map((row) => row.animation)
    );
    expect(browser.rows[1].animate).toHaveBeenCalledExactlyOnceWith([hiddenRow, resting], {
      duration: 160,
      delay: 30,
      easing: MOTION_EASE,
      fill: 'both',
    });
    expect(nested.animate).not.toHaveBeenCalled();
    expect(nonHtml.animate).not.toHaveBeenCalled();
    expect(browser.stretch.animate).not.toHaveBeenCalled();
  });

  it.each([true, false])('handles an empty list with stretch=%s', (hasStretch) => {
    const browser = mockBrowser(0, hasStretch);
    expect(stagger(browser.root.element, 'enter')).toEqual(
      hasStretch ? [browser.stretch.animation] : []
    );
  });

  it('returns an empty array when neither target exists', () => {
    const browser = mockBrowser();
    browser.root.querySelector.mockReturnValue(null);
    expect(stagger(browser.root.element, 'enter')).toEqual([]);
    expect(browser.rows.every((row) => row.animate.mock.calls.length === 0)).toBe(true);
    expect(browser.stretch.animate).not.toHaveBeenCalled();
  });

  it.each(['enter', 'exit'] as const)(
    'resumes each interrupted target independently on %s',
    (phase) => {
      const browser = mockBrowser(3);
      const firstRow = browser.rows[0];
      const secondRow = browser.rows[1];
      firstRow.frame = { opacity: '0.8', transform: 'scale(1.1)' };
      browser.stretch.frame = { opacity: '0.9', transform: 'scale(1.2)' };
      const firstFrame = { opacity: '0.2', transform: 'translateY(-2px) scale(1.1)' };
      const secondFrame = { opacity: '0.6', transform: 'translateY(-1px)' };
      const stretchFrame = { opacity: '0.9', transform: 'scaleY(0.4) scale(1.2)' };
      const frames: PresenceFrames = new Map([
        [browser.root.element, { opacity: '0.1', transform: 'scale(0.5)' }],
        [firstRow.element, firstFrame],
        [secondRow.element, secondFrame],
        [browser.stretch.element, stretchFrame],
      ]);
      stagger(browser.root.element, phase, frames);
      expect(firstRow.animate).toHaveBeenCalledExactlyOnceWith(
        [
          firstFrame,
          phase === 'enter'
            ? firstRow.frame
            : { opacity: '0', transform: 'translateY(-3px) scale(1.1)' },
        ],
        expect.any(Object)
      );
      expect(secondRow.animate).toHaveBeenCalledExactlyOnceWith(
        [secondFrame, phase === 'enter' ? resting : hiddenRow],
        expect.any(Object)
      );
      expect(browser.stretch.animate).toHaveBeenCalledExactlyOnceWith(
        [
          stretchFrame,
          phase === 'enter'
            ? browser.stretch.frame
            : { opacity: '0.9', transform: 'scaleY(0) scale(1.2)' },
        ],
        expect.any(Object)
      );
      expect(browser.rows[2].animate).toHaveBeenCalledExactlyOnceWith(
        phase === 'enter' ? [hiddenRow, resting] : [resting, hiddenRow],
        expect.any(Object)
      );
    }
  );

  it('measures row offsets from the current root font size on every call', () => {
    const browser = mockBrowser(1, false);
    browser.rootStyle.fontSize = '20px';
    stagger(browser.root.element, 'enter');
    expect(browser.rows[0].animate.mock.calls[0][0]).toEqual([
      { opacity: '0', transform: 'translateY(-3.75px)' },
      resting,
    ]);
    browser.rootStyle.fontSize = '32px';
    stagger(browser.root.element, 'exit');
    expect(browser.rows[0].animate.mock.calls[1][0]).toEqual([
      resting,
      { opacity: '0', transform: 'translateY(-6px)' },
    ]);
  });

  it.each(['enter', 'exit'] as const)(
    'skips querying, measuring and animating %s with reduced motion',
    (phase) => {
      const browser = mockBrowser();
      browser.matchMedia.mockReturnValue({ matches: true });
      expect(stagger(browser.root.element, phase)).toBeNull();
      expect(browser.root.querySelector).not.toHaveBeenCalled();
      expect(browser.getStyle).not.toHaveBeenCalled();
      expect(browser.root.animate).not.toHaveBeenCalled();
      browser.rows.forEach((row) => expect(row.animate).not.toHaveBeenCalled());
      expect(browser.stretch.animate).not.toHaveBeenCalled();
    }
  );
});
