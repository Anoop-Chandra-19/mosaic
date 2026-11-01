import { AppTabs, AppTabsContent, AppTabsList, AppTabsTrigger, Text } from '@/components/ui-kit';
import { formatCount } from '@/lib/formatCount';
import { useConversationStore } from '@/stores/conversationStore';
import { TraceView } from './trace/TraceView';
import { AgentTranscript } from './transcript/AgentTranscript';

export type PaneTab = 'conversation' | 'trace';

/** The newest message knows its run's number, which is how many there are. */
function useRunCount(): number {
  return useConversationStore((s) => (s.hasNewer ? s.lastRun : s.messages).at(-1)?.runNumber ?? 0);
}

interface PaneTabsProps {
  tab: PaneTab;
  onTabChange: (tab: PaneTab) => void;
}

/**
 * The pane's two views of the open conversation. The conversation stays mounted under the
 * Trace, so coming back finds it where it was; the Trace is drawn only while it is open.
 */
export function PaneTabs({ tab, onTabChange }: PaneTabsProps) {
  const runCount = useRunCount();
  return (
    <AppTabs
      value={tab}
      onValueChange={(next) => onTabChange(next as PaneTab)}
      className="min-h-0 flex-1"
    >
      <div className="@container/tabs shrink-0">
        <AppTabsList variant="folder">
          <AppTabsTrigger variant="folder" value="conversation">
            Conversation
          </AppTabsTrigger>
          <AppTabsTrigger variant="folder" value="trace">
            Trace
            {runCount > 0 && (
              <Text variant="meta" className="whitespace-nowrap @max-[26.25rem]/tabs:hidden">
                {formatCount(runCount, 'run')}
              </Text>
            )}
          </AppTabsTrigger>
        </AppTabsList>
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
