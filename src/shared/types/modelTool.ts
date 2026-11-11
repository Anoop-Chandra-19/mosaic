/** A tool definition sent to the model by main; the renderer executes the tool. */
export interface ModelTool {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  inputSchema: Record<string, unknown>;
}

/** What every request of a run carries besides the conversation's messages. */
export interface ModelSetup {
  system: string;
  tools: ModelTool[];
}
