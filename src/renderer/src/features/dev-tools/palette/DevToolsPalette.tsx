import { useState, type KeyboardEvent } from 'react';
import {
  AppCommand,
  AppCommandGroup,
  AppCommandInput,
  AppCommandItem,
  AppCommandList,
  AppDialogContent,
  AppDialogTitle,
  Chip,
  Text,
  textVariantClasses,
} from '@/components/ui-kit';
import { formatViewAddress } from '@/features/view-address/formatViewAddress';
import { describeCurrentView } from '@/features/view-address/viewAddress';
import type { ViewPlace } from '@/features/view-address/viewPlace';
import { cn } from '@/lib/utils';
import { showToast } from '@/stores/toastStore';
import type { DevToolArgs, DevToolRun } from '@shared/types/devTools';
import type { DevTool, StepOption } from '../devTool';
import { findDevTool, runDevTool } from '../devTools';
import { describeGoToAddress } from '../tools/goToTools';
import { buildAddressSection } from './addressSection';
import { DevToolFailure } from './DevToolFailure';
import { PaletteFooter, type FooterKey } from './PaletteFooter';
import type { PaletteSection } from './paletteSection';
import { ReplaceDataConfirm } from './ReplaceDataConfirm';
import { buildStepSection } from './stepSection';
import { buildToolSections } from './toolSections';
import { useAddressCheck } from './useAddressCheck';
import { useStepOptions } from './useStepOptions';

/*
 * The palette's contents, inside the dialog: a field over a list. The list is the tools
 * (`toolSections.tsx`), a step's choices once a tool with steps is chosen (`stepSection.tsx`),
 * or a typed address (`addressSection.tsx`); a run that fails shows in its place
 * (`DevToolFailure.tsx`), as does a check's report (a tool's `report`), and a tool that
 * replaces data asks first (`ReplaceDataConfirm.tsx`). A switch flips with the palette open.
 */

interface Stepping {
  tool: DevTool;
  args: DevToolArgs;
}

interface Failure {
  run: DevToolRun;
  message: string;
}

const LIST_KEYS: FooterKey[] = [
  { keys: ['Up', 'Down'], label: 'move' },
  { keys: ['Enter'], label: 'run' },
  { keys: ['Esc'], label: 'close' },
];
const STEP_KEYS: FooterKey[] = [
  { keys: ['Enter'], label: 'choose' },
  { keys: ['Mod+Enter'], label: 'go, the rest as default' },
  { keys: ['Backspace'], label: 'back a step' },
];
const RUN_AGAIN_KEYS: FooterKey[] = [
  { keys: ['Enter'], label: 'run again' },
  { keys: ['Esc'], label: 'back' },
];
const CONFIRM_KEYS: FooterKey[] = [
  { keys: ['Mod+Enter'], label: 'replace' },
  { keys: ['Esc'], label: 'cancel' },
];

const NO_ARGS: DevToolArgs = {};

const isModKey = (event: KeyboardEvent) =>
  window.mosaic.platform === 'darwin' ? event.metaKey : event.ctrlKey;

/** The step a tool is on: the first whose choice isn't made. */
function findCurrentStep(stepping: Stepping | null) {
  return stepping?.tool.steps?.find((step) => !(step.key in stepping.args)) ?? null;
}

/** Runs on with the palette closed, saying how it went in a toast. */
async function runReplacingTool(devRun: DevToolRun, label: string): Promise<void> {
  try {
    const message = await runDevTool(devRun);
    if (message) showToast(message, 'success', undefined, 'DEV');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showToast(`“${label}” didn’t finish: ${message}`, 'error');
  }
}

/** The tool and the choices made so far, as chips; then the next one's, unless all are made. */
function SteppingChips({ stepping, isComplete }: { stepping: Stepping; isComplete?: boolean }) {
  const made = (stepping.tool.steps ?? []).filter((step) => step.key in stepping.args);
  return (
    <>
      <Chip className="max-w-55 truncate text-foreground">{stepping.tool.label}</Chip>
      {made.map((step) => {
        const value = stepping.args[step.key];
        return (
          <span key={step.key} className="contents">
            <Text variant="secondary" className="text-ink-faint">
              ›
            </Text>
            <Chip className="max-w-55 truncate">{step.describe?.(value) ?? String(value)}</Chip>
          </span>
        );
      })}
      {!isComplete && (
        <Text variant="secondary" className="text-ink-faint">
          ›
        </Text>
      )}
    </>
  );
}

interface DevToolsPaletteProps {
  recent: readonly DevToolRun[];
  onRun: (run: DevToolRun) => void;
  onClose: () => void;
}

/**
 * Mounted afresh each time it opens, so it starts empty, on Recent's first row: Ctrl+Shift+D
 * then Enter runs the last tool again.
 */
export function DevToolsPalette({ recent, onRun, onClose }: DevToolsPaletteProps) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState('');
  const [failure, setFailure] = useState<Failure | null>(null);
  /** A run that replaces data, waiting for Ctrl+Enter. */
  const [confirming, setConfirming] = useState<Stepping | null>(null);
  /** A tool whose report shows in place of the list; each run of it counts up. */
  const [reporting, setReporting] = useState<DevTool | null>(null);
  const [reportRuns, setReportRuns] = useState(0);
  const [stepping, setStepping] = useState<Stepping | null>(null);
  /** A tool that asks for text first: Go to an address. */
  const [asking, setAsking] = useState<DevTool | null>(null);
  const [here] = useState(describeCurrentView);
  const [isCopied, setIsCopied] = useState(false);

  const step = findCurrentStep(stepping);
  const options = useStepOptions(step, stepping?.args ?? NO_ARGS);
  const addressCheck = useAddressCheck(stepping ? '' : query);

  const changeQuery = (next: string) => {
    setQuery(next);
    setFailure(null);
  };

  const run = async (devRun: DevToolRun) => {
    setFailure(null);
    setStepping(null);
    const tool = findDevTool(devRun.toolId);
    if (tool?.replacesData) {
      setConfirming({ tool, args: devRun.args });
      return;
    }
    onRun(devRun);
    if (tool?.report) {
      setReporting(tool);
      return;
    }
    try {
      const message = await runDevTool(devRun);
      onClose();
      if (message) showToast(message, 'success', undefined, 'DEV');
    } catch (error) {
      setFailure({ run: devRun, message: error instanceof Error ? error.message : String(error) });
    }
  };

  const flipSwitch = async (tool: DevTool) => {
    const devRun = { toolId: tool.id, args: {} };
    try {
      await runDevTool(devRun);
    } catch (error) {
      setFailure({ run: devRun, message: error instanceof Error ? error.message : String(error) });
    }
  };

  const chooseTool = (tool: DevTool) => {
    // A switch flips where it is, the list staying as it was to flip another.
    if (tool.switch) {
      void flipSwitch(tool);
      return;
    }
    changeQuery('');
    if (tool.steps) setStepping({ tool, args: {} });
    else if (tool.prompt) setAsking(tool);
    else void run({ toolId: tool.id, args: {} });
  };

  const chooseOption = (option: StepOption) => {
    if (!stepping || !step) return;
    const args = { ...stepping.args, [step.key]: option.value };
    changeQuery('');
    if (findCurrentStep({ ...stepping, args })) setStepping({ ...stepping, args });
    else void run({ toolId: stepping.tool.id, args });
  };

  /** Ctrl+Enter: each step left takes its default; one without a default waits for a choice. */
  const takeDefaults = async () => {
    if (!stepping?.tool.steps) return;
    const args = { ...stepping.args };
    for (const toolStep of stepping.tool.steps) {
      if (toolStep.key in args) continue;
      const fallback = (await toolStep.listOptions(args)).find((option) => option.isDefault);
      if (!fallback) {
        changeQuery('');
        setStepping({ ...stepping, args });
        return;
      }
      args[toolStep.key] = fallback.value;
    }
    void run({ toolId: stepping.tool.id, args });
  };

  const stepBack = () => {
    if (!stepping) return setAsking(null);
    const made = (stepping.tool.steps ?? []).filter((toolStep) => toolStep.key in stepping.args);
    const last = made.at(-1);
    if (!last) return setStepping(null);
    const args = { ...stepping.args };
    delete args[last.key];
    setStepping({ ...stepping, args });
  };

  const replace = () => {
    if (!confirming) return;
    const devRun = { toolId: confirming.tool.id, args: confirming.args };
    onRun(devRun);
    onClose();
    void runReplacingTool(devRun, confirming.tool.label);
  };

  const goToTyped = (place: ViewPlace, templateId?: string) => {
    const args: DevToolArgs = { text: formatViewAddress(place) };
    if (templateId) args.templateId = templateId;
    void run({ toolId: 'goToAddress', args });
  };

  const copyHere = async () => {
    await navigator.clipboard.writeText(here);
    setIsCopied(true);
    onClose();
    showToast(`Copied the address: ${here}`, 'success', undefined, 'DEV');
  };

  const handleFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && confirming) {
      // Only Ctrl+Enter replaces: Enter alone, from habit, does nothing.
      event.preventDefault();
      if (isModKey(event)) replace();
    } else if (event.key === 'Enter' && reporting) {
      event.preventDefault();
      setReportRuns((runs) => runs + 1);
    } else if (event.key === 'Enter' && failure) {
      event.preventDefault();
      void run(failure.run);
    } else if (event.key === 'Enter' && isModKey(event) && stepping) {
      event.preventDefault();
      void takeDefaults();
    } else if (event.key === 'Backspace' && query === '' && (stepping || asking)) {
      event.preventDefault();
      stepBack();
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isModKey(event) && event.shiftKey && event.code === 'KeyC') {
      event.preventDefault();
      void copyHere();
    }
  };

  let sections: PaletteSection[];
  if (stepping) sections = [buildStepSection(options, query, chooseOption)];
  else if (addressCheck) sections = [buildAddressSection(query, addressCheck, goToTyped)];
  else sections = buildToolSections(query, recent, chooseTool, (devRun) => void run(devRun));
  const rows = sections.flatMap((section) => section.rows).filter((row) => !row.isDisabled);
  // Typing, a new step, or Recent arriving moves the choice to the first row, once it is gone.
  const value = rows.some((row) => row.value === chosen) ? chosen : (rows[0]?.value ?? '');

  const goesTo = stepping ? describeGoToAddress(stepping.tool.id, stepping.args) : null;
  const placeholder = step?.placeholder ?? asking?.prompt ?? 'Search tools, or paste an address';
  let footerKeys = LIST_KEYS;
  if (confirming) footerKeys = CONFIRM_KEYS;
  else if (failure || reporting) footerKeys = RUN_AGAIN_KEYS;
  else if (stepping) footerKeys = STEP_KEYS;

  let leading = null;
  if (confirming) leading = <SteppingChips stepping={confirming} isComplete />;
  else if (reporting)
    leading = <SteppingChips stepping={{ tool: reporting, args: {} }} isComplete />;
  else if (stepping) leading = <SteppingChips stepping={stepping} />;

  let body;
  if (confirming?.tool.replacesData) {
    body = (
      <ReplaceDataConfirm
        replacement={confirming.tool.replacesData(confirming.args)}
        onCancel={() => setConfirming(null)}
        onReplace={replace}
      />
    );
  } else if (reporting?.report) {
    const Report = reporting.report;
    body = <Report key={reportRuns} onRunAgain={() => setReportRuns((runs) => runs + 1)} />;
  } else if (failure) {
    body = (
      <DevToolFailure
        label={findDevTool(failure.run.toolId)?.label ?? failure.run.toolId}
        message={failure.message}
        onRunAgain={() => void run(failure.run)}
      />
    );
  } else {
    body = (
      <AppCommandList>
        {sections.map((section, sectionIndex) => (
          <AppCommandGroup key={sectionIndex} heading={section.heading}>
            {section.rows.map((row) => (
              <AppCommandItem
                key={row.value}
                value={row.value}
                disabled={row.isDisabled}
                onSelect={row.onSelect}
              >
                {row.content}
              </AppCommandItem>
            ))}
            {section.note && (
              <Text as="p" variant="secondary" className="px-2 pt-1.5 pb-1 text-ink-faint">
                {section.note}
              </Text>
            )}
          </AppCommandGroup>
        ))}
      </AppCommandList>
    );
  }

  return (
    <AppDialogContent
      placement="top"
      showCloseButton={false}
      aria-describedby={undefined}
      // Inside a step, a failure, a prompt, a confirm or a report, Esc steps back out before
      // it closes.
      onEscapeKeyDown={(event) => {
        if (!failure && !stepping && !asking && !confirming && !reporting) return;
        event.preventDefault();
        setFailure(null);
        setStepping(null);
        setAsking(null);
        setConfirming(null);
        setReporting(null);
      }}
      className="flex max-h-[calc(100%-4.25rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-150"
    >
      <AppDialogTitle className="sr-only">Developer tools</AppDialogTitle>
      <AppCommand
        value={value}
        onValueChange={setChosen}
        onKeyDown={handleKeyDown}
        className="min-h-0 flex-1"
      >
        <AppCommandInput
          value={query}
          onValueChange={changeQuery}
          onKeyDown={handleFieldKeyDown}
          placeholder={confirming || reporting ? '' : placeholder}
          readOnly={confirming !== null || reporting !== null}
          aria-label="Search developer tools"
          className={cn(addressCheck && 'font-mono text-body')}
          leading={leading}
          trailing={
            <Chip size="sm" tone="info" title="Development build only" className="ml-auto">
              DEV
            </Chip>
          }
        />
        {goesTo && (
          <div className="flex min-w-0 items-center gap-2 border-b border-line bg-pane px-3.5 py-1.25">
            <Text variant="secondary" className="shrink-0 text-ink-faint">
              Goes to
            </Text>
            <span className={cn(textVariantClasses('meta'), 'truncate text-ink-muted')}>
              {goesTo}
            </span>
          </div>
        )}
        {body}
      </AppCommand>
      <PaletteFooter
        keys={footerKeys}
        here={here}
        isCopied={isCopied}
        onCopy={() => void copyHere()}
      />
    </AppDialogContent>
  );
}
