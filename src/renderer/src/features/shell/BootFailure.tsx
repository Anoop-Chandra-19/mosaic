import { Text } from '@/components/Text';

/** Shown instead of the app when boot fails — the stores never filled, so there is nothing to edit. */
export function BootFailure({ message }: { message: string }) {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-2 bg-background p-6 text-center">
      <Text as="h1" variant="title">
        Mosaic could not load your data
      </Text>
      <Text as="p" variant="body" className="max-w-prose text-ink-muted">
        {message}
      </Text>
    </main>
  );
}
