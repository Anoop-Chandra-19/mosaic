import type { DevTool } from '../tools/devTool';
import type { PaletteSection } from './paletteSection';
import { ToolRow } from './ToolRow';

/** A tool that asks for text first, as one row that runs it with what is typed. */
export function buildPromptSection(
  tool: DevTool,
  text: string,
  onRun: (text: string) => void
): PaletteSection {
  const isEmpty = text.trim() === '';
  return {
    rows: [
      {
        value: 'prompt',
        onSelect: () => onRun(text),
        isDisabled: isEmpty,
        content: <ToolRow tool={tool} args={isEmpty ? undefined : `“${text.trim()}”`} />,
      },
    ],
    note: isEmpty ? 'Type it, then Enter.' : undefined,
  };
}
