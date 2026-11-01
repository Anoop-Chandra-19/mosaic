import type { Ref } from 'react';
import { ChevronRight, MessageSquare } from 'lucide-react';
import {
  AppButton,
  AppTabs,
  AppTabsContent,
  AppTabsList,
  AppTabsTrigger,
  AppTooltip,
} from '@/components/ui-kit';
import { setPaneTab, useAgentPaneStore, type PaneTab } from '@/stores/agentPaneStore';
import { TraceView } from './trace/TraceView';
import { AgentTranscript } from './transcript/AgentTranscript';

interface PaneTabsProps {
  sessionsRef: Ref<HTMLButtonElement>;
  onOpenSessions: () => void;
}

/**
 * The pane's two views of the open conversation. The conversation stays mounted under the
 * Trace, so coming back finds it where it was; the Trace is drawn only while it is open.
 * Sessions sits at the end of their row but isn't one of them: it opens the list of every
 * conversation, so it stays outside the tab list.
 */
export function PaneTabs({ sessionsRef, onOpenSessions }: PaneTabsProps) {
  const tab = useAgentPaneStore((s) => s.tab);
  return (
    <AppTabs
      value={tab}
      onValueChange={(next) => setPaneTab(next as PaneTab)}
      className="min-h-0 flex-1"
    >
      <div className="relative shrink-0">
        <AppTabsList variant="folder">
          <AppTabsTrigger variant="folder" value="conversation">
            Conversation
          </AppTabsTrigger>
          <AppTabsTrigger variant="folder" value="trace">
            Trace
          </AppTabsTrigger>
        </AppTabsList>
        <div className="absolute right-2 bottom-0 flex">
          <AppTooltip content="All conversations">
            <AppButton ref={sessionsRef} variant="tab" shape="tab" onClick={onOpenSessions}>
              <MessageSquare className="size-3" />
              Sessions
              <ChevronRight className="size-2.5 text-ink-faint" />
            </AppButton>
          </AppTooltip>
        </div>
      </div>
      <AppTabsContent
        value="conversation"
        forceMount
        tabIndex={-1}
        className="flex min-h-0 flex-col data-[state=inactive]:hidden"
      >
        <AgentTranscript />
      </AppTabsContent>
      <AppTabsContent value="trace" tabIndex={-1} className="flex min-h-0 flex-col">
        <TraceView />
      </AppTabsContent>
    </AppTabs>
  );
}
