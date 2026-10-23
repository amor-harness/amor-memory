/**
 * Wires data-schemas memory-change events to the pgvector store AND surfaces
 * them to the open UI through the user's SSE memory stream (so the memory
 * side panel stays current without a manual refresh).
 *
 * Stable memories ride the cacheable stable system baseline and are excluded
 * from the vector store; only ephemeral memories are embedded for single-turn
 * RAG recall. A memory written as a `##` document is embedded one section at a
 * time so recall can inject just the matching part. All writes happen
 * fire-and-forget off the memory-change events, so a slow embed never blocks
 * the memory write itself.
 */
import { createRequire } from 'node:module';
import * as embeddings from '../recall/embeddings.mjs';
import imageStore from '../recall/imageStore.mjs';
import * as vectorStore from '../recall/vectorStore.mjs';
import {
  onMemoryChange,
  parseTrailingTags,
  memoryVectorText,
  splitMemorySections,
} from '../db/methods.mjs';

const require = createRequire(import.meta.url);
const { logger } = require('@amor-harness/data-schemas');
const { emitMemoryUpdatedEvent } = require('@amor-harness/api');

/**
 * A vector row that outlives the row it was written for is injected as content
 * the user already deleted — text recall reads the row's own value, and image
 * recall only filters later — so a dropped delete is worth retrying. The
 * failures here are transient by nature (a pool exhaustion, a database
 * restart); a row that survives all attempts is left to the recall-time check,
 * which refuses it and reclaims it.
 */
const VECTOR_DELETE_ATTEMPTS = 3;
const VECTOR_DELETE_RETRY_MS = 250;

/** The memory-change event the db layer emits to vector-sync handlers. */
interface MemoryChangeEvent {
  type: 'create' | 'set' | 'delete' | 'stable';
  userId?: string;
  key?: string;
  storeId?: string;
  domainId?: string;
  value?: string;
  tags?: string[];
  stable?: boolean;
  sweep?: boolean;
  image?: boolean;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs one vector-store drop — a single row or a whole partition — retrying
 *  the transient failures that would otherwise leave rows behind. Resolves
 *  either way: the caller is a fire-and-forget handler, and a final failure is
 *  reported, not thrown. */
async function dropVectorRow(drop: () => Promise<void>): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await drop();
      return;
    } catch (error) {
      if (attempt >= VECTOR_DELETE_ATTEMPTS) {
        logger.error('[memoryVectorSync] Failed to drop a memory vector', error);
        return;
      }
      await delay(VECTOR_DELETE_RETRY_MS * attempt);
    }
  }
}

async function handleMemoryChange(change: MemoryChangeEvent): Promise<void> {
  /** Any write (create/set/delete/stable) refreshes the memory list in the
   *  open UI. Empty payload: no conversation context here, so the client only
   *  re-fetches its memories and never disturbs in-flight message streams. */
  try {
    if (change?.userId) {
      emitMemoryUpdatedEvent(String(change.userId), {});
    }
  } catch (error) {
    logger.error('[memoryVectorSync] Failed to emit memory update event', error);
  }
  const { type, userId, key, storeId, domainId, value, tags, stable, sweep, image } = change ?? {};

  /** A sweep names a scope instead of a row — a dropped store, domain, or every
   *  memory a user owns — so the indexes are cleared for it in one statement
   *  each rather than one delete per row. An image-scoped sweep is the image
   *  half alone: dropping a user's pictures is not dropping their memories. */
  if (sweep === true) {
    try {
      if (image !== true && vectorStore.isEnabled()) {
        await vectorStore.ensureSchema();
        await dropVectorRow(() =>
          vectorStore.deleteVectorsForPartition({ userId, storeId, domainId }),
        );
      }
      if (imageStore.isEnabled()) {
        await imageStore.ensureSchema();
        await dropVectorRow(() =>
          imageStore.deleteImageVectorsForPartition({ userId, storeId, domainId }),
        );
      }
    } catch (error) {
      logger.error('[memoryVectorSync] Failed to clear a vector partition', error);
    }
    return;
  }
  /** Only a sweep names a scope instead of a row, and it returns above. */
  if (key == null) {
    return;
  }
  if (!vectorStore.isEnabled()) {
    return;
  }
  try {
    await vectorStore.ensureSchema();
    /** Anything that ends up stable (or an edit that flags it stable) leaves
     *  the vector store — it is now covered by the stable system baseline. */
    const isStable = stable === true;
    if (type === 'delete' || isStable) {
      /** A delete needs no embedding, only the store: gating it on the embedding
       *  service would leave the row behind exactly when that service is the part
       *  that is down. */
      await dropVectorRow(() => vectorStore.deleteVector({ userId, storeId, key }));
      return;
    }
    if (!embeddings.isEnabled()) {
      return;
    }
    if (type === 'set' || type === 'create' || type === 'stable') {
      if (!value) {
        return;
      }
      /** The event carries the tags the write path materialized; a value that
       *  reached the store by another route is parsed here so the vector row
       *  never disagrees with the memory document. */
      const memoryTags = tags ?? parseTrailingTags(value).tags;
      /** A memory written as a `##` document is embedded one section at a time,
       *  so recall can inject just the part a turn matched instead of a whole
       *  document the embedding window would have truncated. The first section
       *  carries the document lead; later sections are embedded without it, and
       *  recall joins the lead back on when it renders them. The key's rows are
       *  replaced, not upserted: an edit that drops a section has to drop its
       *  row too. */
      const sectioned = splitMemorySections(value);
      if (sectioned == null) {
        /** The row keeps the stored value verbatim; only the embedding is built
         *  from content plus canonical tags, so a tag the memory gained or lost
         *  is reflected in the vector without rewriting what the user wrote. */
        const vector = await embeddings.embedText(
          memoryVectorText({ value, tags: memoryTags }),
          'passage',
        );
        await vectorStore.upsertVector({
          userId,
          storeId,
          domainId,
          key,
          value,
          vector,
          tags: memoryTags,
        });
        return;
      }
      const rows = [];
      for (const section of sectioned.sections) {
        const vector = await embeddings.embedText(
          memoryVectorText({ value: section.text, tags: memoryTags }),
          'passage',
        );
        rows.push({ section: section.id, value: section.text, vector });
      }
      await vectorStore.replaceMemoryVectors({
        userId,
        storeId,
        domainId,
        key,
        tags: memoryTags,
        rows,
      });
    }
  } catch (error) {
    logger.error('[memoryVectorSync] Failed to sync memory vector', error);
  }
}

let registered = false;

/** Registers the memory-change → vector-store bridge once at startup. */
function registerMemoryVectorSync() {
  if (registered) {
    return;
  }
  onMemoryChange(handleMemoryChange);
  registered = true;
}

export { registerMemoryVectorSync, handleMemoryChange };
