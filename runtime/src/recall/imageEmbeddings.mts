import { memoryEnv } from './env.mjs';
import { transportFor } from './transport.mjs';
import type { EmbeddingTask } from './types.mjs';

const TASKS: Record<EmbeddingTask, string> = {
  query: 'retrieval.query',
  passage: 'retrieval.passage',
};

/** The answer body the embeddings endpoint returns, as far as this client reads it. */
interface EmbeddingBody {
  data?: Array<{ embedding?: number[] }>;
}

function configured(): boolean {
  return (memoryEnv('MEMORY_EMBED_URL') || '') !== '';
}

export function isEnabled(): boolean {
  return memoryEnv('MEMORY_IMAGE_DISABLED') !== 'true' && configured();
}

export async function embedText(text: string): Promise<number[] | null> {
  if (!isEnabled() || !text) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(memoryEnv('MEMORY_IMAGE_TEXT_TIMEOUT_MS') || 15_000),
  );
  try {
    const transport = transportFor('MEMORY_EMBED');
    const response = await fetch(
      `${(memoryEnv('MEMORY_EMBED_URL') || '').replace(/\/$/, '')}/v1/embeddings`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...transport.headers },
        body: JSON.stringify({
          model: memoryEnv('MEMORY_EMBED_MODEL') || 'jina-embeddings-v5-omni-small',
          input: [text],
          task: TASKS.query,
        }),
        signal: controller.signal,
        ...(transport.dispatcher ? { dispatcher: transport.dispatcher } : {}),
      },
    );
    const body = (await response.json().catch(() => null)) as EmbeddingBody | null;
    if (!response.ok) {
      return null;
    }
    return body?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function embedImage(
  buffer: Buffer,
  mimeType: string | undefined,
  kind: EmbeddingTask = 'passage',
): Promise<number[] | null> {
  if (!isEnabled() || !Buffer.isBuffer(buffer)) {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(memoryEnv('MEMORY_IMAGE_TIMEOUT_MS') || 60_000),
  );
  try {
    const transport = transportFor('MEMORY_EMBED');
    const response = await fetch(
      `${(memoryEnv('MEMORY_EMBED_URL') || '').replace(/\/$/, '')}/v1/embeddings`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...transport.headers },
        body: JSON.stringify({
          model: memoryEnv('MEMORY_EMBED_MODEL') || 'jina-embeddings-v5-omni-small',
          input: [{ image: `data:${mimeType || 'image/png'};base64,${buffer.toString('base64')}` }],
          task: TASKS[kind] ?? TASKS.passage,
        }),
        signal: controller.signal,
        ...(transport.dispatcher ? { dispatcher: transport.dispatcher } : {}),
      },
    );
    const body = (await response.json().catch(() => null)) as EmbeddingBody | null;
    if (!response.ok) {
      return null;
    }
    return body?.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default { isEnabled, embedText, embedImage };
