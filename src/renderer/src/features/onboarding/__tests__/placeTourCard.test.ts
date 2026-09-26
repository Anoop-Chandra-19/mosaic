import { describe, expect, it } from 'vitest';
import { placeTourCard } from '../placeTourCard';
import { TOUR_STEPS, TOUR_TARGET } from '../tourSteps';

const WINDOW = { width: 1440, height: 900 };
const CARD = { width: 316, height: 200 };

describe('placeTourCard', () => {
  it('sits on the preferred side when there is room', () => {
    const sidebar = { top: 100, left: 0, width: 380, height: 700 };
    expect(placeTourCard(sidebar, 'right', CARD, WINDOW)).toEqual({ left: 394, top: 100 });
  });

  it('flips to the opposite side rather than covering its target', () => {
    const nearRightEdge = { top: 100, left: 1200, width: 200, height: 40 };
    expect(placeTourCard(nearRightEdge, 'right', CARD, WINDOW).left).toBe(1200 - 14 - 316);
  });

  it('takes the other axis when neither side fits', () => {
    const wide = { top: 60, left: 100, width: 1240, height: 300 };
    const placed = placeTourCard(wide, 'right', CARD, WINDOW);
    expect(placed.top).toBe(60 + 300 + 14);
  });

  it('keeps the card inside the window', () => {
    const topRight = { top: 8, left: 1380, width: 50, height: 30 };
    const placed = placeTourCard(topRight, 'bottom', CARD, WINDOW);
    expect(placed.left + CARD.width).toBeLessThanOrEqual(WINDOW.width - 14);
    expect(placed.top).toBe(8 + 30 + 14);
  });
});

describe('the tour steps', () => {
  it('each say something, and point only at known targets', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
      if (step.target) expect(Object.keys(TOUR_TARGET)).toContain(step.target);
    }
  });

  it('write no em dashes', () => {
    for (const step of TOUR_STEPS) expect(`${step.title} ${step.body}`).not.toContain('—');
  });
});
