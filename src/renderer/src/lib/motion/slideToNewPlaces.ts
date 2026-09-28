import { MOTION_EASE, MOTION_MS, prefersReducedMotion } from './motionTiming';

/**
 * Where each element marked with `attribute` inside `container` is now, by the attribute's
 * value. Take it just before a change that moves them, then hand it to
 * `slideFromRecordedPlaces` once the change has rendered.
 */
export function recordPlaces(container: Element, attribute: string): Map<string, DOMRect> {
  const places = new Map<string, DOMRect>();
  for (const element of container.querySelectorAll(`[${attribute}]`)) {
    places.set(element.getAttribute(attribute)!, element.getBoundingClientRect());
  }
  return places;
}

/**
 * Slides each marked element from its recorded place to where it is now, so a layout that
 * switches reads as things moving over rather than jumping. Elements are matched by the
 * attribute's value, not identity: a switch may render them anew.
 */
export function slideFromRecordedPlaces(
  container: Element,
  attribute: string,
  places: Map<string, DOMRect>
): void {
  if (prefersReducedMotion()) return;
  for (const element of container.querySelectorAll<HTMLElement>(`[${attribute}]`)) {
    const was = places.get(element.getAttribute(attribute)!);
    if (!was) continue;
    const now = element.getBoundingClientRect();
    const dx = was.left - now.left;
    const dy = was.top - now.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
    element.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
      { duration: MOTION_MS.slide, easing: MOTION_EASE }
    );
  }
}
