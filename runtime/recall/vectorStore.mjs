import { Pool } from 'pg';
import { memoryEnv } from './env.mjs';

let pool = null;
let sharedPool = null;
let schemaReady = false;

/** Reuse a pool owned by the database plugin. */
export function configurePool(next) {
  sharedPool = next ?? null;
  pool = null;
}

export function isEnabled() {
  return memoryEnv('MEMORY_PG_HOST') !== undefined && memoryEnv('MEMORY_PG_HOST') !== '';
}

export function getPool() {
  if (sharedPool != null) {
    return sharedPool;
  }
  if (pool == null) {
    pool = new Pool({
      host: memoryEnv('MEMORY_PG_HOST') || 'vectordb',
      port: Number(memoryEnv('MEMORY_PG_PORT') || 5432),
      database: memoryEnv('MEMORY_PG_DB') || '',
      user: memoryEnv('MEMORY_PG_USER') || '',
      password: memoryEnv('MEMORY_PG_PASSWORD') || '',
      max: 4,
    });
  }
  return pool;
}

export async function ensureSchema() {
  if (schemaReady || !isEnabled()) {
    return;
  }
  schemaReady = true;
}

function partitionOf(storeId) {
  return storeId ?? '';
}

function vectorLiteral(vector) {
  return `[${vector.map((value) => Number(value).toFixed(6)).join(',')}]`;
}

const RETURNS_EMBEDDINGS =
  memoryEnv('MEMORY_MMR_ENABLED') === 'true' || memoryEnv('MEMORY_RECALL_SHADOW') === 'true';
const EMBEDDING_PROJECTION = RETURNS_EMBEDDINGS ? ', embedding' : '';

function parseEmbedding(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function withEmbedding(row) {
  return RETURNS_EMBEDDINGS ? { ...row, embedding: parseEmbedding(row.embedding) } : row;
}

function domainFilter(domainIds) {
  return Array.isArray(domainIds) ? domainIds.map(String).filter(Boolean) : [];
}

export async function searchVectors({ userId, storeId, domainIds, queryVector, limit, threshold }) {
  const cap = Number(limit ?? memoryEnv('MEMORY_RAG_LIMIT') ?? 3);
  const params = [vectorLiteral(queryVector), userId, partitionOf(storeId)];
  let where = '"userId" = $2 AND "storeId" = $3';
  if (threshold !== null && threshold !== undefined) {
    const minScore = Number(threshold ?? memoryEnv('MEMORY_RAG_MIN_SCORE') ?? 0.55);
    where += ' AND 1 - (embedding <=> $1::vector) >= $4';
    params.push(minScore);
  }
  const domains = domainFilter(domainIds);
  if (domains.length > 0) {
    params.push(domains);
    where += ` AND "domainId" = ANY($${params.length}::text[])`;
  }
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT "key", value, tags, "domainId", section, "updated_at"${EMBEDDING_PROJECTION}, 1 - (embedding <=> $1::vector) AS score
       FROM memory_vectors
       WHERE ${where}
       ORDER BY score DESC
       LIMIT $${params.length + 1}`,
      [...params, cap],
    );
    return result.rows.map(withEmbedding);
  } finally {
    client.release();
  }
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
      [
        userId,
        storeId ?? '',
        key,
        `[${vector.map((entry) => Number(entry).toFixed(6)).join(',')}]`,
        value,
        tags ?? [],
        domainId ?? '',
      ],
    );
  } finally {
    client.release();
  }
}

export async function deleteVectorsForPartition({ userId, storeId, domainId }) {
  const client = await getPool().connect();
  try {
    const params = [userId];
    let where = '"userId" = $1';
    if (storeId != null) {
      params.push(storeId);
      where += ` AND "storeId" = $${params.length}`;
    }
    if (domainId != null) {
      params.push(domainId);
      where += ` AND "domainId" = $${params.length}`;
    }
    await client.query(`DELETE FROM memory_vectors WHERE ${where}`, params);
  } finally {
    client.release();
  }
}

export async function replaceMemoryVectors({ userId, storeId, domainId, key, tags, rows }) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM memory_vectors WHERE "userId" = $1 AND "storeId" = $2 AND "key" = $3',
      [userId, storeId ?? '', key],
    );
    for (const row of rows ?? []) {
      await client.query(
        `INSERT INTO memory_vectors ("userId", "storeId", "key", section, embedding, value, tags, "domainId", updated_at)
         VALUES ($1, $2, $3, $4, $5::vector, $6, $7::text[], $8, now())`,
        [
          userId,
          storeId ?? '',
          key,
          row.section ?? '',
          `[${row.vector.map((value) => Number(value).toFixed(6)).join(',')}]`,
          row.value,
          tags ?? [],
          domainId ?? '',
        ],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteVector({ userId, storeId, key }) {
  const client = await getPool().connect();
  try {
    await client.query(
      'DELETE FROM memory_vectors WHERE "userId" = $1 AND "storeId" = $2 AND "key" = $3',
      [userId, storeId ?? '', key],
    );
  } finally {
    client.release();
  }
}

export async function searchByTags({ userId, storeId, domainIds, tags, queryVector, limit }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return [];
  }
  const cap = Number(limit ?? memoryEnv('MEMORY_RAG_CANDIDATES') ?? 15);
  const client = await getPool().connect();
  try {
    const params = [userId, partitionOf(storeId), tags];
    let projection = 'NULL::float8 AS score';
    if (queryVector != null) {
      params.push(vectorLiteral(queryVector));
      projection = '1 - (embedding <=> $4::vector) AS score';
    }
    let where = '"userId" = $1 AND "storeId" = $2 AND tags && $3::text[]';
    const domains = domainFilter(domainIds);
    if (domains.length > 0) {
      params.push(domains);
      where += ` AND "domainId" = ANY($${params.length}::text[])`;
    }
    const result = await client.query(
      `SELECT "key", value, tags, "domainId", section, "updated_at"${EMBEDDING_PROJECTION}, ${projection}
       FROM memory_vectors
       WHERE ${where}
       LIMIT $${params.length + 1}`,
      [...params, cap],
    );
    return result.rows.map((row) => ({ ...withEmbedding(row), tagMatch: true }));
  } finally {
    client.release();
  }
}

export default { ensureSchema, getPool, isEnabled, searchByTags, searchVectors };
