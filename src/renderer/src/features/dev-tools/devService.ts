import { readOr } from '@/lib/services/readOr';
import type { DevSwitches, DevToolRun } from '@shared/types/devTools';

/*
 * What the developer tools keep in main. Only a development build has this part of the
 * bridge, so without it a read answers as a failed one does, and a write does nothing.
 */
export const devService = {
  /** Never rejects. */
  readRecent: () =>
    readOr<DevToolRun[]>(
      async () => (await window.mosaic.dev?.readRecent()) ?? [],
      [],
      'Could not read the recent tools'
    ),
  saveRecent: async (runs: DevToolRun[]) => window.mosaic.dev?.saveRecent(runs),
  /** Never rejects. */
  readSwitches: () =>
    readOr<DevSwitches | null>(
      async () => (await window.mosaic.dev?.readSwitches()) ?? null,
      null,
      'Could not read the switches'
    ),
  saveSwitches: async (switches: DevSwitches) => window.mosaic.dev?.saveSwitches(switches),
  /** Never rejects. */
  readReopenAddress: () =>
    readOr(
      async () => (await window.mosaic.dev?.readReopenAddress()) ?? null,
      null,
      'Could not read the view to reopen'
    ),
  saveReopenAddress: async (address: string) => window.mosaic.dev?.saveReopenAddress(address),
  /** Rejects when main can't say: an empty check would read as a real one. */
  readMemory: async () => (await window.mosaic.dev?.readMemory()) ?? [],
  seedLongConversation: async (messageCount: number) => {
    const conversationId = await window.mosaic.dev?.seedLongConversation(messageCount);
    if (conversationId === undefined) throw new Error('Only a development build can do this');
    return conversationId;
  },
  /** Never rejects. */
  readDataFolder: () =>
    readOr(
      async () => (await window.mosaic.dev?.readDataFolder()) ?? null,
      null,
      'Could not read the data folder'
    ),
  onOpenTools: (open: () => void) => window.mosaic.dev?.onOpenTools(open),
};
