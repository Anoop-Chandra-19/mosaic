import type { StepOption } from '../tools/devTool';
import { filterStepOptions, MAX_LISTED_OPTIONS } from './filterStepOptions';
import type { PaletteSection } from './paletteSection';
import { StepOptionRow } from './StepOptionRow';

/** A step's choices for what is typed, the first sixty at most. */
export function buildStepSection(
  options: StepOption[] | null,
  query: string,
  onChoose: (option: StepOption) => void
): PaletteSection {
  if (!options) return { rows: [], note: 'Reading…' };
  const matches = filterStepOptions(options, query);
  const more = matches.length - MAX_LISTED_OPTIONS;
  let note: string | undefined;
  if (matches.length === 0) note = 'Nothing matches.';
  if (more > 0) note = `${more} more. Type a number to narrow.`;
  return {
    rows: matches.slice(0, MAX_LISTED_OPTIONS).map((option) => ({
      value: `option-${option.value}`,
      onSelect: () => onChoose(option),
      content: <StepOptionRow option={option} />,
    })),
    note,
  };
}
