import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { AppSwitch, Chip, Text } from '@/components/ui-kit';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { cn } from '@/lib/utils';
import type { DevSwitch } from '@shared/types/devTools';
import type { DevTool } from '../tools/devTool';
import { useDevToolsStore } from '../devToolsStore';
import type { MatchRange } from './searchDevTools';

/** The label with the typed words marked in ink, not amber: amber is the assistant's. */
function MarkedLabel({ label, ranges = [] }: { label: string; ranges?: MatchRange[] }) {
  const pieces: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start < at) continue;
    pieces.push(label.slice(at, start));
    pieces.push(
      <em
        key={start}
        className="font-strong text-foreground not-italic underline decoration-line-heavy underline-offset-3"
      >
        {label.slice(start, end)}
      </em>
    );
    at = end;
  }
  pieces.push(label.slice(at));
  return <span className="truncate">{pieces}</span>;
}

/** A switch's state, which choosing the row flips: the switch itself only shows it. */
function SwitchState({ name }: { name: DevSwitch }) {
  const isOn = useDevToolsStore((s) => s.switches[name]);
  return (
    <>
      <Text
        variant="secondary"
        className={cn('min-w-5 text-right', isOn ? 'font-strong text-warn' : 'text-ink-faint')}
      >
        {isOn ? 'On' : 'Off'}
      </Text>
      <AppSwitch checked={isOn} tabIndex={-1} aria-hidden className="pointer-events-none" />
    </>
  );
}

export interface ToolRowProps {
  tool: DevTool;
  ranges?: MatchRange[];
  /** Recent's: the choices it ran with, beside its name. */
  args?: string;
  description?: string;
  icon?: ReactNode;
  end?: ReactNode;
}

export function ToolRow({ tool, ranges, args, description, icon, end }: ToolRowProps) {
  return (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-2">
          <MarkedLabel label={tool.steps ? `${tool.label}…` : tool.label} ranges={ranges} />
          {args && (
            <Text variant="secondary" className="truncate">
              {args}
            </Text>
          )}
        </span>
        <Text variant="secondary" className="mt-px hidden group-data-[selected=true]:block">
          {description ?? tool.description}
        </Text>
      </span>
      {end}
      {tool.replacesData && (
        <Chip size="sm" tone="del" className="uppercase">
          Replaces data
        </Chip>
      )}
      {tool.switch && <SwitchState name={tool.switch} />}
      {tool.steps && <ChevronRight className="text-ink-faint" />}
      {tool.keys && <ShortcutKeys combos={[tool.keys]} />}
    </>
  );
}
