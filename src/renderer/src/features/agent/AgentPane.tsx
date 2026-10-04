import { useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { Text } from '@/components/Text';
import { AI_PROVIDER_BY_ID } from '@/features/settings/sections/aiProviderOptions';
import { formatPaneWidth, startPaneResize } from '@/features/shell/paneResize';
import { shortcutLabel } from '@/lib/keyboardShortcuts';
import { AI_PROVIDER_DEFAULT_MODEL, useAiStore } from '@/stores/aiStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { AGENT_PANE_WIDTH, useUiStore } from '@/stores/uiStore';

function Spark() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-amber-line bg-amber-soft text-amber">
      <Sparkles className="size-3" />
    </span>
  );
}

/**
 * The assistant, on the right of the preview — drawn only while AI is on. The agent that
 * answers in it is still to come, so for now the pane says so, and which provider it will
 * use. On a window too narrow for editor, preview, and pane, it lies over the preview.
 */
export function AgentPane() {
  const widthPx = useUiStore((s) => s.agentPaneWidthPx);
  const setWidthPx = useUiStore((s) => s.setAgentPaneWidthPx);
  const close = useUiStore((s) => s.toggleAgentPane);
  const provider = useAiStore((s) => s.provider);
  const model = useAiStore((s) => s.modelsByProvider[s.provider]);
  const openSettings = useOverlayStore((s) => s.openSettings);
  const paneRef = useRef<HTMLElement>(null);

  return (
    <aside
      ref={paneRef}
      aria-label="Assistant"
      className="relative flex shrink-0 flex-col border-l border-line bg-pane @max-5xl/workspace:absolute @max-5xl/workspace:inset-y-0 @max-5xl/workspace:right-0 @max-5xl/workspace:z-20 @max-5xl/workspace:shadow-overlay"
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

      {/* Same padding and control size as the preview's header, so the two rules line up. */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Spark />
          <Text as="h2" variant="title">
            Assistant
          </Text>
        </div>
        <AppButton
          variant="ghost"
          size="xs"
          shape="square"
          onClick={close}
          aria-label="Close assistant"
          title={`Close  ${shortcutLabel('\\')}`}
        >
          <X className="size-3.5" />
        </AppButton>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <Text as="p" variant="body" className="text-pretty">
          Not built yet. This is where you’ll ask for changes and attach job postings, and every
          suggestion will come back for review before it touches the page.
        </Text>
      </div>

      <Text
        as="footer"
        variant="secondary"
        className="block border-t border-line px-4 py-2.5 text-ink-faint"
      >
        {AI_PROVIDER_BY_ID[provider].label} ·{' '}
        <Text variant="meta">{model || AI_PROVIDER_DEFAULT_MODEL[provider]}</Text>
        {' · '}
        <AppButton
          variant="link"
          onClick={() => openSettings('ai')}
          className="h-auto p-0 align-baseline text-support text-amber underline-offset-2"
        >
          change
        </AppButton>
      </Text>
    </aside>
  );
}
