import { ExternalLink } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { MosaicMark } from '@/components/MosaicMark';
import { Text } from '@/components/Text';
import { useOverlayStore } from '@/stores/overlayStore';
import { useResumeStore } from '@/stores/resumeStore';
import { SettingRow } from '../SettingRow';

const SOURCE_URL = 'https://github.com/Anoop-Chandra-19/mosaic';

export function AboutSection() {
  const hasResume = useResumeStore((s) => s.templateId !== null);
  const closeSettings = useOverlayStore((s) => s.closeSettings);
  const setTourStep = useOverlayStore((s) => s.setTourStep);
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
        Guided tours
      </Text>
      <Text as="p" variant="secondary" className="mt-1 mb-1.5">
        Each one runs over the real interface. Replay any of them whenever you like.
      </Text>
      <SettingRow
        label="The basics"
        description={
          hasResume
            ? 'Content, the live page, history and named versions, templates, export.'
            : 'Runs once a resume is open.'
        }
      >
        <AppButton
          variant="outline"
          size="sm"
          disabled={!hasResume}
          onClick={() => {
            closeSettings();
            setTourStep(0);
          }}
        >
          Replay
        </AppButton>
      </SettingRow>
    </>
  );
}
