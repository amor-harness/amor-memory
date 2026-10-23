import mongoose from 'mongoose';
import { models } from '../db.mjs';
import type { CountRow, MemoryStoreRow } from './types.mjs';

export interface BackendInfo {
  engine: 'plugin';
  stores: Array<{ id: string; name: string; isDefault: boolean }>;
  entries: number;
  versions: number;
  domains: number;
  counts: Record<string, number | undefined>;
}

/** Read-only inventory from the plugin's own connection: stores, per-store
 *  counts and version rows. Used to prove the backend's data layer lives in
 *  the plugin before the RPC surface is switched over. */
export async function backendInfo({ userId }: { userId?: string }): Promise<BackendInfo> {
  if (!userId) {
    throw Object.assign(new Error('backend.info requires a user'), { status: 401 });
  }
  const id = new mongoose.Types.ObjectId(String(userId));
  const db = await models();
  const [stores, counts, versions, entries, domains] = await Promise.all([
    db.MemoryStore.find({ userId: id }).select('name isDefault').lean() as Promise<
      MemoryStoreRow[]
    >,
    db.MemoryEntry.aggregate([
      { $match: { userId: id } },
      { $group: { _id: '$storeId', n: { $sum: 1 } } },
    ]) as Promise<CountRow[]>,
    db.MemoryVersion.countDocuments({ userId: id }),
    db.MemoryEntry.countDocuments({ userId: id }),
    db.MemoryDomain.countDocuments({ userId: id }),
  ]);
  return {
    engine: 'plugin',
    stores: stores.map((store) => ({
      id: String(store._id),
      name: store.name,
      isDefault: store.isDefault === true,
    })),
    entries,
    versions,
    domains,
    counts: Object.fromEntries(counts.map((row) => [row._id ?? '', row.n])),
  };
}
