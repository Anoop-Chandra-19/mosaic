import type { Database } from 'better-sqlite3';
import { isRecord } from '@shared/resume/validateResume';
import {
  DEFAULT_OPENAI_COMPATIBLE_ADDRESS,
  normalizeOllamaAddress,
  normalizeOpenAiCompatibleAddress,
} from '@shared/model-providers/serverAddress';
import { AGENT_SETTINGS_KEY } from '@shared/types/modelProviders';
import { getSetting } from '../db/settings';
import { isModelProviderId, type ModelChoice } from '../model-providers/createModelProvider';

/*
 * Reads and validates the renderer's saved model settings at each run start so every
 * caller uses the current selection. The stored Zustand record has shape `{ state, version }`;
 * its fields are untrusted because they originate in the renderer.
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

/** Use the default for older settings that lack this address; reject invalid saved values. */
function readOpenAiCompatibleAddress(stored: unknown): string | null {
  if (stored === undefined) return DEFAULT_OPENAI_COMPATIBLE_ADDRESS;
  return typeof stored === 'string' ? normalizeOpenAiCompatibleAddress(stored) : null;
}

/** Returns null when the assistant is disabled or the required settings are missing or invalid. */
export function readModelChoice(db: Database): ModelChoice | null {
  const state = parseStoredState(getSetting(db, AGENT_SETTINGS_KEY));
  if (!isRecord(state) || state.enabled !== true) return null;
  const { provider, modelsByProvider, ollamaContextTokens } = state;
  if (!isModelProviderId(provider) || !isRecord(modelsByProvider)) return null;
  const model = modelsByProvider[provider];
  const address =
    typeof state.ollamaAddress === 'string' ? normalizeOllamaAddress(state.ollamaAddress) : null;
  const compatibleAddress = readOpenAiCompatibleAddress(state.openAiCompatibleAddress);
  if (
    !isModelName(model) ||
    address === null ||
    compatibleAddress === null ||
    !isContextTokens(ollamaContextTokens)
  ) {
    return null;
  }
  return {
    provider,
    model,
    ollama: { address, contextTokens: ollamaContextTokens },
    openAiCompatible: { address: compatibleAddress },
  };
}
