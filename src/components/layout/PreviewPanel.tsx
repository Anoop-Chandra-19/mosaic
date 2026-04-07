import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { ResumePreview, type ResumePreviewMeta } from '@/components/preview/ResumePreview';

const DEFAULT_META: ResumePreviewMeta = {
  visiblePages: 1,
  totalPages: 1,
  hasOverflowBeyondTwo: false,
};

export function PreviewPanel() {
  const [meta, setMeta] = useState<ResumePreviewMeta>(DEFAULT_META);

  const pageLabel = meta.hasOverflowBeyondTwo ? '2+' : `${meta.visiblePages}`;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 md:px-6">
        <span className="text-xs font-semibold tracking-widest text-zinc-900 uppercase dark:text-zinc-100">
          Live Preview
        </span>

        <div className="flex items-center gap-1.5">
          {meta.hasOverflowBeyondTwo && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <TriangleAlert className="size-3" />
              2+ pages
            </span>
          )}

          <span className="inline-flex items-center rounded-md border border-zinc-300 bg-background px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-xs dark:border-zinc-700 dark:text-zinc-200">
            {pageLabel}{' '}
            {meta.hasOverflowBeyondTwo ? 'pages' : meta.visiblePages === 1 ? 'page' : 'pages'}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-6">
        <ResumePreview onMetaChange={setMeta} />
      </div>
    </main>
  );
}
