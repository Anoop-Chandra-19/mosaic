import { versionLabel } from '@/lib/versionLabel';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { readVersion, readVersionHistory } from '@/stores/templateStore';
import { describeDraftChanges } from '@shared/resume/describeDraftChanges';
import { encodeResumeCanonically } from '@shared/resume/encodeResumeCanonically';
import { formatDateTimeDashed } from '@shared/time/calendar';
import type { ResumeData } from '@shared/types/resume';
import {
  NO_RESUME_OPEN,
  answer,
  refuse,
  type AgentToolRun,
  type ToolAnswer,
} from '../tool-run/agentToolRun';
import { formatResumeForModel } from './formatResumeForModel';

function describeChangesSince(version: ResumeData, draft: ResumeData): string {
  if (encodeResumeCanonically(version) === encodeResumeCanonically(draft)) {
    return 'The draft is the same as this version.';
  }
  const { summary, section } = describeDraftChanges(version, draft);
  return `Since then: ${summary}${section ? ` (in ${section})` : ''}.`;
}

/** The newest version, read but never a receipt: suggestions are made against the draft. */
export async function readNewestVersion(run: AgentToolRun): Promise<ToolAnswer> {
  const { templateId } = useResumeStore.getState();
  if (templateId === null) return refuse(NO_RESUME_OPEN);

  const [newestInHistory] = await readVersionHistory(templateId);
  if (!newestInHistory) return refuse('This resume has no saved versions.');
  const version = await readVersion(newestInHistory.id);

  const quotedName = version.kind === 'named' ? ` "${version.summary}"` : '';
  const savedAt = formatDateTimeDashed(new Date(version.createdAt));
  return answer(
    [
      `Newest version: ${versionLabel(version)}${quotedName}, saved ${savedAt}.`,
      describeChangesSince(version.doc, getResumeSnapshot()),
      '',
      formatResumeForModel(version.doc, run.handles),
    ].join('\n'),
    { kind: 'version', version: versionLabel(version) }
  );
}
