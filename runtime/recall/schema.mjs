import { memoryEnv } from './env.mjs';

function dimension(name, fallback) {
  const value = Number(memoryEnv(name) ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** Creates the pgvector tables memory needs. Safe to run on every boot. */
export async function ensureMemorySchema(pool) {
  if (pool == null) {
    return;
  }
  const textDim = dimension('MEMORY_EMBED_DIM', 1024);
  const imageDim = dimension('MEMORY_IMAGE_DIM', 1024);

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (error) {
    console.error('[memory] could not ensure the vector extension:', error?.message ?? error);
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS memory_vectors (
      "userId" text NOT NULL,
      "storeId" text NOT NULL DEFAULT '',
      key text NOT NULL,
      section text NOT NULL DEFAULT '',
      embedding vector(${textDim}) NOT NULL,
      value text NOT NULL,
      tags text[] NOT NULL DEFAULT '{}',
      "domainId" text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId", "storeId", key, section)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS image_vectors (
      "userId" text NOT NULL,
      "storeId" text NOT NULL DEFAULT '',
      sha256 text NOT NULL,
      embedding vector(${imageDim}) NOT NULL,
      "domainId" text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId", "storeId", sha256)
    )
  `);
}
