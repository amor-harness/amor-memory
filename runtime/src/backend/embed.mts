import { memoryEnv } from './config.mjs';

export type EmbeddingKind = 'query' | 'passage';

/** One Jina-shaped embedding response from the host-side MLX service. */
interface EmbeddingResponse {
  detail?: string;
  data?: Array<{ embedding?: number[] }>;
}

const TASKS: Record<EmbeddingKind, string> = {
  query: 'retrieval.query',
  passage: 'retrieval.passage',
};

function baseUrl(): string {
  return (memoryEnv('MEMORY_EMBED_URL') || '').replace(/\/$/, '');
}

export function embeddingsEnabled(): boolean {
  return baseUrl() !== '';
}

/** One text embedding from the host-side MLX service (Jina shape). */
export async function embedText(text: string, kind: EmbeddingKind = 'passage'): Promise<number[]> {
  if (!embeddingsEnabled()) {
    throw new Error('MEMORY_EMBED_URL is not configured');
  }
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number(memoryEnv('MEMORY_EMBED_TIMEOUT_MS') || 30_000),
  );
  try {
    const response = await fetch(`${baseUrl()}/v1/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: memoryEnv('MEMORY_EMBED_MODEL') || 'jina-embeddings-v5-omni-small',
        input: [text],
        task: TASKS[kind] ?? TASKS.passage,
      }),
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => null)) as EmbeddingResponse | null;
    if (!response.ok) {
      throw new Error(`embedding failed: ${body?.detail ?? `HTTP ${response.status}`}`);
    }
    const embedding = body?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('embedding returned no vector');
    }
    return embedding;
  } finally {
    clearTimeout(timer);
  }
}
