import SYSTEM_PROMPT from './prompts/system.md?raw';

export function buildSystemPrompt(openResumeName: string | null): string {
  const open =
    openResumeName === null ? 'No resume is open.' : `The open resume is “${openResumeName}”.`;
  return `${SYSTEM_PROMPT.trim()}\n\n${open}`;
}
