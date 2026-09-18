import { LayoutTemplate, Plus } from 'lucide-react';
import { AppButton } from '@/components/AppButton';
import { createBlankResume } from '@/features/start/blankResume';
import { useStartResume } from '@/features/start/useStartResume';
import { createEmptyResume } from '@/lib/resume/defaultResume';
import { useOverlayStore } from '@/stores/overlayStore';

/**
 * Nothing is open. On a first launch this sits behind the Start panel; after the last
 * template is deleted it is the honest state of the app — any template can be deleted,
 * the last one included — and starting a resume from here opens a fresh template.
 */
export function NoTemplates() {
  const firstRun = useOverlayStore((s) => s.startOpen);
  const start = useStartResume();

  const startResume = () =>
    firstRun
      ? start(
          'Untitled resume',
          createBlankResume(),
          'Created “Untitled resume” — your first template, autosaving as you type'
        )
      : start(
          'Untitled resume',
          createEmptyResume(),
          'Created “Untitled resume” — it saves as you type'
        );

  return (
    <div className="mx-auto max-w-sm px-2.5 py-8 text-center">
      <div className="mx-auto mb-3 grid size-11 place-items-center rounded-xl border border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
        <LayoutTemplate className="size-4.5" />
      </div>
      <p className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {firstRun ? 'No templates yet' : 'No templates'}
      </p>
      <p className="mb-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        {firstRun
          ? 'A template holds one resume’s content and its history. Your first one is created as soon as you start writing.'
          : 'Nothing is open. Start a resume and Mosaic creates a template for it, with its own history.'}
      </p>
      <AppButton variant="outline" size="sm" onClick={() => void startResume()}>
        <Plus />
        Start a resume
      </AppButton>
    </div>
  );
}
