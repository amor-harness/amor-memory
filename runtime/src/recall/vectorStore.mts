import { memoryEnv } from './env.mjs';
import type { MemoryVectorHit, MemoryVectorPart, MemoryVectorRow, PostgresPool } from './types.mjs';

let pool: PostgresPool | null = null;
let sharedPool: PostgresPool | null = null;
let schemaReady = false;

/** The scope a vector write addresses. */
export interface VectorPartitionParams {
  userId?: string | null;
  storeId?: string | null;
  domainId?: string | null;
}

/** One memory part a vector row is written for. */
export interface VectorUpsertParams extends VectorPartitionParams {
  key: string;
  value: string;
  tags?: string[] | null;
  vector: number[];
}

/** The parts that replace a memory's rows in one transaction. */
export interface VectorReplaceParams extends VectorPartitionParams {
  key: string;
  tags?: string[] | null;
  rows?: MemoryVectorPart[] | null;
}

/** Params of one vector search. */
export interface VectorSearchParams {
  userId?: string | null;
  storeId?: string | null;
  domainIds?: string[] | null;
  queryVector: number[];
  limit?: number | null;
  threshold?: number | null;
}

/** Params of one tag-vector search. */
export interface TagSearchParams {
  userId?: string | null;
  storeId?: string | null;
  domainIds?: string[] | null;
  tags?: string[] | null;
  queryVector?: number[] | null;
  limit?: number | null;
}

/** Reuse a pool owned by the database plugin. The host's `pg` declarations are
 *  ambient and incomplete, so the handle is accepted structurally and typed
 *  here, where the store actually uses it. */
export function configurePool(next: unknown): void {
  sharedPool = (next ?? null) as PostgresPool | null;
  pool = null;
}

export function isEnabled(): boolean {
  return sharedPool != null;
}

export function getPool(): PostgresPool {
  if (sharedPool != null) {
    return sharedPool;
  }
  throw new Error('database plugin Postgres pool is not configured');
}

export async function ensureSchema(): Promise<void> {
  if (schemaReady || !isEnabled()) {
    return;
  }
  schemaReady = true;
}

function partitionOf(storeId: string | null | undefined): string {
  return storeId ?? '';
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value).toFixed(6)).join(',')}]`;
}

const RETURNS_EMBEDDINGS =
  memoryEnv('MEMORY_MMR_ENABLED') === 'true' || memoryEnv('MEMORY_RECALL_SHADOW') === 'true';
const EMBEDDING_PROJECTION = RETURNS_EMBEDDINGS ? ', embedding' : '';

/** The stored embedding column: a pgvector literal, an already-parsed array, or
 *  null when the query did not project it. */
function parseEmbedding(value: unknown): number[] | undefined {
  if (Array.isArray(value)) {
    return value as number[];
  }
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as number[]) : undefined;
  } catch {
    return undefined;
  }
}

/** The row as the pipeline reads it: the embedding column is only selected when
 *  the ranking passes need it, so the absent row is the ordinary one. */
function withEmbedding(row: MemoryVectorRow): MemoryVectorHit {
  return RETURNS_EMBEDDINGS
    ? { ...row, embedding: parseEmbedding(row.embedding) }
    : (row as MemoryVectorHit);
}

function domainFilter(domainIds: string[] | null | undefined): string[] {
  return Array.isArray(domainIds) ? domainIds.map(String).filter(Boolean) : [];
}

export async function searchVectors({
  userId,
  storeId,
  domainIds,
  queryVector,
  limit,
  threshold,
}: VectorSearchParams): Promise<MemoryVectorHit[]> {
  const cap = Number(limit ?? memoryEnv('MEMORY_RAG_LIMIT') ?? 3);
  const params: unknown[] = [vectorLiteral(queryVector), userId, partitionOf(storeId)];
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
    const result = await client.query<MemoryVectorRow>(
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

export async function upsertVector({
  userId,
  storeId,
  domainId,
  key,
  value,
  tags,
  vector,
}: VectorUpsertParams): Promise<void> {
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

export async function deleteVectorsForPartition({
  userId,
  storeId,
  domainId,
}: VectorPartitionParams): Promise<void> {
  const client = await getPool().connect();
  try {
    const params: unknown[] = [userId];
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

export async function replaceMemoryVectors({
  userId,
  storeId,
  domainId,
  key,
  tags,
  rows,
}: VectorReplaceParams): Promise<void> {
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

export async function deleteVector({
  userId,
  storeId,
  key,
}: {
  userId?: string | null;
  storeId?: string | null;
  key: string;
}): Promise<void> {
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

export async function searchByTags({
  userId,
  storeId,
  domainIds,
  tags,
  queryVector,
  limit,
}: TagSearchParams): Promise<MemoryVectorHit[]> {
  if (!Array.isArray(tags) || tags.length === 0) {
    return [];
  }
  const cap = Number(limit ?? memoryEnv('MEMORY_RAG_CANDIDATES') ?? 15);
  const client = await getPool().connect();
  try {
    const params: unknown[] = [userId, partitionOf(storeId), tags];
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
    const result = await client.query<MemoryVectorRow>(
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

export default { ensureSchema, getPool, isEnabled, searchByTags, searchVectors, deleteVector };
