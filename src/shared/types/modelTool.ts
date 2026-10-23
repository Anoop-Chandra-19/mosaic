/** A tool as a model is offered it. Shared: main sends it, and the renderer runs the tool. */
export interface ModelTool {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  inputSchema: Record<string, unknown>;
}
