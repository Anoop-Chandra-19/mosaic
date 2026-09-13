import type { MosaicDb } from '@/types/db';

/** "templates.create" for `MosaicDb['templates']['create']`, and so on for every method. */
export type DbMethod = MethodPaths<MosaicDb>;

type MethodPaths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends (...args: never[]) => unknown
    ? `${Prefix}${K}`
    : MethodPaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/**
 * Every `MosaicDb` method, each carried over its own `db:<method>` IPC channel. The
 * preload exposes exactly these and main handles exactly these; a test holds them equal.
 */
export const DB_METHODS = [
  'boot',
  'templates.list',
  'templates.create',
  'templates.rename',
  'templates.duplicate',
  'templates.remove',
  'templates.open',
  'drafts.save',
  'drafts.importInto',
  'versions.list',
  'versions.get',
  'versions.name',
  'versions.restore',
  'settings.set',
  'settings.remove',
] as const satisfies readonly DbMethod[];

export const dbChannel = (method: DbMethod) => `db:${method}`;
