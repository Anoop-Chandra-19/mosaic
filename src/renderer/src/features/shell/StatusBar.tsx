import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { PanelLeft, PanelRight, type LucideIcon } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { AppTooltip } from '@/components/AppTooltip';
import { formatRelativeTime } from '@/features/templates/formatRelativeTime';
import { useActiveTemplate } from '@/features/templates/useActiveTemplate';
import { useVersionDistance, type VersionDistance } from '@/features/templates/useVersionDistance';
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
    // The design's status bar button: 22 by 20, amber while its pane is showing.
    <AppButton
      variant="quiet"
      size="2xs"
      shape="square"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={pressed}
      title={`${label}  ${shortcutLabel(shortcut)}`}
      className={cn(
        'aspect-auto h-5 w-5.5 rounded-sm hover:text-foreground',
        pressed && 'text-amber-600 dark:text-amber-400'
      )}
    >
      <Icon className="size-3.5" />
    </AppButton>
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
 * The draft against the newest version: how many steps away it is, and which way. A draft
 * that was opened with edits already in it has nothing to count, so it just says so.
 */
function describeDistance({ matches, changes, undone, counted }: VersionDistance, version: number) {
  if (matches) return `Matches v${version}`;
  if (!counted) return `Edited since v${version}`;
  const steps = `${changes} ${changes === 1 ? 'change' : 'changes'}`;
  return `${steps} ${undone ? 'undone past' : 'since'} v${version}`;
}

/**
 * Three separate facts, never one word: the draft on disk (autosave), the draft against the
 * newest version in history, and the page as the preview lays it out. The two pane toggles
 * sit at the ends, next to the panes they open.
 */
export function StatusBar() {
  const template = useActiveTemplate();
  const distance = useVersionDistance();
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
      <AppTooltip
        side="top"
        content="The edits are still in the editor; Mosaic tries again with your next change."
      >
        <span className="text-red-700 dark:text-red-400">Couldn’t save the last change</span>
      </AppTooltip>
    );
  } else {
    saveState = (
      <AppTooltip side="top" content="Every change is written to this machine as you type.">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Autosaved · {formatRelativeTime(savedAt ?? template.updatedAt, now)}
        </span>
      </AppTooltip>
    );
  }

  const pages = `${meta.totalPages}${meta.hasMorePages ? '+' : ''}`;
  const pagesWord = meta.totalPages === 1 && !meta.hasMorePages ? 'page' : 'pages';

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
            <AppTooltip side="top" content={`v${template.versionCount}: ${template.head.summary}`}>
              <span className="truncate">
                {/* Unlike the top bar's badge, this speaks even for a brand-new template's v1. */}
                {describeDistance(distance, template.versionCount)}
              </span>
            </AppTooltip>
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
