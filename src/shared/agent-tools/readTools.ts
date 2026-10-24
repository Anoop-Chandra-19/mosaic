import type { ModelTool } from '../types/modelTool';
import { defineAgentTool } from './defineAgentTool.ts';

/** The tools that read, and their arguments once checked. */
export interface ReadToolArgs {
  read_document: Record<string, never>;
  read_newest_version: Record<string, never>;
}

export const READ_TOOLS: Record<keyof ReadToolArgs, ModelTool> = {
  read_document: defineAgentTool(
    'read_document',
    'Read the open resume: its sections, their entries and bullets, and the lines of sections like Summary or Skills, each with a handle (s1, e2, b7, l3) that the propose tools take. Read it before proposing, and again when a tool says the text changed. Bullets and lines marked (hidden) are kept but left off the page.'
  ),
  read_newest_version: defineAgentTool(
    'read_newest_version',
    'Read the newest saved version of the resume, with its name if it has one and what the draft has changed since. For questions like "what changed since I sent it". Its handles are the same as read_document\'s.'
  ),
};
