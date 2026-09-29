import { encodeResumeCanonically } from '../resume/encodeResumeCanonically';
import { BUNDLE_VERSION, type MosaicBundle } from '../types/bundle';
import type { ResumeData } from '../types/resume';

const indent = (json: string, depth: number) => json.replaceAll('\n', `\n${'  '.repeat(depth)}`);

/**
 * The bundle as a backup file: indented JSON, yielded a template or a document at a time, so
 * writing a large one never builds it as one string. Each distinct document is written once.
 */
export function* formatBundle(bundle: MosaicBundle): Generator<string> {
  const idsByObject = new WeakMap<ResumeData, string>();
  const idsByText = new Map<string, string>();
  const docs: [string, ResumeData][] = [];
  const docIdOf = (doc: ResumeData) => {
    let id = idsByObject.get(doc);
    if (id) return id;
    const text = encodeResumeCanonically(doc);
    id = idsByText.get(text);
    if (!id) {
      id = `doc-${docs.length + 1}`;
      idsByText.set(text, id);
      docs.push([id, doc]);
    }
    idsByObject.set(doc, id);
    return id;
  };

  yield `{\n  "bundleVersion": ${BUNDLE_VERSION},\n  "exportedAt": ${JSON.stringify(bundle.exportedAt)},\n  "templates": [`;
  for (const [index, entry] of bundle.templates.entries()) {
    const written = {
      template: entry.template,
      draftDocId: docIdOf(entry.draft),
      versions: entry.versions.map(({ doc, ...version }) => ({ ...version, docId: docIdOf(doc) })),
    };
    yield `${index > 0 ? ',' : ''}\n    ${indent(JSON.stringify(written, null, 2), 2)}`;
  }
  yield `${bundle.templates.length > 0 ? '\n  ' : ''}],\n  "docs": {`;
  for (const [index, [id, doc]] of docs.entries()) {
    yield `${index > 0 ? ',' : ''}\n    ${JSON.stringify(id)}: ${indent(JSON.stringify(doc, null, 2), 2)}`;
  }
  yield `${docs.length > 0 ? '\n  ' : ''}}\n}\n`;
}

/** The whole file as one string, for a bundle small enough to hold as one. */
export function formatBundleText(bundle: MosaicBundle): string {
  return [...formatBundle(bundle)].join('');
}
