import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PanelLeft, PanelRight, type LucideIcon } from 'lucide-react';
import { formatRelativeTime } from '@/features/templates/formatRelativeTime';
import { useActiveTemplate } from '@/features/templates/useActiveTemplate';
import { shortcutLabel } from '@/lib/keyboardShortcuts';
import { cn } from '@/lib/utils';
import { useAiStore } from '@/stores/aiStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useUiStore } from '@/stores/uiStore';
import { countWords } from './wordCount';

/** The current time, refreshed often enough for "2 min ago" to stay true. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function PaneToggle({
  label,
  shortcut,
  icon: Icon,
  pressed,
  onToggle,
}: {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={pressed}
      title={`${label}  ${shortcutLabel(shortcut)}`}
      className={cn(
        'flex size-5 items-center justify-center rounded transition-colors hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
        pressed ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-500'
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function Divider() {
  return <span className="text-zinc-400 dark:text-zinc-600">|</span>;
}

function Words() {
  const schemaVersion = useResumeStore((s) => s.schemaVersion);
  const contact = useResumeStore((s) => s.contact);
  const sections = useResumeStore((s) => s.sections);
  const words = useMemo(
    () => countWords({ schemaVersion, contact, sections }),
    [schemaVersion, contact, sections]
  );
  return (
    <span>
      {words} {words === 1 ? 'word' : 'words'}
    </span>
  );
}

/**
 * Three separate facts, never one word: the draft on disk (autosave), the draft against the
 * newest version in history, and the page as the preview lays it out. The two pane toggles
 * sit at the ends, next to the panes they open.
 */
export function StatusBar() {
  const template = useActiveTemplate();
  const rev = useResumeStore((s) => s.rev);
  const savedAt = useResumeStore((s) => s.savedAt);
  const saveFailed = useResumeStore((s) => s.saveFailed);
  const meta = useOverlayStore((s) => s.previewMeta);
  const paperSize = useUiStore((s) => s.paperSize);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebarCollapsed);
  const agentPaneOpen = useUiStore((s) => s.agentPaneOpen);
  const toggleAgentPane = useUiStore((s) => s.toggleAgentPane);
  const aiEnabled = useAiStore((s) => s.enabled);
  const now = useNow(30_000);

  let saveState: ReactNode;
  if (!template) {
    saveState = <span className="text-zinc-500">No resume open</span>;
  } else if (saveFailed) {
    saveState = (
      <span
        className="text-red-700 dark:text-red-400"
        title="The edits are still in the editor; Mosaic tries again with your next change."
      >
        Couldn’t save the last change
      </span>
    );
  } else {
    saveState = (
      <span
        className="flex items-center gap-1.5"
        title="Every change is written to this machine as you type."
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Autosaved · {formatRelativeTime(savedAt ?? template.updatedAt, now)}
      </span>
    );
  }

  const pages = meta.hasOverflowBeyondTwo ? '2+' : String(meta.visiblePages);
  const pagesWord = meta.visiblePages === 1 && !meta.hasOverflowBeyondTwo ? 'page' : 'pages';

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-2 text-xs text-zinc-600 dark:text-zinc-400">
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        <PaneToggle
          label="Toggle sidebar"
          shortcut="B"
          icon={PanelLeft}
          pressed={!sidebarCollapsed}
          onToggle={toggleSidebar}
        />
        {saveState}
        {template && (
          <>
            <Divider />
            <span
              className="truncate"
              title={`v${template.versionCount}: ${template.head.summary}`}
            >
              {/* Unlike the top bar's badge, this speaks even for a brand-new template's v1. */}
              {rev !== template.head.rev
                ? `Edited since v${template.versionCount}`
                : `Matches v${template.versionCount}`}
            </span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
        {template && (
          <>
            <Words />
            <Divider />
            <span>
              {pages} {pagesWord} · {paperSize === 'a4' ? 'A4' : 'Letter'}
            </span>
          </>
        )}
        {aiEnabled && (
          <PaneToggle
            label="Toggle assistant"
            shortcut="\"
            icon={PanelRight}
            pressed={agentPaneOpen}
            onToggle={toggleAgentPane}
          />
        )}
      </div>
    </footer>
  );
}
