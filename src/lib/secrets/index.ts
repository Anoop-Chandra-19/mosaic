import type { SecretsClient } from './types';
import { webSessionSecrets } from './webSessionSecrets';

// Keys stay in this page's memory until the AI settings move to `window.mosaic.secrets`,
// whose keys never come back to the renderer.
export function getSecretsClient(): SecretsClient {
  return webSessionSecrets;
}
