const STYLE_ID = 'dev-outline-measured-boxes';

/**
 * The boxes pagination measures, as `ResumePreview.tsx` finds them. Outlines take no room,
 * so drawing them changes no measurement. Blocks are solid, the lines inside them dashed.
 */
const OUTLINES = `
[data-preview-header], [data-preview-section-title-id], [data-preview-entry-key] {
  outline: 1px solid color-mix(in oklab, var(--info) 70%, transparent);
  outline-offset: -1px;
}
[data-preview-entry-heading-key], [data-preview-bullet-id] {
  outline: 1px dashed color-mix(in oklab, var(--warn) 80%, transparent);
  outline-offset: -1px;
}`;

/** A stylesheet of the switch's own, so no outline rule ships in a release build. */
export function showMeasuredBoxOutlines(isOn: boolean): void {
  const existing = document.getElementById(STYLE_ID);
  if (!isOn) {
    existing?.remove();
    return;
  }
  if (existing) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = OUTLINES;
  document.head.append(style);
}
