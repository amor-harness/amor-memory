import mongoose from 'mongoose';
import { models } from '../db.mjs';
import { readableStore, requirePermission } from './memories.mjs';
import type { MemoryEntryRow, MemoryVersionRow } from './types.mjs';

/** One version as the history panel consumes it. */
interface ClientMemoryVersion {
  id: string;
  key: string;
  value: string;
  tags: string[];
  domainId?: string;
  tokenCount: number;
  stable: boolean;
  injection: 'system' | 'additional';
  locked: boolean;
  createdAt: string;
}

/** A version row whose schema default guarantees a creation timestamp. */
interface SerializableMemoryVersion extends MemoryVersionRow {
  createdAt: Date;
}

const serialiseVersion = (version: SerializableMemoryVersion): ClientMemoryVersion => ({
  id: String(version._id),
  key: version.key,
  value: version.value,
  tags: version.tags ?? [],
  ...(version.domainId != null ? { domainId: String(version.domainId) } : {}),
  tokenCount: version.tokenCount ?? 0,
  stable: version.stable === true,
  injection: version.injection === 'additional' ? 'additional' : 'system',
  locked: version.locked === true,
  createdAt: new Date(version.createdAt).toISOString(),
});

/** One memory's recorded history, newest first. */
export async function listVersions({
  userId,
  role,
  storeId,
  key,
}: {
  userId?: string;
  role?: string;
  storeId?: string;
  key: string;
}): Promise<{ key: string; versions: ClientMemoryVersion[] } | { error: 404 }> {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const access = await readableStore({ userId, storeId });
  if (!access) {
    return { error: 404 };
  }
  const store = access.store;
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(access.ownerId));
  const entry = (await db.MemoryEntry.findOne({
    userId: user,
    storeId: String(store._id),
    key,
  }).lean()) as MemoryEntryRow | null;
  if (!entry) {
    return { error: 404 };
  }
  const rows = (await db.MemoryVersion.find({ userId: user, memoryId: String(entry._id) })
    .sort({ createdAt: -1 })
    .lean()) as SerializableMemoryVersion[];
  return { key, versions: rows.map(serialiseVersion) };
}
