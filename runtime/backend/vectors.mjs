import { Pool } from 'pg';
import { memoryEnv } from './config.mjs';
import { embeddingsEnabled, embedText } from './embed.mjs';

let pool = null;

function getPool() {
  if (pool == null) {
    pool = new Pool({
      host: memoryEnv('MEMORY_PG_HOST') || 'vectordb',
      port: Number(memoryEnv('MEMORY_PG_PORT') || 5432),
      database: memoryEnv('MEMORY_PG_DB') || '',
      user: memoryEnv('MEMORY_PG_USER') || '',
      password: memoryEnv('MEMORY_PG_PASSWORD') || '',
      max: 3,
    });
  }
  return pool;
}

export function vectorsEnabled() {
  return Boolean(memoryEnv('MEMORY_PG_HOST')) && embeddingsEnabled();
}

function literal(vector) {
  return `[${vector.map((value) => Number(value).toFixed(6)).join(',')}]`;
}

export async function upsertVector({ userId, storeId, domainId, key, value, tags, vector }) {
  const client = await getPool().connect();
  try {
    await client.query(
      `INSERT INTO memory_vectors ("userId", "storeId", "key", section, embedding, value, tags, "domainId", updated_at)
       VALUES ($1, $2, $3, '', $4::vector, $5, $6::text[], $7, now())
       ON CONFLICT ("userId", "storeId", "key", section)
       DO UPDATE SET embedding = EXCLUDED.embedding, value = EXCLUDED.value,
                     tags = EXCLUDED.tags, "domainId" = EXCLUDED."domainId", updated_at = now()`,
      [userId, storeId ?? '', key, literal(vector), value, tags ?? [], domainId ?? ''],
    );
  } finally {
    client.release();
  }
}

export async function queryVectors({ userId, storeId, domainIds, vector, limit = 15 }) {
  const client = await getPool().connect();
  try {
    const domains = Array.isArray(domainIds) && domainIds.length > 0 ? domainIds : null;
    const result = await client.query(
      `SELECT key, section, value, tags, "domainId",
              1 - (embedding <=> $1::vector) AS score
       FROM memory_vectors
       WHERE "userId" = $2 AND "storeId" = $3
         AND ($4::text[] IS NULL OR "domainId" = ANY($4))
       ORDER BY embedding <=> $1::vector
       LIMIT $5`,
      [literal(vector), userId, storeId ?? '', domains, limit],
    );
    return result.rows.map((row) => ({
      key: row.key,
      section: row.section,
      value: row.value,
      tags: row.tags ?? [],
      domainId: row.domainId || undefined,
      score: Number(row.score),
    }));
  } finally {
    client.release();
  }
}

export async function deleteVector({ userId, storeId, key }) {
  const client = await getPool().connect();
  try {
    await client.query(
      `DELETE FROM memory_vectors WHERE "userId" = $1 AND "storeId" = $2 AND "key" = $3`,
      [userId, storeId ?? '', key],
    );
  } finally {
    client.release();
  }
}

export async function deleteVectorsForStore({ userId, storeId }) {
  const client = await getPool().connect();
  try {
    await client.query(
      `DELETE FROM memory_vectors WHERE "userId" = $1 AND "storeId" = $2`,
      [userId, storeId ?? ''],
    );
  } finally {
    client.release();
  }
}

/** Re-embeds one memory as a passage and stores its vector; best effort. */
export async function syncEntryVector(entry) {
  if (!vectorsEnabled() || entry.stable === true) {
    return;
  }
  try {
    const vector = await embedText(entry.value, 'passage');
    await upsertVector({
      userId: String(entry.userId),
      storeId: entry.storeId,
      domainId: entry.domainId,
      key: entry.key,
      value: entry.value,
      tags: entry.tags ?? [],
      vector,
    });
  } catch (error) {
    console.error('[memory-plugin] vector sync failed:', error.message);
  }
}

export async function dropEntryVector(entry) {
  if (!vectorsEnabled()) {
    return;
  }
  try {
    await deleteVector({ userId: String(entry.userId), storeId: entry.storeId, key: entry.key });
  } catch (error) {
    console.error('[memory-plugin] vector delete failed:', error.message);
  }
}
