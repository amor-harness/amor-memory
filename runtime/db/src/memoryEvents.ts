/**
 * In-process memory-change events.
 *
 * The data-schemas layer stays pure (no HTTP, no embeddings), so vector
 * sync / RAG bookkeeping lives in the API layer. Any memory write that lands
 * here emits a lightweight change notification; subscribers (registered once
 * at API startup) handle it fire-and-forget — e.g. re-embedding an edited
 * memory or dropping a deleted one from the vector store.
 */
export type MemoryChangeType = 'set' | 'create' | 'delete' | 'stable';

export interface MemoryChange {
  type: MemoryChangeType;
  /** String form of the owning user id (matches the vector store keying). */
  userId: string;
  /** Memory key the change is about; absent on a `sweep`, which names a scope
   *  rather than one row. */
  key?: string;
  /** Memory store the write targeted; omit/undefined = no store. */
  storeId?: string;
  /** Memory domain the entry belongs to; the vector row is keyed by it. */
  domainId?: string;
  /** Post-write memory value (set/create/stable events). */
  value?: string;
  /** Cue anchors parsed from that value, so the vector store can key off them
   *  without re-parsing. */
  tags?: string[];
  /** Post-write stability flag, when known. */
  stable?: boolean;
  /** Bulk form of a delete: drop every vector row in the change's scope — its
   *  `userId`, plus `storeId`/`domainId` when they are given — instead of the
   *  single row `key` names. The paths that drop a store, a domain, or every
   *  memory a user owns emit one of these rather than replaying a delete per
   *  row, which would cost a round trip per memory. */
  sweep?: boolean;
  /** Scopes a `sweep` to image rows: the images of a user or store are dropped
   *  while its text memories survive. Absent, a sweep covers both indexes. */
  image?: boolean;
}

type MemoryChangeHandler = (change: MemoryChange) => void | Promise<void>;

const handlers = new Set<MemoryChangeHandler>();

/** Registers a change handler; returns an unsubscribe fn. */
export function onMemoryChange(handler: MemoryChangeHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Fires a change to every registered handler without awaiting them, so the
 *  memory write itself never blocks on embedding/vector I/O. Handler errors
 *  are logged and swallowed — memory writes succeed regardless. */
export function emitMemoryChange(change: MemoryChange): void {
  for (const handler of handlers) {
    try {
      const result = handler(change);
      if (result && typeof result.then === 'function') {
        result.catch((error: unknown) => {
          console.error('[memoryEvents] vector sync handler failed', error);
        });
      }
    } catch (error) {
      console.error('[memoryEvents] vector sync handler threw', error);
    }
  }
}
