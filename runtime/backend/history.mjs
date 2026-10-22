import mongoose from 'mongoose';
import { models } from '../db.mjs';
import { ownedStore, requirePermission } from './memories.mjs';

const serialiseVersion = (version) => ({
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
export async function listVersions({ userId, role, storeId, key }) {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const store = await ownedStore({ userId, storeId });
  if (!store) {
    return { error: 404 };
  }
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const entry = await db.MemoryEntry.findOne({ userId: user, storeId: String(store._id), key }).lean();
  if (!entry) {
    return { error: 404 };
  }
  const rows = await db.MemoryVersion.find({ userId: user, memoryId: String(entry._id) })
    .sort({ createdAt: -1 })
    .lean();
  return { key, versions: rows.map(serialiseVersion) };
}
