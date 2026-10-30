import { getResumeSnapshot, useResumeStore } from '@/stores/resumeStore';
import { useTemplateStore } from '@/stores/templateStore';
import {
  NO_RESUME_OPEN,
  answer,
  refuse,
  type AgentToolRun,
  type ToolAnswer,
} from '../agentToolRun';
import { formatResumeForModel } from '../formatResumeForModel';

/** The open draft, which becomes the run's receipt: suggestions are made against it. */
export function readDocument(run: AgentToolRun): ToolAnswer {
  const { templateId } = useResumeStore.getState();
  if (templateId === null) return refuse(NO_RESUME_OPEN);

  const doc = getResumeSnapshot();
  run.receipt = { templateId, doc };

  const template = useTemplateStore.getState().templates.find(({ id }) => id === templateId);
  const title = `Resume: ${template?.name ?? 'untitled'} (the draft)`;
  return answer(`${title}\n\n${formatResumeForModel(doc, run.handles)}`, {
    kind: 'resume',
    sections: [...doc.sections].sort((a, b) => a.order - b.order).map(({ label }) => label),
  });
}
