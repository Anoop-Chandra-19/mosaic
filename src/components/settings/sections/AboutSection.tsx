import { BookOpen, Lock, Monitor } from 'lucide-react';

export function AboutSection() {
  return (
    <section className="space-y-4">
      <article className="rounded-xl border border-zinc-300 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Mosaic</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          A local-first modular resume builder with live preview and export-focused workflows.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-300 bg-background p-3 dark:border-zinc-700">
            <p className="inline-flex items-center gap-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
              <Monitor className="size-3.5" />
              Architecture
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              React + Zustand with persistent local state via Dexie IndexedDB.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-300 bg-background p-3 dark:border-zinc-700">
            <p className="inline-flex items-center gap-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
              <Lock className="size-3.5" />
              Privacy
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              Resume content stays local. AI keys use special handling.
            </p>
          </div>

          <div className="rounded-lg border border-zinc-300 bg-background p-3 dark:border-zinc-700">
            <p className="inline-flex items-center gap-1 text-xs font-semibold tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
              <BookOpen className="size-3.5" />
              Canonical Docs
            </p>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              See README and build plan for current architecture and roadmap.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}
