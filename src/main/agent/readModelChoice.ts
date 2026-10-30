import type { Database } from 'better-sqlite3';
import { isRecord } from '@shared/resume/validateResume';
import { normalizeOllamaAddress } from '@shared/model-providers/serverAddress';
import { AGENT_SETTINGS_KEY } from '@shared/types/modelProviders';
import { getSetting } from '../db/settings';
import { isModelProviderId, type ModelChoice } from '../model-providers/createModelProvider';

/*
 * Main reads the provider and model from the settings the renderer keeps (a Zustand
 * `persist` record, `{ state, version }`) as each run starts, so a run uses what Settings
 * says, whoever started it. The record came from the page: every field is checked here.
 */

const MAX_MODEL_NAME_LENGTH = 200;

const isModelName = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '' && value.length <= MAX_MODEL_NAME_LENGTH;

const isContextTokens = (value: unknown): value is number | null =>
  value === null || (Number.isInteger(value) && (value as number) > 0);

function parseStoredState(stored: string | null): unknown {
  if (stored === null) return undefined;
  try {
    return (JSON.parse(stored) as { state?: unknown } | null)?.state;
  } catch {
    return undefined;
  }
}

/** What Settings chose; null while the assistant is off, or if the settings can't be read. */
export function readModelChoice(db: Database): ModelChoice | null {
  const state = parseStoredState(getSetting(db, AGENT_SETTINGS_KEY));
  if (!isRecord(state) || state.enabled !== true) return null;
  const { provider, modelsByProvider, ollamaContextTokens } = state;
  if (!isModelProviderId(provider) || !isRecord(modelsByProvider)) return null;
  const model = modelsByProvider[provider];
  const address =
    typeof state.ollamaAddress === 'string' ? normalizeOllamaAddress(state.ollamaAddress) : null;
  if (!isModelName(model) || address === null || !isContextTokens(ollamaContextTokens)) {
    return null;
  }
  return { provider, model, ollama: { address, contextTokens: ollamaContextTokens } };
}
