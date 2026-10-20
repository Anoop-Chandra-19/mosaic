import type { StepOption } from '../devTool';

/** How many choices a step lists before asking for more letters. */
export const MAX_LISTED_OPTIONS = 60;

/** "12", "v12", "v12.1": typed to find a version by its number. */
const VERSION_NUMBER = /^v?(\d+(?:\.\d*)?)$/i;

/**
 * A step's choices for what is typed. A number finds versions whose label starts with it,
 * shortest first: "9" lists v9, then v90 to v99. Words must each be in the label, the detail
 * or the hint.
 */
export function filterStepOptions(options: readonly StepOption[], query: string): StepOption[] {
  const typed = query.trim().toLowerCase();
  if (!typed) return [...options];
  const number = VERSION_NUMBER.exec(typed)?.[1];
  if (number && options.some((option) => /^v\d/.test(option.label))) {
    return options
      .filter((option) => option.label.startsWith(`v${number}`))
      .sort((a, b) => a.label.length - b.label.length);
  }
  const words = typed.split(/\s+/);
  return options.filter((option) => {
    const text = `${option.label} ${option.detail ?? ''} ${option.hint ?? ''}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
