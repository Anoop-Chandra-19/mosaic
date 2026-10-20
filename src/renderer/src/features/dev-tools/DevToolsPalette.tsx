import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, History } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import {
  AppCommand,
  AppCommandEmpty,
  AppCommandGroup,
  AppCommandInput,
  AppCommandItem,
  AppCommandList,
} from '@/components/AppCommand';
import { AppDialogContent, AppDialogTitle } from '@/components/AppDialog';
import { Chip } from '@/components/Chip';
import { Text } from '@/components/Text';
import { textVariantClasses } from '@/components/textVariants';
import { ShortcutKeys } from '@/features/shortcuts/ShortcutKeys';
import { cn } from '@/lib/utils';
import { showToast } from '@/stores/toastStore';
import type { DevToolRun } from '@shared/types/devTools';
import { DEV_TOOL_GROUPS, DEV_TOOLS, findDevTool, runDevTool, type DevTool } from './devTools';
import { describeRunArgs } from './recentDevRuns';
import { searchDevTools, type MatchRange } from './searchDevTools';

/** A row of the list: what it runs, and how it reads. */
interface PaletteRow {
  value: string;
  run: DevToolRun;
  tool: DevTool;
  ranges?: MatchRange[];
  /** Recent's rows, each with the choices it ran with. */
  isRecent?: boolean;
  /** Shown at the row's end: a result's group. */
  hint?: string;
}

interface PaletteSection {
  heading: ReactNode;
  rows: PaletteRow[];
}

interface DevToolFailure {
  run: DevToolRun;
  message: string;
}

const toolRow = (tool: DevTool, ranges?: MatchRange[], hint?: string): PaletteRow => ({
  value: `tool-${tool.id}`,
  run: { toolId: tool.id, args: {} },
  tool,
  ranges,
  hint,
});

/** Recent and every group; or, while typing, the matches under Results. */
function buildSections(query: string, recent: readonly DevToolRun[]): PaletteSection[] {
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
      { heading, rows: matches.map(({ tool, ranges }) => toolRow(tool, ranges, tool.group)) },
    ];
  }
  const recentRows = recent.flatMap((run, index) => {
    const tool = findDevTool(run.toolId);
    return tool ? [{ value: `recent-${index}`, run, tool, isRecent: true }] : [];
  });
  return [
    ...(recentRows.length ? [{ heading: 'Recent', rows: recentRows }] : []),
    ...DEV_TOOL_GROUPS.map((group) => ({
      heading: group,
      rows: DEV_TOOLS.filter((tool) => tool.group === group).map((tool) => toolRow(tool)),
    })),
  ];
}

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

function PaletteRowContent({ row, isFirst }: { row: PaletteRow; isFirst: boolean }) {
  const args = describeRunArgs(row.run);
  const description = row.isRecent && isFirst ? 'Runs again with the same choices.' : null;
  return (
    <>
      {row.isRecent && <History className="text-ink-faint" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-baseline gap-2">
          <MarkedLabel label={row.tool.label} ranges={row.ranges} />
          {args && <Text variant="secondary">{args}</Text>}
        </span>
        <Text variant="secondary" className="mt-px hidden group-data-[selected=true]:block">
          {description ?? row.tool.description}
        </Text>
      </span>
      {row.hint && <Text variant="secondary">{row.hint}</Text>}
      {row.isRecent && isFirst && <ShortcutKeys combos={['Enter']} />}
    </>
  );
}

function FailureView({ failure, onRunAgain }: { failure: DevToolFailure; onRunAgain: () => void }) {
  const [isCopied, setIsCopied] = useState(false);
  const label = findDevTool(failure.run.toolId)?.label ?? failure.run.toolId;
  const copy = () => {
    void navigator.clipboard.writeText(failure.message).then(() => setIsCopied(true));
  };
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1 pb-1.5">
      <div
        role="alert"
        className="mx-2 mt-1 rounded-sm border border-del-line bg-del-soft px-2.75 py-2.25"
      >
        <Text as="p" variant="strong" className="text-del">
          “{label}” didn’t finish
        </Text>
        <code
          className={cn(
            textVariantClasses('meta'),
            'mt-1 mb-1.5 block whitespace-pre-wrap wrap-break-word text-foreground'
          )}
        >
          {failure.message}
        </code>
        <div className="mt-2.25 flex flex-wrap gap-1.5">
          <AppButton variant="outline" size="xs" onClick={onRunAgain}>
            Run again
            <ShortcutKeys combos={['Enter']} />
          </AppButton>
          <AppButton variant="ghost" size="xs" onClick={copy}>
            {isCopied && <Check />}
            {isCopied ? 'Copied' : 'Copy the error'}
          </AppButton>
        </div>
      </div>
    </div>
  );
}

/** The keys the footer lists: each one's keycaps, and what they do. */
interface FooterKey {
  keys: string[];
  label: string;
}

const LIST_KEYS: FooterKey[] = [
  { keys: ['Up', 'Down'], label: 'move' },
  { keys: ['Enter'], label: 'run' },
  { keys: ['Esc'], label: 'close' },
];
const FAILURE_KEYS: FooterKey[] = [
  { keys: ['Enter'], label: 'run again' },
  { keys: ['Esc'], label: 'back' },
];

function PaletteFooter({ keys }: { keys: FooterKey[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-line bg-chrome px-3 py-1.75 text-support text-ink-faint">
      {keys.map(({ keys: combos, label }) => (
        <span key={label} className="inline-flex items-center gap-1">
          {combos.map((combo) => (
            <ShortcutKeys key={combo} combos={[combo]} />
          ))}
          {label}
        </span>
      ))}
    </div>
  );
}

interface DevToolsPaletteProps {
  recent: readonly DevToolRun[];
  onRun: (run: DevToolRun) => void;
  onClose: () => void;
}

/**
 * The palette's contents, inside the dialog. Mounted afresh each time it opens, so it starts
 * empty, on Recent's first row: Ctrl+Shift+D then Enter runs the last tool again.
 */
export function DevToolsPalette({ recent, onRun, onClose }: DevToolsPaletteProps) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState('');
  const [failure, setFailure] = useState<DevToolFailure | null>(null);
  const sections = buildSections(query, recent);
  const rows = sections.flatMap((section) => section.rows);
  // Typing, or Recent arriving, moves the choice to the first row, as long as it is gone.
  const value = rows.some((row) => row.value === chosen) ? chosen : (rows[0]?.value ?? '');

  const run = async (devRun: DevToolRun) => {
    setFailure(null);
    onRun(devRun);
    try {
      const message = await runDevTool(devRun);
      onClose();
      showToast(message, 'success', undefined, 'DEV');
    } catch (error) {
      setFailure({ run: devRun, message: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (failure && event.key === 'Enter') {
      event.preventDefault();
      void run(failure.run);
    }
  };

  return (
    <AppDialogContent
      placement="top"
      showCloseButton={false}
      aria-describedby={undefined}
      // A failure shown is a step in: Esc steps back to the list before it closes.
      onEscapeKeyDown={(event) => {
        if (!failure) return;
        event.preventDefault();
        setFailure(null);
      }}
      className="flex max-h-[calc(100%-4.25rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-150"
    >
      <AppDialogTitle className="sr-only">Developer tools</AppDialogTitle>
      <AppCommand value={value} onValueChange={setChosen} className="min-h-0 flex-1">
        <AppCommandInput
          value={query}
          onValueChange={(next) => {
            setQuery(next);
            setFailure(null);
          }}
          onKeyDown={handleFieldKeyDown}
          placeholder="Search tools"
          aria-label="Search developer tools"
          trailing={
            <Chip size="sm" tone="info" title="Development build only">
              DEV
            </Chip>
          }
        />
        {failure ? (
          <FailureView failure={failure} onRunAgain={() => void run(failure.run)} />
        ) : (
          <AppCommandList>
            <AppCommandEmpty>No tool matches.</AppCommandEmpty>
            {sections.map((section, sectionIndex) => (
              <AppCommandGroup key={sectionIndex} heading={section.heading}>
                {section.rows.map((row, rowIndex) => (
                  <AppCommandItem
                    key={row.value}
                    value={row.value}
                    onSelect={() => void run(row.run)}
                  >
                    <PaletteRowContent row={row} isFirst={rowIndex === 0} />
                  </AppCommandItem>
                ))}
              </AppCommandGroup>
            ))}
          </AppCommandList>
        )}
      </AppCommand>
      <PaletteFooter keys={failure ? FAILURE_KEYS : LIST_KEYS} />
    </AppDialogContent>
  );
}
