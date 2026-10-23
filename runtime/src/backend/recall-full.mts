import mongoose from 'mongoose';
import { models } from '../db.mjs';
import { readableStore } from './memories.mjs';
import recall from '../recall/recall.mjs';
import type { MemoryDomainRow, MemoryEntryRow, TagCountRow } from './types.mjs';
import type { MemoryDocumentRow } from '../recall/types.mjs';

/** The merged recall result the host hook consumes, as the recall module types it. */
export type PreparedPluginRecall = Awaited<ReturnType<typeof recall.prepareRecalledMemories>>;

function entryOf(doc: MemoryEntryRow): MemoryDocumentRow {
  return {
    ...doc,
    updated_at: doc.updated_at instanceof Date ? doc.updated_at.toISOString() : doc.updated_at,
  };
}

interface ScopedEntryFilter {
  userId: mongoose.Types.ObjectId;
  storeId: string;
  domainId?: { $in: string[] };
}

/** Full text recall (vector + tags + lexical + rerank) on the plugin's own
 *  data. Returns null for a store the caller doesn't own, so the caller can
 *  fall back to the app for shared stores. */
export async function preparePluginRecall({
  userId,
  storeId,
  domainIds,
  query,
  contextQuery,
  timezone,
  excludeKeys,
  contextMemoryKeys,
  collectDiagnostics = false,
}: {
  userId?: string;
  storeId?: string;
  domainIds?: string[];
  query: string;
  contextQuery?: string;
  timezone?: string;
  excludeKeys?: Set<string>;
  contextMemoryKeys?: Set<string>;
  collectDiagnostics?: boolean;
}): Promise<PreparedPluginRecall | null> {
  const access = await readableStore({ userId, storeId });
  if (!access) {
    return null;
  }
  const { store, ownerId } = access;
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(ownerId));
  const resolvedStoreId = String(store._id);
  const domains = (await db.MemoryDomain.find({
    storeId: resolvedStoreId,
  }).lean()) as MemoryDomainRow[];
  const labels = new Map(domains.map((domain) => [String(domain._id), domain.name]));
  const scoped: ScopedEntryFilter = {
    userId: user,
    storeId: resolvedStoreId,
    ...(Array.isArray(domainIds) && domainIds.length > 0
      ? { domainId: { $in: domainIds.map(String) } }
      : {}),
  };
  return recall.prepareRecalledMemories({
    userId: ownerId,
    storeId: resolvedStoreId,
    domainIds,
    domainLabelOf: (domainId: string | null | undefined) => labels.get(String(domainId)) ?? '',
    timezone,
    query,
    contextQuery,
    excludeKeys,
    contextMemoryKeys,
    includeImageData: false,
    collectDiagnostics,
    loadEntriesByKeys: async (keys: string[]) => {
      const rows = (await db.MemoryEntry.find({
        ...scoped,
        key: { $in: keys },
      }).lean()) as MemoryEntryRow[];
      return rows.map(entryOf);
    },
    loadTagVocabulary: async ({ limit }: { limit?: number }) => {
      const rows = (await db.MemoryEntry.aggregate([
        { $match: { ...scoped, tags: { $exists: true, $ne: [] } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        ...(typeof limit === 'number' ? [{ $limit: limit }] : []),
      ])) as TagCountRow[];
      return rows.map((row) => ({
        tag: row._id,
        count: row.count,
        promoted: row.count >= 2,
      }));
    },
    loadMemoryDocuments: async () => {
      const rows = (await db.MemoryEntry.find(scoped).lean()) as MemoryEntryRow[];
      return rows.map(entryOf);
    },
  });
}
