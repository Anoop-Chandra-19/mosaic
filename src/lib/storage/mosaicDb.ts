import type { DbErrorCode, DbResult, MosaicDb, MosaicDbBridge } from '@/types/db';

/** A database call main refused or could not complete; its transaction rolled back. */
export class DbError extends Error {
  readonly code: DbErrorCode;

  constructor(code: DbErrorCode, message: string) {
    super(message);
    this.name = 'DbError';
    this.code = code;
  }
}

function unwrap<T>(result: DbResult<T>): T {
  if (result.ok) return result.value;
  throw new DbError(result.code, result.message);
}

/** Every bridge method, resolving to its value or rejecting with a `DbError`. */
export function unwrapBridge(bridge: MosaicDbBridge): MosaicDb {
  const wrap = (node: object): object =>
    Object.fromEntries(
      Object.entries(node).map(([key, value]) => [
        key,
        typeof value === 'function'
          ? async (...args: unknown[]) => unwrap(await value(...args))
          : wrap(value),
      ])
    );
  return wrap(bridge) as MosaicDb;
}

let db: MosaicDb | undefined;

/** The main-process database, through the preload bridge. */
export function getDb(): MosaicDb {
  return (db ??= unwrapBridge(window.mosaic.db));
}
