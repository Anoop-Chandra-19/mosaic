import { useMemo, type ReactNode } from 'react';
import { PanelLeft, PanelRight, type LucideIcon } from 'lucide-react';
import { AppButton, AppTooltip } from '@/components/ui-kit';
import { useActiveTemplate } from '@/stores/useActiveTemplate';
import { useVersionDistance, type VersionDistance } from '@/features/history/useVersionDistance';
import { versionLabel } from '@/lib/versionLabel';
import { useShortcutLabel } from '@/stores/shortcutBindings';
import { formatRelativeTime } from '@shared/time/formatTime';
import { useNow } from '@/lib/hooks/useNow';
import type { ShortcutId } from '@/lib/shortcutCatalog';
import { cn } from '@/lib/utils';
import { countSuggestions } from '@/features/suggestions/suggestionState';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { selectTemplateProposals, useProposalStore } from '@/stores/proposalStore';
import { usePreviewStore } from '@/stores/previewStore';
import { useResumeStore } from '@/stores/resumeStore';
import { useUiStore } from '@/stores/uiStore';
import { countWords } from './wordCount';

function PaneToggle({
  label,
  shortcut,
  icon: Icon,
  pressed,
  onToggle,
}: {
  label: string;
  shortcut: ShortcutId;
  icon: LucideIcon;
  pressed: boolean;
  onToggle: () => void;
}) {
  const keys = useShortcutLabel(shortcut);
  return (
    // The design's status bar button: 22 by 20, amber while its pane is showing.
    <AppButton
      variant="quiet"
      size="2xs"
      shape="square"
      onClick={onToggle}
      aria-label={label}
      aria-pressed={pressed}
      title={keys ? `${label}  ${keys}` : label}
      className={cn(
        'aspect-auto h-5 w-5.5 rounded-sm hover:text-foreground',
        pressed && 'text-amber hover:text-amber'
      )}
    >
      <Icon className="size-3.5" />
    </AppButton>
  );
}

function Divider() {
  return <span className="text-line-heavy">|</span>;
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

/** The assistant's suggestions over the draft, apart from it: never in the file until applied. */
function SuggestionsWaiting({ templateId }: { templateId: string }) {
  const proposals = useProposalStore((s) => selectTemplateProposals(s, templateId));
  const openSurface = useOverlayStore((s) => s.openSurface);
  const { waiting, stale } = countSuggestions(proposals);
  if (!waiting && !stale) return null;
  return (
    <AppButton
      variant="waiting"
      size="xs"
      className="h-5 px-0"
      title="Suggestions are waiting. Nothing changes until you apply. Click to review."
      onClick={() => openSurface({ kind: 'review' })}
    >
      <span className="size-1.5 rounded-full bg-amber shadow-[0_0_0_3px_var(--amber-soft)]" />
      {waiting} {waiting === 1 ? 'suggestion' : 'suggestions'} waiting
      {stale > 0 && <span className="text-ink-muted">· {stale} out of date</span>}
    </AppButton>
  );
}

/**
 * The draft against the newest version: how many steps away it is, and which way. A draft
 * that was opened with edits already in it has nothing to count, so it just says so.
 */
function describeDistance({ matches, changes, undone, counted }: VersionDistance, label: string) {
  if (matches) return `Matches ${label}`;
  if (!counted) return `Edited since ${label}`;
  const steps = `${changes} ${changes === 1 ? 'change' : 'changes'}`;
  return `${steps} ${undone ? 'undone past' : 'since'} ${label}`;
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
  const meta = usePreviewStore((s) => s.previewMeta);
  const paperSize = useUiStore((s) => s.paperSize);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const shouldShowPreview = useUiStore((s) => s.shouldShowPreview);
  const toggleSidebar = useUiStore((s) => s.toggleSidebarCollapsed);
  const agentPaneOpen = useUiStore((s) => s.agentPaneOpen);
  const toggleAgentPane = useUiStore((s) => s.toggleAgentPane);
  const isAgentEnabled = useAgentSettingsStore((s) => s.enabled);
  const now = useNow(30_000);

  let saveState: ReactNode;
  if (!template) {
    saveState = <span className="text-ink-faint">No resume open</span>;
  } else if (saveFailed) {
    saveState = (
      <AppTooltip side="top" content="Your edits are safe. Mosaic retries with your next change.">
        <span className="text-del">Couldn’t save the last change</span>
      </AppTooltip>
    );
  } else {
    saveState = (
      <AppTooltip side="top" content="Every change is written to your computer as you type.">
        <span className="flex items-center gap-1.5">
          <span className="size-1.25 rounded-full bg-add" />
          Autosaved · {formatRelativeTime(savedAt ?? template.updatedAt, now)}
        </span>
      </AppTooltip>
    );
  }

  const pages = `${meta.totalPages}${meta.hasMorePages ? '+' : ''}`;
  const pagesWord = meta.totalPages === 1 && !meta.hasMorePages ? 'page' : 'pages';

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between gap-3 border-t border-line bg-chrome px-2 text-support text-ink-muted tabular-nums">
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap">
        {/* Without the preview, the sidebar is all there is, so it stays. */}
        {shouldShowPreview && (
          <PaneToggle
            label="Toggle sidebar"
            shortcut="toggleSidebar"
            icon={PanelLeft}
            pressed={!sidebarCollapsed}
            onToggle={toggleSidebar}
          />
        )}
        {saveState}
        {template && (
          <>
            <Divider />
            <AppTooltip
              side="top"
              content={`${versionLabel(template.head)}: ${template.head.summary}`}
            >
              <span className="truncate">
                {/* Unlike the top bar's badge, this speaks even for a brand-new template's v1. */}
                {describeDistance(distance, versionLabel(template.head))}
              </span>
            </AppTooltip>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
        {template && isAgentEnabled && <SuggestionsWaiting templateId={template.id} />}
        {template && (
          <>
            <Words />
            {/* The preview is what lays out the pages; hidden, it has nothing to count. */}
            {shouldShowPreview && (
              <>
                <Divider />
                <span>
                  {pages} {pagesWord} · {paperSize === 'a4' ? 'A4' : 'Letter'}
                </span>
              </>
            )}
          </>
        )}
        {isAgentEnabled && (
          <PaneToggle
            label="Toggle assistant"
            shortcut="toggleAssistant"
            icon={PanelRight}
            pressed={agentPaneOpen}
            onToggle={toggleAgentPane}
          />
        )}
      </div>
    </footer>
  );
}
