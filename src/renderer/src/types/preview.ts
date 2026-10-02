export interface ResumePreviewMeta {
  /** Pages laid out, which is every page unless the resume runs past the limit. */
  totalPages: number;
  /** The resume runs past `MAX_PREVIEW_PAGES`, so the rest was not laid out. */
  hasMorePages: boolean;
}
