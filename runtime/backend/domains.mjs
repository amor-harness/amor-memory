import mongoose from 'mongoose';
import { connectAppDb, models } from '../db.mjs';
import { ownedStore, requirePermission } from './memories.mjs';

const toClientDomain = (domain) => ({
  id: String(domain._id),
  name: domain.name,
  kind: domain.kind,
  description: domain.description ?? '',
  isDefault: domain.isDefault === true,
  createdBy: domain.createdBy ?? 'user',
  memoryCount: domain.memoryCount ?? 0,
  updated_at: domain.updated_at,
});

/** A store's domains plus the active set of a conversation, when named. */
export async function listDomains({ userId, role, storeId, conversationId }) {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const store = await ownedStore({ userId, storeId });
  if (!store) {
    return { error: 404 };
  }
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const rows = await db.MemoryDomain.find({ storeId: String(store._id) }).lean();
  const counts = await db.MemoryEntry.aggregate([
    { $match: { userId: user, storeId: String(store._id) } },
    { $group: { _id: '$domainId', n: { $sum: 1 } } },
  ]);
  const byDomain = new Map(counts.map((row) => [row._id ?? '', row.n]));
  let activeDomainIds;
  if (typeof conversationId === 'string' && conversationId !== '') {
    const conn = await connectAppDb();
    const convo = await conn
      .collection('conversations')
      .findOne({ conversationId, user: String(userId) });
    if (convo && Array.isArray(convo.activeDomainIds)) {
      const known = new Set(rows.map((row) => String(row._id)));
      activeDomainIds = convo.activeDomainIds.filter((id) => known.has(String(id)));
    }
  }
  return {
    storeId: String(store._id),
    canWrite: true,
    domains: rows.map((row) =>
      toClientDomain({ ...row, memoryCount: byDomain.get(String(row._id)) ?? 0 }),
    ),
    ...(activeDomainIds ? { activeDomainIds } : {}),
  };
}
