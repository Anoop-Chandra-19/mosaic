import { useCallback, useEffect, useState } from 'react';
import type { SecretsStatus } from '@/types/secrets';

/**
 * Which API keys main holds, and where. Loaded when a section opens — main answers without
 * touching the keychain — and replaced by the status each change returns.
 */
export function useSecretsStatus() {
  const [status, setStatus] = useState<SecretsStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let current = true;
    window.mosaic.secrets.status().then(
      (loaded) => current && setStatus(loaded),
      (error: unknown) => {
        console.error('Could not check for saved keys', error);
        if (current) setLoadFailed(true);
      }
    );
    return () => {
      current = false;
    };
  }, []);

  /** Runs a change and shows the status main answers with. Rejects if main refused it. */
  const apply = useCallback(async (change: Promise<SecretsStatus>) => {
    setStatus(await change);
  }, []);

  return { status, loadFailed, apply };
}
