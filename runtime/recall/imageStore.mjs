import { memoryEnv } from './env.mjs';
import { getPool, isEnabled as vectorEnabled } from './vectorStore.mjs';

export function isEnabled() {
  return vectorEnabled();
}

function vectorLiteral(vector) {
  return `[${vector.join(',')}]`;
}

export async function searchImageVectors({
  userId,
  storeId,
  domainIds,
  queryVector,
  limit,
  threshold,
}) {
  const cap = Number(limit ?? 4);
  const params = [vectorLiteral(queryVector), userId, storeId ?? ''];
  let where = '"userId" = $2 AND "storeId" = $3';
  if (threshold !== null && threshold !== undefined) {
    params.push(Number(threshold));
    where += ' AND 1 - (embedding <=> $1::vector) >= $4';
  }
  const domains = Array.isArray(domainIds) ? domainIds.map(String).filter(Boolean) : [];
  if (domains.length > 0) {
    params.push(domains);
    where += ` AND "domainId" = ANY($${params.length}::text[])`;
  }
  const client = await getPool().connect();
  try {
    const result = await client.query(
      `SELECT "sha256", "domainId", "updated_at", 1 - (embedding <=> $1::vector) AS score
       FROM image_vectors
       WHERE ${where}
       ORDER BY score DESC
       LIMIT $${params.length + 1}`,
      [...params, cap],
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function upsertImageVector({ userId, storeId, sha256, domainId, vector }) {
  const client = await getPool().connect();
  try {
    await client.query(
      `INSERT INTO image_vectors ("userId", "storeId", "sha256", embedding, "domainId", updated_at)
       VALUES ($1, $2, $3, $4::vector, $5, now())
       ON CONFLICT ("userId", "storeId", "sha256")
       DO UPDATE SET embedding = EXCLUDED.embedding, "domainId" = EXCLUDED."domainId", updated_at = now()`,
      [userId, storeId ?? '', sha256, `[${vector.join(',')}]`, domainId ?? ''],
    );
  } finally {
    client.release();
  }
}

export async function ensureSchema() {}

export async function deleteImageVectorsForPartition({ userId, storeId, domainId }) {
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
    await client.query(`DELETE FROM image_vectors WHERE ${where}`, params);
  } finally {
    client.release();
  }
}

export async function deleteImageVectorsForStore({ userId, storeId }) {
  const client = await getPool().connect();
  try {
    await client.query('DELETE FROM image_vectors WHERE "userId" = $1 AND "storeId" = $2', [
      userId,
      storeId ?? '',
    ]);
  } finally {
    client.release();
  }
}

export default {
  isEnabled,
  ensureSchema,
  searchImageVectors,
  upsertImageVector,
  deleteImageVectorsForStore,
  deleteImageVectorsForPartition,
};
