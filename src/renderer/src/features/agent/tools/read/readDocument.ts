import { buildKeptCopy, buildWorkingCopy } from '@/features/suggestions/proposals/workingCopy';
import { useProposalStore } from '@/stores/proposalStore';
import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import {
  NO_RESUME_OPEN,
  answer,
  refuse,
  type AgentToolRun,
  type ToolAnswer,
} from '../tool-run/agentToolRun';
import { formatResumeForModel } from './formatResumeForModel';

const SUGGESTED_NOTE =
  'Parts marked (suggested) are suggestions waiting for the user to keep or drop. A "was:" line under one is the user\'s text.';

/**
 * Return the open resume's working copy: the draft with the waiting and kept suggestions
 * applied. Save it as the run's receipt, so later propose calls are checked against what
 * the model read.
 */
export function readDocument(run: AgentToolRun): ToolAnswer {
  const { templateId } = useResumeStore.getState();
  if (templateId === null) return refuse(NO_RESUME_OPEN);

  const draft = getResumeSnapshot();
  const proposals = useProposalStore.getState().byTemplate[templateId] ?? [];
  const doc = buildWorkingCopy(draft, proposals);
  run.receipt = { templateId, doc };

  const template = useTemplateStore.getState().templates.find(({ id }) => id === templateId);
  const hasWaiting = proposals.some((each) => each.status === 'pending' && !each.isStale);
  const title = `Resume: ${template?.name ?? 'untitled'} (the draft${hasWaiting ? ', with suggestions' : ''})`;
  const resume = formatResumeForModel(doc, run.handles, buildKeptCopy(draft, proposals));
  return answer([title, ...(hasWaiting ? [SUGGESTED_NOTE] : []), '', resume].join('\n'), {
    kind: 'resume',
    sections: [...doc.sections].sort((a, b) => a.order - b.order).map(({ label }) => label),
  });
}
