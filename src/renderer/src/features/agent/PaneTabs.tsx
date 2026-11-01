import { AppTabs, AppTabsContent, AppTabsList, AppTabsTrigger } from '@/components/ui-kit';
import { TraceView } from './trace/TraceView';
import { AgentTranscript } from './transcript/AgentTranscript';

export type PaneTab = 'conversation' | 'trace';

interface PaneTabsProps {
  tab: PaneTab;
  onTabChange: (tab: PaneTab) => void;
}

/**
 * The pane's two views of the open conversation. The conversation stays mounted under the
 * Trace, so coming back finds it where it was; the Trace is drawn only while it is open.
 */
export function PaneTabs({ tab, onTabChange }: PaneTabsProps) {
  return (
    <AppTabs
      value={tab}
      onValueChange={(next) => onTabChange(next as PaneTab)}
      className="min-h-0 flex-1"
    >
      <AppTabsList variant="folder" className="shrink-0">
        <AppTabsTrigger variant="folder" value="conversation">
          Conversation
        </AppTabsTrigger>
        <AppTabsTrigger variant="folder" value="trace">
          Trace
        </AppTabsTrigger>
      </AppTabsList>
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
