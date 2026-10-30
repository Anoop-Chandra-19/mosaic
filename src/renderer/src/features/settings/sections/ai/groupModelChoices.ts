import type { ModelProviderId } from '@shared/types/modelProviders';

export interface ModelChoice {
  model: string;
  /** Words at the row's end, as "Mosaic’s pick". */
  tag?: string;
}

export interface ModelChoiceGroup {
  /** Null for the group of Mosaic's pick, which needs no heading. */
  heading: string | null;
  /** How many the heading counts: OpenRouter's vendors only. */
  count?: number;
  choices: ModelChoice[];
}

interface ModelChoiceSources {
  provider: ModelProviderId;
  /** Mosaic's pick for the provider; a server the user runs has none. */
  suggested: string | null;
  /** Models the assistant has run with on this provider, the most recent first. */
  used: string[];
  /** What the provider lists, newest first; empty without a list. */
  listed: string[];
  query: string;
}

const matchesQuery = (model: string, query: string) =>
  model.toLowerCase().includes(query.trim().toLowerCase());

/** OpenRouter's names start with their vendor: "anthropic/claude-sonnet-5". */
function groupByVendor(models: string[]): ModelChoiceGroup[] {
  const byVendor = new Map<string, string[]>();
  for (const model of models) {
    const vendor = model.split('/')[0];
    byVendor.set(vendor, [...(byVendor.get(vendor) ?? []), model]);
  }
  return [...byVendor].map(([vendor, vendorModels]) => ({
    heading: vendor,
    count: vendorModels.length,
    choices: vendorModels.map((model) => ({ model })),
  }));
}

/**
 * The model list's groups, each model once: Mosaic's pick, then Used before, then the rest of
 * what the key or server lists (by vendor on OpenRouter). A query keeps the models whose
 * names hold it.
 */
export function groupModelChoices({
  provider,
  suggested,
  used,
  listed,
  query,
}: ModelChoiceSources): ModelChoiceGroup[] {
  const usedBefore = used.filter((model) => model !== suggested);
  const shown = new Set<string | null>([suggested, ...usedBefore]);
  const rest = listed.filter((model) => !shown.has(model) && matchesQuery(model, query));
  const groups: ModelChoiceGroup[] = [];

  if (suggested !== null && matchesQuery(suggested, query)) {
    groups.push({ heading: null, choices: [{ model: suggested, tag: 'Mosaic’s pick' }] });
  }
  const usedMatches = usedBefore.filter((model) => matchesQuery(model, query));
  if (usedMatches.length > 0) {
    groups.push({ heading: 'Used before', choices: usedMatches.map((model) => ({ model })) });
  }
  if (provider === 'openrouter') {
    groups.push(...groupByVendor(rest));
  } else if (rest.length > 0) {
    const heading = provider === 'openaiCompatible' ? 'On this server' : 'From your key';
    groups.push({ heading, choices: rest.map((model) => ({ model })) });
  }
  return groups;
}

/** Whether the key's list has the model. Gemini's own names start `models/`; its list leaves that off. */
export const isModelListed = (listed: string[], model: string) =>
  listed.includes(model.replace(/^models\//, ''));

/** Where the query falls in a name, to mark it; null when it doesn't. */
export function findQueryInName(
  model: string,
  query: string
): { before: string; match: string; after: string } | null {
  const needle = query.trim().toLowerCase();
  const start = needle ? model.toLowerCase().indexOf(needle) : -1;
  if (start < 0) return null;
  const end = start + needle.length;
  return { before: model.slice(0, start), match: model.slice(start, end), after: model.slice(end) };
}
