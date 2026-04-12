import type { SecretsClient } from './types';
import { webSessionSecrets } from './webSessionSecrets';

interface MosaicBridge {
  secrets?: SecretsClient;
}

function getBridgeSecrets(): SecretsClient | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const bridge = (window as Window & { mosaic?: MosaicBridge }).mosaic;
  return bridge?.secrets ?? null;
}

export function getSecretsClient(): SecretsClient {
  return getBridgeSecrets() ?? webSessionSecrets;
}
