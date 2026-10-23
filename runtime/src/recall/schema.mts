import { memoryEnv } from './env.mjs';

/** The only part of a Postgres pool the schema bootstrap uses. */
export interface SchemaPool {
  query(sql: string): Promise<unknown>;
}

function dimension(name: string, fallback: number): number {
  const value = Number(memoryEnv(name) ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** The `message` a thrown value carries, or the value itself when it has none. */
function loggedError(error: unknown): unknown {
  if (error != null && typeof error === 'object' && 'message' in error) {
    return (error as { message?: unknown }).message ?? error;
  }
  return error;
}

/** Creates the pgvector tables memory needs. Safe to run on every boot. */
export async function ensureMemorySchema(pool: SchemaPool | null | undefined): Promise<void> {
  if (pool == null) {
    return;
  }
  const textDim = dimension('MEMORY_EMBED_DIM', 1024);
  const imageDim = dimension('MEMORY_IMAGE_DIM', 1024);

  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (error) {
    console.error('[memory] could not ensure the vector extension:', loggedError(error));
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
