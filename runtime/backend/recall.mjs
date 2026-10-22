import mongoose from 'mongoose';
import { models } from '../db.mjs';
import { memoryEnv } from './config.mjs';
import { embeddingsEnabled, embedText } from './embed.mjs';
import { queryVectors, vectorsEnabled } from './vectors.mjs';
import { stripTags, tagsOf } from './memories.mjs';

const candidates = () => Number(memoryEnv('MEMORY_RAG_CANDIDATES') || 15);
const minScore = () => Number(memoryEnv('MEMORY_RAG_MIN_SCORE') || 0.7);
const limit = () => Number(memoryEnv('MEMORY_RAG_LIMIT') || 3);

/** Vector stage of recall, read from the plugin's own pgvector rows. This is
 *  the candidate set the ranking/lexical stages will consume once ported. */
export async function recallVectorStage({ userId, storeId, domainIds, query }) {
  if (!embeddingsEnabled() || !vectorsEnabled()) {
    throw Object.assign(new Error('Memory recall is not configured.'), { status: 400 });
  }
  const vector = await embedText(query, 'query');
  const rows = await queryVectors({
    userId: String(userId),
    storeId,
    domainIds,
    vector,
    limit: Math.max(candidates(), 1),
  });
  const scored = rows.filter((row) => row.score >= minScore());
  const keys = [...new Set(scored.map((row) => row.key))];
  if (keys.length === 0) {
    return { keys: [], entries: [], scores: {} };
  }
  const db = await models();
  const entries = await db.MemoryEntry.find({
    userId: new mongoose.Types.ObjectId(String(userId)),
    storeId,
    key: { $in: keys },
  }).lean();
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const scoreOf = new Map();
  for (const row of scored) {
    if (!scoreOf.has(row.key)) {
      scoreOf.set(row.key, row.score);
    }
  }
  const ordered = keys
    .map((key) => byKey.get(key))
    .filter((entry) => entry != null && entry.stable !== true)
    .slice(0, Math.max(limit(), 1));
  return {
    keys: ordered.map((entry) => entry.key),
    scores: Object.fromEntries(ordered.map((entry) => [entry.key, scoreOf.get(entry.key) ?? 0])),
    entries: ordered.map((entry) => ({
      key: entry.key,
      value: entry.value,
      content: stripTags(entry.value),
      tags: tagsOf(entry),
      domainId: entry.domainId,
      stable: entry.stable === true,
      tokenCount: entry.tokenCount,
      updated_at: entry.updated_at,
    })),
  };
}
