import { useEffect, useRef } from 'react';
import { Sparkles, SquarePen, X } from 'lucide-react';
import { AppButton, AppTooltip, Text } from '@/components/ui-kit';
import { formatPaneWidth, startPaneResize } from '@/features/shell/paneResize';
import { useShortcutLabel } from '@/features/shortcuts/shortcutBindings';
import { useIsSideHandover } from '@/features/view-transitions/sideHandover';
import { transitionClasses } from '@/features/view-transitions/transitionClasses';
import { useIsWorkspaceReplaced } from '@/features/view-transitions/useShownSurface';
import { cn } from '@/lib/utils';
import { openPaneConversation, startNewConversation } from '@/stores/conversationStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { explainFailure, showToast } from '@/stores/toastStore';
import { AGENT_PANE_WIDTH, useUiStore } from '@/stores/uiStore';
import { AgentPromptBox } from './prompt-box/AgentPromptBox';
import { shortModelName } from './shortModelName';
import { AgentTranscript } from './transcript/AgentTranscript';
import { useChosenModel } from './useChosenModel';
import { stopAgentRun, useRunningRun } from './useRunningRun';

function Spark() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-amber-line bg-amber-soft text-amber">
      <Sparkles className="size-3" />
    </span>
  );
}

/**
 * The assistant, on the right of the preview, drawn only while AI is on: the open
 * conversation (`transcript/`), the prompt box (`prompt-box/`) with the one notice over it
 * for a message that didn't go or a run that stopped (`notices/`),
 * and which provider and model the next run uses. It opens on the conversation used last.
 * The runs themselves are followed by `followAgentRuns` and their tools answered by
 * `agentRunTools` (`tools/`), from the shell. On a window too narrow for editor, preview,
 * and pane, it lies over the preview.
 */
export function AgentPane() {
  const widthPx = useUiStore((s) => s.agentPaneWidthPx);
  const setWidthPx = useUiStore((s) => s.setAgentPaneWidthPx);
  const close = useUiStore((s) => s.toggleAgentPane);
  const { providerLabel, model } = useChosenModel();
  const running = useRunningRun();
  const openSettings = useOverlayStore((s) => s.openSettings);
  const paneRef = useRef<HTMLElement>(null);
  const closeKeys = useShortcutLabel('toggleAssistant');
  const isSideHandover = useIsSideHandover();
  const isWorkspaceReplaced = useIsWorkspaceReplaced();

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
        if (event.key !== 'Escape' || !running || event.defaultPrevented) return;
        event.preventDefault();
        stopAgentRun(running.runId);
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

      {/* The preview bar's height, so the two rules line up. */}
      <header className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
        <div className="flex items-center gap-2">
          <Spark />
          <Text as="h2" variant="title">
            Assistant
          </Text>
        </div>
        <div className="flex items-center gap-0.5">
          <AppTooltip content="New conversation">
            <AppButton
              variant="ghost"
              size="xs"
              shape="square"
              onClick={startNewConversation}
              aria-label="New conversation"
            >
              <SquarePen className="size-3.5" />
            </AppButton>
          </AppTooltip>
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

      <AgentTranscript />
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
    </aside>
  );
}
