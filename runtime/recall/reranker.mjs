import { memoryEnv } from './env.mjs';
/**
 * HTTP client for the host-side memory reranker (jina-reranker-v3.5, MLX).
 *
 * The model is a listwise reranker on the host's Apple GPU, so it cannot live
 * in the api container; it is reached at MEMORY_RERANK_URL. Enabled when that
 * variable is set. Any failure here is non-fatal: callers fall back to
 * vector-order candidates, so recall never breaks a turn because reranking is
 * unavailable.
 */
import { logger } from '@librechat/data-schemas';
import { transportFor } from './transport.mjs';

const MODEL = memoryEnv('MEMORY_RERANK_MODEL') || 'jina-reranker-v3.5';

function rerankerUrl() {
  return memoryEnv('MEMORY_RERANK_URL') || '';
}

/** Whether the reranker is configured. */
function isEnabled() {
  return rerankerUrl() !== '';
}

/**
 * Scores candidate ephemeral memories against `query`, preserving order. Each
 * returned entry keeps its shape and gains a reranked `score`; ordering by that
 * score is the caller's call, since this primitive maps the service's ranked
 * answer back onto the input's order. Returns the input unchanged on any
 * failure — including an answer that leaves a candidate unscored, which would
 * otherwise mislabel every row after the one the service skipped.
 *
 * The scores are cosines of projected hidden states, so unlike the sigmoid of a
 * pointwise cross-encoder they are signed and are only comparable within one
 * call. That is why the caller's cut is relative to the candidate set's own top
 * score rather than an absolute floor.
 */
async function rerankMemories({ query, entries }) {
  if (!isEnabled() || !Array.isArray(entries) || entries.length <= 1) {
    return entries ?? [];
  }
  /** `rerankText` is the caller's ranking budget for a row: a long memory is
   *  scored on its head instead of its whole value, while the row keeps the
   *  whole value for injection. */
  const texts = entries.map((entry) => entry.rerankText ?? entry.value);
  const timeoutMs = Number(memoryEnv('MEMORY_RERANK_TIMEOUT') ?? 15000);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      const transport = transportFor('MEMORY_RERANK');
      response = await fetch(`${rerankerUrl()}/v1/rerank`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...transport.headers },
        body: JSON.stringify({
          model: MODEL,
          query,
          documents: texts,
          return_documents: false,
        }),
        signal: controller.signal,
        ...(transport.dispatcher ? { dispatcher: transport.dispatcher } : {}),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      throw new Error(`memory-reranker responded ${response.status}`);
    }
    const data = await response.json();
    /** The API answers a ranked list, so `index` is what maps a score back onto
     *  its candidate. A result the service could not score leaves a hole, and
     *  guessing where it belonged would silently shift every later score onto
     *  the wrong memory — the caller keeps the vector order it already has. */
    const scores = new Array(entries.length).fill(undefined);
    for (const result of Array.isArray(data?.results) ? data.results : []) {
      const index = result?.index;
      if (Number.isInteger(index) && index >= 0 && index < entries.length) {
        scores[index] = result.relevance_score;
      }
    }
    if (scores.some((score) => score === undefined)) {
      logger.warn(
        `[memoryRerank] Ignoring incomplete scores (${scores.filter((s) => s !== undefined).length} for ${entries.length} candidates)`,
      );
      return entries;
    }
    return entries.map((entry, index) => ({ ...entry, score: scores[index] }));
  } catch (error) {
    logger.error('[memoryRerank] Failed to rerank candidates', error);
    return entries ?? [];
  }
}

const exported = { isEnabled, rerankMemories };

export default exported;
