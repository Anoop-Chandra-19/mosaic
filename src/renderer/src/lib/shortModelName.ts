/**
 * llama.cpp names a model by the path it was loaded from, which says little and wraps badly:
 * the file's name is enough to tell it by. Names like `org/model` aren't paths.
 */
export function shortModelName(model: string): string {
  return /^(\/|[A-Za-z]:\\)/.test(model) ? (model.split(/[\\/]/).at(-1) ?? model) : model;
}
