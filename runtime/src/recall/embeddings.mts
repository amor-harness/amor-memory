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
  detail?: string;
}

function baseUrl(): string {
  return (memoryEnv('MEMORY_EMBED_URL') || '').replace(/\/$/, '');
}

export function isEnabled(): boolean {
  return baseUrl() !== '';
}

export async function embedText(text: string, kind: EmbeddingTask = 'passage'): Promise<number[]> {
  if (!isEnabled()) {
    throw new Error('MEMORY_EMBED_URL is not configured');
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(memoryEnv('MEMORY_EMBED_TIMEOUT_MS') || 30_000),
  );
  try {
    const transport = transportFor('MEMORY_EMBED');
    const response = await fetch(`${baseUrl()}/v1/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...transport.headers },
      body: JSON.stringify({
        model: memoryEnv('MEMORY_EMBED_MODEL') || 'jina-embeddings-v5-omni-small',
        input: [text],
        task: TASKS[kind] ?? TASKS.passage,
      }),
      signal: controller.signal,
      ...(transport.dispatcher ? { dispatcher: transport.dispatcher } : {}),
    });
    const body = (await response.json().catch(() => null)) as EmbeddingBody | null;
    if (!response.ok) {
      throw new Error(`memory embedding failed: ${body?.detail ?? `HTTP ${response.status}`}`);
    }
    const embedding = body?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('memory embedding returned no vector');
    }
    return embedding;
  } finally {
    clearTimeout(timer);
  }
}

export default { embedText, isEnabled };
