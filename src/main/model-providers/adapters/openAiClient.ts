import OpenAI from 'openai';
import { REPLY_START_TIMEOUT_MS } from '../providerEndpoints';

/** Electron's `net.fetch` takes no `URL` objects; the SDK only ever passes a string. */
export type OpenAiFetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * The `openai` SDK's client, for OpenAI and for the providers that speak its API. Every
 * setting the SDK would otherwise take from the environment is given, so only Settings
 * decides where requests go and with which key.
 */
export function createOpenAiClient(apiKey: string, baseUrl: string, fetch: OpenAiFetch): OpenAI {
  return new OpenAI({
    apiKey,
    fetch: (url, init) => fetch(String(url), init),
    baseURL: baseUrl,
    organization: null,
    project: null,
    adminAPIKey: null,
    webhookSecret: null,
    maxRetries: 0,
    timeout: REPLY_START_TIMEOUT_MS,
    logLevel: 'off',
  });
}
