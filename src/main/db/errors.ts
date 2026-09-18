export type StorageErrorCode =
  | 'not-found' // no template or version with that id
  | 'stale-rev'; // a draft save older than what is stored (e.g. from before a restore)

/** An expected refusal the UI can explain, as opposed to a bug or a disk failure. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}
