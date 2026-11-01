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
 * The assistant, on the right of the preview, drawn only while AI is on: the open
 * conversation (`transcript/`) or its full record (`trace/`), the prompt box with the one
 * notice over it for a message that didn't go or a run that stopped (`notices/`), and which
 * provider and model the next run uses. It opens on the conversation used last; Sessions, at
 * the end of the tabs, opens the list of them all (`conversations/`), over everything below the
 * header. The runs themselves are followed and their tools answered from the shell (`followAgentRuns`,
 * `tools/`). On a window too narrow for editor, preview, and pane, it lies over the preview.
 *
 * Imports only go down this list, and nothing imports this folder's own files from below:
 * the pane here; `conversations/`, `trace/`; `transcript/`; `notices/`, `reply/`; `run-view/`.
 * Beside them, the pane calls `tools/`.
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
        // In the box, Esc still means Stop.
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
        // Hands its column to the suggestion review's inspector, and takes it back.
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

      {/* The preview bar's height. The rule under it belongs to the tabs, which hang from it. */}
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
        {/* Stays as it was under the list, so going back finds the same tab, place and words. */}
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
