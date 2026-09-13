/** Shown instead of the app when boot fails — the stores never filled, so there is nothing to edit. */
export function BootFailure({ message }: { message: string }) {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-2 bg-zinc-950 p-6 text-center">
      <h1 className="text-base font-semibold text-zinc-100">Mosaic could not load your data</h1>
      <p className="max-w-prose text-sm text-zinc-400">{message}</p>
    </main>
  );
}
