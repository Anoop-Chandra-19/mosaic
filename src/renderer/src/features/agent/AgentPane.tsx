import { useEffect, useRef } from 'react';
import { ChevronLeft, Sparkles, SquarePen, X } from 'lucide-react';
import { AppButton, AppTooltip, Text } from '@/components/ui-kit';
import { coverFromStart } from '@/lib/motion/presenceMotions';
import { usePresenceMotion } from '@/lib/motion/usePresenceMotion';
import { formatPaneWidth, startPaneResize } from '@/lib/paneResize';
import { shortModelName } from '@/lib/shortModelName';
import { useShortcutLabel } from '@/stores/shortcutBindings';
import { useIsSideHandover } from '@/features/view-transitions/sideHandover';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { useIsWorkspaceReplaced } from '@/features/view-transitions/useShownSurface';
import { cn } from '@/lib/utils';
import { setPaneTab, useAgentPaneStore } from '@/stores/agentPaneStore';
import { openPaneConversation, useConversationStore } from '@/stores/conversationStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { explainFailure, showToast } from '@/stores/toastStore';
import { AGENT_PANE_WIDTH, useUiStore } from '@/stores/uiStore';
import { useChosenModel } from '@/stores/useChosenModel';
import { AgentPromptBox } from './AgentPromptBox';
import { ConversationList } from './conversations/ConversationList';
import { RunningElsewhere } from './conversations/RunningElsewhere';
import { PaneTabs } from './PaneTabs';
import { useConversationSwitch } from './useConversationSwitch';
import { stopAgentRun, useRunningHere, useRunningRun } from './useRunningRun';

function Spark() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-amber-line bg-amber-soft text-amber">
      <Sparkles className="size-3" />
    </span>
  );
}

/**
 * Shows the assistant beside the preview when AI is enabled. It opens the last-used
 * conversation and shows its messages (`transcript/`) or detailed run log (`trace/`).
 * The prompt box shows send failures and stopped runs through `notices/`. The footer
 * shows the provider and model for the next run. Sessions opens the conversation list
 * (`conversations/`) over the content below the header. In narrow windows, the pane
 * covers the preview instead of sitting beside it.
 *
 * The app shell tracks runs through `followAgentRuns` and answers tool calls through
 * `tools/`, even when this pane is closed.
 *
 * Imports follow this order, with no imports back to an earlier layer:
 * this pane → `conversations/` and `trace/` → `transcript/` → `notices/` and `reply/`
 * → `run-view/`. The pane also uses `tools/`.
 */
export function AgentPane() {
  const widthPx = useUiStore((s) => s.agentPaneWidthPx);
  const setWidthPx = useUiStore((s) => s.setAgentPaneWidthPx);
  const close = useUiStore((s) => s.toggleAgentPane);
  const { providerLabel, model } = useChosenModel();
  const running = useRunningRun();
  const runningHere = useRunningHere();
  const openSettings = useOverlayStore((s) => s.openSettings);
  const paneRef = useRef<HTMLElement>(null);
  const tab = useAgentPaneStore((s) => s.tab);
  const closeKeys = useShortcutLabel('toggleAssistant');
  const isSideHandover = useIsSideHandover();
  const isWorkspaceReplaced = useIsWorkspaceReplaced();
  const conversationId = useConversationStore((s) => s.conversationId);
  const { isListOpen, failedOpenId, switchRef, openList, goBack, startNew, open, leaveDeleted } =
    useConversationSwitch();
  const {
    shown: listShown,
    isLeaving: isListLeaving,
    ref: listRef,
  } = usePresenceMotion(isListOpen ? 'list' : null, 'list', coverFromStart);

  useEffect(() => {
    openPaneConversation().catch((error: unknown) =>
      showToast(explainFailure(error, 'Couldn’t open the conversation'), 'error')
    );
  }, []);

  return (
    <aside
      ref={paneRef}
      aria-label="Assistant"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        // Escape in the prompt box stops the run instead of leaving the Trace tab.
        const isInBox = event.target instanceof HTMLTextAreaElement;
        if (tab === 'trace' && !isInBox) {
          event.preventDefault();
          setPaneTab('conversation');
        } else if (runningHere) {
          event.preventDefault();
          stopAgentRun(runningHere.runId);
        }
      }}
      className={cn(
        'relative flex shrink-0 flex-col border-l border-line bg-pane @max-5xl/workspace:absolute @max-5xl/workspace:inset-y-0 @max-5xl/workspace:right-0 @max-5xl/workspace:z-20 @max-5xl/workspace:shadow-overlay',
        // Animate the switch between this pane and the suggestion review inspector.
        transitionClasses({
          name: 'assist',
          motion: 'handover-upper',
          isActive: isSideHandover && !isWorkspaceReplaced,
        })
      )}
      style={{ width: formatPaneWidth(widthPx, AGENT_PANE_WIDTH) }}
    >
      <AppTooltip side="left" content="Drag to resize · double-click to reset" shouldFollowPointer>
        <div
          onPointerDown={(event) =>
            startPaneResize(event, {
              pane: paneRef.current,
              anchor: 'right',
              limits: AGENT_PANE_WIDTH,
              onDone: setWidthPx,
            })
          }
          onDoubleClick={() => setWidthPx(AGENT_PANE_WIDTH.defaultPx)}
          className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-amber active:bg-amber-hover"
        />
      </AppTooltip>

      {/* Match the preview bar's height. The tabs below draw the bottom border. */}
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 px-4">
        {isListOpen ? (
          <div className="-ml-1.5 flex min-w-0 items-center gap-1">
            <AppTooltip content="Back to the conversation  Esc">
              <AppButton
                variant="ghost"
                size="xs"
                shape="square"
                onClick={goBack}
                aria-label="Back to the conversation"
              >
                <ChevronLeft className="size-3.5" />
              </AppButton>
            </AppTooltip>
            <Text as="h2" variant="secondary" className="font-strong text-foreground">
              Conversations
            </Text>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <Spark />
            <Text as="h2" variant="secondary" className="font-strong text-foreground">
              Assistant
            </Text>
          </div>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {isListOpen ? (
            <AppButton variant="outline" size="xs" onClick={startNew} aria-label="New conversation">
              <SquarePen />
              New
            </AppButton>
          ) : (
            <AppTooltip content="New conversation">
              <AppButton
                variant="ghost"
                size="xs"
                shape="square"
                onClick={startNew}
                aria-label="New conversation"
              >
                <SquarePen className="size-3.5" />
              </AppButton>
            </AppTooltip>
          )}
          <AppButton
            variant="ghost"
            size="xs"
            shape="square"
            onClick={close}
            aria-label="Close assistant"
            title={`Close  ${closeKeys}`.trim()}
          >
            <X className="size-3.5" />
          </AppButton>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Keep this mounted under the list to preserve the tab, scroll position, and draft. */}
        <div inert={isListOpen} className="flex min-h-0 flex-1 flex-col">
          <RunningElsewhere running={running} onGoTo={open} />
          <PaneTabs sessionsRef={switchRef} onOpenSessions={openList} />
          <AgentPromptBox />

          <footer className="border-t border-line px-4 py-2.5">
            <Text as="p" variant="secondary" className="text-ink-faint">
              {providerLabel} · <Text variant="meta">{shortModelName(model)}</Text>
              {' · '}
              <AppButton
                variant="link"
                onClick={() => openSettings('ai')}
                className="h-auto p-0 align-baseline text-support text-amber underline-offset-2"
              >
                change
              </AppButton>
            </Text>
          </footer>
        </div>
        {listShown && (
          <div ref={listRef} inert={isListLeaving} className="absolute inset-0 z-10">
            <ConversationList
              currentId={conversationId}
              running={running}
              failedOpenId={failedOpenId}
              onOpen={open}
              onOpenNew={startNew}
              onBack={goBack}
              onStop={stopAgentRun}
              onDeleted={leaveDeleted}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
