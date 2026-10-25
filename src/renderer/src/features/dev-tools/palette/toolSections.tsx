import { History } from 'lucide-react';
import { Text, textVariantClasses } from '@/components/ui-kit';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { cn } from '@/lib/utils';
import type { DevToolRun } from '@shared/types/devTools';
import { DEV_TOOL_GROUPS, type DevTool } from '../tools/devTool';
import { DEV_TOOLS, findDevTool } from '../tools/runDevTool';
import type { PaletteSection } from './paletteSection';
import { describeRunArgs } from './recentRuns';
import { searchDevTools, type MatchRange } from './searchDevTools';
import { ToolRow } from './ToolRow';

/** How a Recent run's choices read: each through its step's own words. */
function describeRecentArgs(tool: DevTool, run: DevToolRun): string {
  if (!tool.steps) return describeRunArgs(run);
  return tool.steps
    .filter((step) => step.key in run.args)
    .map((step) => step.describe?.(run.args[step.key]) ?? String(run.args[step.key]))
    .join(' · ');
}

/**
 * Recent and every group; or, while typing, the matches under Results. Choosing a tool runs
 * it, or starts its steps.
 */
export function buildToolSections(
  query: string,
  recent: readonly DevToolRun[],
  onChoose: (tool: DevTool) => void,
  onRun: (run: DevToolRun) => void
): PaletteSection[] {
  const toolRow = (tool: DevTool, ranges?: MatchRange[], hint?: string) => ({
    value: `tool-${tool.id}`,
    onSelect: () => onChoose(tool),
    content: (
      <ToolRow tool={tool} ranges={ranges} end={hint && <Text variant="secondary">{hint}</Text>} />
    ),
  });
  if (query.trim()) {
    const matches = searchDevTools(DEV_TOOLS, query);
    const heading = (
      <>
        Results
        <span className={cn(textVariantClasses('meta'), 'ml-auto normal-case')}>
          {matches.length}
        </span>
      </>
    );
    return [
      {
        heading,
        rows: matches.map(({ tool, ranges }) => toolRow(tool, ranges, tool.group)),
        note: matches.length
          ? undefined
          : 'No tool matches. Pasting an address? It reads like history / Base resume / v12.',
      },
    ];
  }
  const recentRows = recent.flatMap((run, index) => {
    const tool = findDevTool(run.toolId);
    if (!tool) return [];
    const isLast = index === 0;
    return [
      {
        value: `recent-${index}`,
        onSelect: () => onRun(run),
        content: (
          <ToolRow
            tool={{ ...tool, steps: undefined, keys: undefined }}
            args={describeRecentArgs(tool, run)}
            description={isLast ? 'Runs again with the same choices.' : tool.description}
            icon={<History className="text-ink-faint" />}
            end={isLast && <ShortcutKeys combos={['Enter']} />}
          />
        ),
      },
    ];
  });
  return [
    ...(recentRows.length ? [{ heading: 'Recent', rows: recentRows }] : []),
    ...DEV_TOOL_GROUPS.map((group) => ({
      heading: group,
      rows: DEV_TOOLS.filter((tool) => tool.group === group).map((tool) => toolRow(tool)),
    })),
  ];
}
