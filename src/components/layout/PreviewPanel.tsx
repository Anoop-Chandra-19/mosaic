export function PreviewPanel() {
  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-muted">
      <div className="px-6 pt-4 pb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Live Preview
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mx-auto w-full max-w-[640px] rounded-sm bg-white p-10 shadow-lg dark:shadow-zinc-900/50">
          <div className="text-center">
            <h1
              className="text-2xl font-bold text-zinc-900"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              John Doe
            </h1>
            <p className="mt-1 text-sm text-zinc-600" style={{ fontFamily: 'Georgia, serif' }}>
              john@example.com | (555) 123-4567 | San Francisco, CA
            </p>
          </div>

          <hr className="my-4 border-zinc-300" />

          <div>
            <h2
              className="mb-2 text-sm font-bold uppercase tracking-wider text-zinc-800"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Experience
            </h2>
            <div className="mb-3">
              <div className="flex items-baseline justify-between">
                <span
                  className="font-semibold text-zinc-800"
                  style={{ fontFamily: 'Georgia, serif' }}
                >
                  Software Engineer
                </span>
                <span className="text-xs text-zinc-500" style={{ fontFamily: 'Georgia, serif' }}>
                  2022 — Present
                </span>
              </div>
              <p className="text-sm text-zinc-600 italic" style={{ fontFamily: 'Georgia, serif' }}>
                Acme Corp
              </p>
              <ul
                className="mt-1 list-disc pl-5 text-sm text-zinc-700"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                <li>Built scalable microservices handling 10K+ requests/sec</li>
                <li>Led migration from monolith to event-driven architecture</li>
              </ul>
            </div>
          </div>

          <div>
            <h2
              className="mb-2 text-sm font-bold uppercase tracking-wider text-zinc-800"
              style={{ fontFamily: 'Georgia, serif' }}
            >
              Education
            </h2>
            <div className="flex items-baseline justify-between">
              <span
                className="font-semibold text-zinc-800"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                B.S. Computer Science
              </span>
              <span className="text-xs text-zinc-500" style={{ fontFamily: 'Georgia, serif' }}>
                2018 — 2022
              </span>
            </div>
            <p className="text-sm text-zinc-600 italic" style={{ fontFamily: 'Georgia, serif' }}>
              Stanford University
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
