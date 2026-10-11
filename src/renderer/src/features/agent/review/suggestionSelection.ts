import { createContext } from 'react';

/** Which suggestion is being read, shared by the page's marks without laying the page out again. */
export const SuggestionSelection = createContext<{
  selectedId: string | null;
  select: (id: string | null) => void;
}>({ selectedId: null, select: () => {} });
