import { ExternalLink } from 'lucide-react';
import { AppButton, AppSwitch, Text } from '@/components/ui-kit';
import { MosaicMark } from '@/components/MosaicMark';
import { HISTORY_TIPS_LABEL } from '@/features/history/snapshotSettings';
import { startHistoryTour } from '@/features/onboarding/history/startHistoryTour';
import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { isHistoryTipSeen, useUiStore } from '@/stores/uiStore';
import { HISTORY_TIP_IDS } from '@/types/history';
import { SettingRow } from '../SettingRow';

const SOURCE_URL = 'https://github.com/Anoop-Chandra-19/mosaic';

export function AboutSection() {
  const hasResume = useResumeStore((s) => s.templateId !== null);
  const closeSettings = useOverlayStore((s) => s.closeSettings);
  const startTour = useOverlayStore((s) => s.startTour);
  return (
    <>
      <div className="mt-3.5 mb-2 flex items-center gap-3">
        <MosaicMark size="lg" />
        <div>
          <Text as="p" variant="title">
            Mosaic {__APP_VERSION__}
          </Text>
          <Text as="p" variant="secondary">
            Everything stays on your computer. No account, no server.
          </Text>
        </div>
      </div>
      <SettingRow
        label="Source"
        description="Open source. Fork it, audit it, or run it from source."
      >
        <AppButton variant="outline" size="sm" asChild>
          {/* Opens in the system browser: the app never navigates away from itself. */}
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            <ExternalLink />
            GitHub
          </a>
        </AppButton>
      </SettingRow>

      <Text as="h3" variant="heading" className="mt-5">
        Tours and tips
      </Text>
      <Text as="p" variant="secondary" className="mt-1 mb-1.5">
        Each one runs over the real interface. Replay any of them whenever you like.
      </Text>
      <SettingRow
        label="Getting started"
        description={
          hasResume ? 'Editing, history and export, about a minute.' : 'Runs once a resume is open.'
        }
      >
        <AppButton
          variant="outline"
          size="sm"
          disabled={!hasResume}
          onClick={() => {
            closeSettings();
            startTour('gettingStarted');
          }}
        >
          Replay
        </AppButton>
      </SettingRow>
      <SettingRow
        label="How history works"
        description={
          hasResume ? 'Six stops, on an example history.' : 'Runs once a resume is open.'
        }
      >
        <AppButton variant="outline" size="sm" disabled={!hasResume} onClick={startHistoryTour}>
          Start
        </AppButton>
      </SettingRow>
      <HistoryTipsRow />
    </>
  );
}

/** Whether new kinds of history rows are explained, how many are, and starting over. */
function HistoryTipsRow() {
  const tips = useUiStore((s) => s.historyTips);
  const setTipsOn = useUiStore((s) => s.setHistoryTipsOn);
  const resetTips = useUiStore((s) => s.resetHistoryTips);
  const seenCount = HISTORY_TIP_IDS.filter((id) => isHistoryTipSeen(tips.seen[id])).length;
  return (
    <SettingRow
      label={HISTORY_TIPS_LABEL}
      description={`${seenCount} of ${HISTORY_TIP_IDS.length} seen.`}
    >
      <div className="flex items-center gap-2">
        <AppButton variant="ghost" size="sm" disabled={seenCount === 0} onClick={resetTips}>
          Reset tips
        </AppButton>
        <AppSwitch
          checked={tips.isOn}
          onCheckedChange={setTipsOn}
          aria-label={HISTORY_TIPS_LABEL}
        />
      </div>
    </SettingRow>
  );
}
