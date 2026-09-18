import { useRef } from 'react';
import { Sparkles, X } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AI_PROVIDER_BY_ID } from '@/features/settings/sections/aiProviderOptions';
import { startPaneResize } from '@/features/shell/paneResize';
import { shortcutLabel } from '@/lib/keyboardShortcuts';
import { AI_PROVIDER_DEFAULT_MODEL, useAIStore } from '@/stores/aiStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { AGENT_PANE_MAX_RATIO, AGENT_PANE_MIN_PX, useUIStore } from '@/stores/uiStore';

function Spark() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
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
  const ratio = useUIStore((s) => s.agentPaneRatio);
  const setRatio = useUIStore((s) => s.setAgentPaneRatio);
  const close = useUIStore((s) => s.toggleAgentPane);
  const provider = useAIStore((s) => s.provider);
  const model = useAIStore((s) => s.modelsByProvider[s.provider]);
  const openSettings = useOverlayStore((s) => s.openSettings);
  const paneRef = useRef<HTMLElement>(null);

  return (
    <aside
      ref={paneRef}
      aria-label="Assistant"
      className="relative flex shrink-0 flex-col border-l border-border bg-card @max-5xl/workspace:absolute @max-5xl/workspace:inset-y-0 @max-5xl/workspace:right-0 @max-5xl/workspace:z-20 @max-5xl/workspace:shadow-xl"
      style={{ width: `max(${AGENT_PANE_MIN_PX}px, ${ratio * 100}vw)` }}
    >
      <div
        onPointerDown={(event) =>
          startPaneResize(event, {
            pane: paneRef.current,
            anchor: 'right',
            minPx: AGENT_PANE_MIN_PX,
            maxRatio: AGENT_PANE_MAX_RATIO,
            onDone: setRatio,
          })
        }
        className="absolute top-0 bottom-0 left-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-amber-500 active:bg-amber-600"
      />

      {/* Same padding and control size as the preview's header, so the two rules line up. */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Spark />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Assistant</h2>
        </div>
        <AppButton
          variant="ghost"
          size="icon-xs"
          onClick={close}
          aria-label="Close assistant"
          title={`Close  ${shortcutLabel('\\')}`}
        >
          <X className="size-3.5" />
        </AppButton>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Not built yet. This is where you’ll ask for changes and attach job postings, and every
          suggestion will come back for review before it touches the page.
        </p>
      </div>

      <footer className="border-t border-border px-4 py-2.5 text-xs text-zinc-500">
        {AI_PROVIDER_BY_ID[provider].label} ·{' '}
        <span className="font-mono">{model || AI_PROVIDER_DEFAULT_MODEL[provider]}</span>
        {' — '}
        <button
          type="button"
          onClick={() => openSettings('ai')}
          className="font-medium text-amber-700 hover:underline dark:text-amber-400"
        >
          change
        </button>
      </footer>
    </aside>
  );
}
