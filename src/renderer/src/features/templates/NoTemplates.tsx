import { LayoutTemplate, Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { Text } from '@/components/Text';
import { createBlankResume } from '@/features/start/blankResume';
import { useStartResume } from '@/features/start/useStartResume';
import { createEmptyResume } from '@shared/resume/defaultResume';
import { useOverlayStore } from '@/stores/overlayStore';

/**
 * Nothing is open. On a first launch this sits behind the Start panel; after the last
 * template is deleted it is the honest state of the app — any template can be deleted,
 * the last one included — and starting a resume from here opens a fresh template.
 */
export function NoTemplates() {
  const firstRun = useOverlayStore((s) => s.surface?.kind === 'start');
  const start = useStartResume();

  const startResume = () =>
    firstRun
      ? start(
          'Untitled resume',
          createBlankResume(),
          'Created “Untitled resume”, your first template. It saves as you type.'
        )
      : start(
          'Untitled resume',
          createEmptyResume(),
          'Created “Untitled resume”. It saves as you type.'
        );

  return (
    <div className="mx-auto max-w-sm px-2.5 py-8 text-center">
      <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl border border-line-strong bg-line text-ink-muted">
        <LayoutTemplate className="size-4.5" />
      </div>
      <Text as="p" variant="title" className="mb-1">
        {firstRun ? 'No templates yet' : 'No templates'}
      </Text>
      <Text as="p" variant="secondary" className="mb-3">
        {firstRun
          ? 'A template holds one resume’s content and its history. Your first one is created as soon as you start writing.'
          : 'Nothing is open. Start a resume and Mosaic creates a template for it, with its own history.'}
      </Text>
      <AppButton variant="outline" size="sm" onClick={() => void startResume()}>
        <Plus />
        Start a resume
      </AppButton>
    </div>
  );
}
