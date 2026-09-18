import { describe, expect, it } from 'vitest';
import type { MosaicDbBridge } from '@shared/types/db';
import { DbError, unwrapBridge } from '../mosaicDb';

describe('unwrapBridge', () => {
  it('resolves to the value, passing arguments through', async () => {
    const bridge = {
      templates: {
        rename: async (id: string, name: string) => ({ ok: true, value: `${id}:${name}` }),
      },
    } as unknown as MosaicDbBridge;

    await expect(unwrapBridge(bridge).templates.rename('t1', 'Backend')).resolves.toBe(
      't1:Backend'
    );
  });

  it('rejects with the code main reported', async () => {
    const bridge = {
      drafts: {
        save: async () => ({ ok: false, code: 'stale-rev', message: 'too old' }),
      },
    } as unknown as MosaicDbBridge;

    const failure = unwrapBridge(bridge).drafts.save('t1', {} as never, 1);
    await expect(failure).rejects.toBeInstanceOf(DbError);
    await expect(failure).rejects.toMatchObject({ code: 'stale-rev', message: 'too old' });
  });
});
