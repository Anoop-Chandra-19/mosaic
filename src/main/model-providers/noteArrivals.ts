import type { ModelRequest } from './modelProvider';

/**
 * A provider's stream, saying each time a piece of it arrives. Many pieces become no event of
 * ours for a while (thinking, a call's arguments), and they still show the model is working.
 */
export async function* noteArrivals<Chunk>(
  chunks: AsyncIterable<Chunk>,
  { onArrival }: Pick<ModelRequest, 'onArrival'>
): AsyncGenerator<Chunk> {
  for await (const chunk of chunks) {
    onArrival?.();
    yield chunk;
  }
}
