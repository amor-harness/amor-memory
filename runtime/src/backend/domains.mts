import mongoose from 'mongoose';
import { connectAppDb, models } from '../db.mjs';
import { readableStore, requirePermission, writableStore } from './memories.mjs';
import type { AppConversationRow, CountRow, MemoryDomainRow } from './types.mjs';

/** One domain as the panel consumes it. */
interface ClientMemoryDomain {
  id: string;
  name: string;
  kind: string;
  description: string;
  isDefault: boolean;
  createdBy: string;
  memoryCount: number;
  updated_at?: Date;
}

const toClientDomain = (domain: MemoryDomainRow): ClientMemoryDomain => ({
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
export async function listDomains({
  userId,
  role,
  storeId,
  conversationId,
}: {
  userId?: string;
  role?: string;
  storeId?: string;
  conversationId?: string;
}): Promise<
  | {
      storeId: string;
      canWrite: boolean;
      domains: ClientMemoryDomain[];
      activeDomainIds?: string[];
    }
  | { error: 404 }
> {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const access = await readableStore({ userId, storeId });
  if (!access) {
    return { error: 404 };
  }
  const store = access.store;
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(access.ownerId));
  const rows = (await db.MemoryDomain.find({
    storeId: String(store._id),
  }).lean()) as MemoryDomainRow[];
  const counts = (await db.MemoryEntry.aggregate([
    { $match: { userId: user, storeId: String(store._id) } },
    { $group: { _id: '$domainId', n: { $sum: 1 } } },
  ])) as CountRow[];
  const byDomain = new Map(counts.map((row) => [row._id ?? '', row.n ?? 0]));
  let activeDomainIds: string[] | undefined;
  if (typeof conversationId === 'string' && conversationId !== '') {
    const conn = await connectAppDb();
    const convo = (await conn.collection('conversations').findOne({
      conversationId,
      user: String(userId),
    })) as AppConversationRow | null;
    if (convo && Array.isArray(convo.activeDomainIds)) {
      const known = new Set(rows.map((row) => String(row._id)));
      activeDomainIds = convo.activeDomainIds.filter((id): id is string => known.has(String(id)));
    }
  }
  const writable =
    access.isOwner || (await writableStore({ userId, storeId: String(store._id) })) != null;
  return {
    storeId: String(store._id),
    canWrite: writable,
    domains: rows.map((row) =>
      toClientDomain({ ...row, memoryCount: byDomain.get(String(row._id)) ?? 0 }),
    ),
    ...(activeDomainIds ? { activeDomainIds } : {}),
  };
}
