import mongoose from 'mongoose';
import { models, connectAppDb } from '../db.mjs';

const PERMISSION_KEYS = ['USE', 'CREATE', 'UPDATE', 'READ', 'OPT_OUT', 'SHARE'];

/** The role's memory permission bits, read from the app's roles collection. */
export async function roleMemoryPermissions({ role }) {
  if (!role) {
    return null;
  }
  const conn = await connectAppDb();
  const doc = await conn.collection('roles').findOne({ name: String(role) });
  if (!doc) {
    return null;
  }
  return doc.permissions?.MEMORIES ?? doc.MEMORIES ?? {};
}

export async function requirePermission({ userId, role, permissions = ['USE'] }) {
  if (!userId) {
    throw Object.assign(new Error('AUTH_REQUIRED'), { status: 401 });
  }
  const bits = await roleMemoryPermissions({ role });
  if (!bits) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  for (const permission of permissions) {
    if (bits[permission] !== true) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }
  }
}

export function stripTags(value) {
  return String(value ?? '')
    .split('\n')
    .filter((line) => !/^tags:\s*/.test(line.trim()))
    .join('\n')
    .trimEnd();
}

export function tagsOf(entry) {
  if (Array.isArray(entry.tags) && entry.tags.length > 0) {
    return entry.tags;
  }
  const line = String(entry.value ?? '')
    .split('\n')
    .reverse()
    .find((candidate) => /^tags:\s*/.test(candidate.trim()));
  if (!line) {
    return [];
  }
  return line
    .replace(/^tags:\s*/, '')
    .split('|')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function ownedStore({ userId, storeId }) {
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  if (storeId) {
    return db.MemoryStore.findOne({ _id: storeId, userId: user }).lean();
  }
  return (
    (await db.MemoryStore.findOne({ userId: user, isDefault: true }).lean()) ??
    (await db.MemoryStore.findOne({ userId: user }).sort({ created_at: 1 }).lean())
  );
}

/** One store's entries, shaped like the memory list RPC returns. */
export async function listOwnedMemories({ userId, role, storeId }) {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const store = await ownedStore({ userId, storeId });
  if (!store) {
    return { error: 404 };
  }
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const rows = await db.MemoryEntry.find({ userId: user, storeId: String(store._id) })
    .sort({ updated_at: -1 })
    .lean();
  let totalTokens = 0;
  const memories = rows.map((entry) => {
    totalTokens += entry.tokenCount ?? 0;
    const tags = tagsOf(entry);
    return {
      key: entry.key,
      value: entry.value,
      content: stripTags(entry.value),
      tags,
      ...(entry.domainId ? { domainId: entry.domainId } : {}),
      tokenCount: entry.tokenCount ?? 0,
      stable: entry.stable === true,
      injection: entry.injection === 'additional' ? 'additional' : 'system',
      locked: entry.locked === true,
      ...(entry.updated_at ? { updated_at: entry.updated_at } : {}),
      ...(entry.lastRecalledAt ? { lastRecalledAt: entry.lastRecalledAt } : {}),
    };
  });
  return {
    storeId: String(store._id),
    canWrite: true,
    memories,
    totalTokens,
  };
}

/** The user's own stores with counts and token sums. */
export async function listOwnedStores({ userId, role }) {
  await requirePermission({ userId, role, permissions: ['USE', 'READ'] });
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const stores = await db.MemoryStore.find({ userId: user }).lean();
  const counts = await db.MemoryEntry.aggregate([
    { $match: { userId: user } },
    {
      $group: {
        _id: '$storeId',
        n: { $sum: 1 },
        tokens: { $sum: '$tokenCount' },
      },
    },
  ]);
  const byStore = new Map(counts.map((row) => [row._id ?? '', row]));
  return {
    stores: stores.map((store) => ({
      id: String(store._id),
      name: store.name,
      isDefault: store.isDefault === true,
      isOwner: true,
      canWrite: true,
      memoryCount: byStore.get(String(store._id))?.n ?? 0,
      totalTokens: byStore.get(String(store._id))?.tokens ?? 0,
      updated_at: store.updated_at,
    })),
  };
}

/** A store the caller can read: their own, or one shared through the ACL. */
export async function readableStore({ userId, storeId }) {
  const db = await models();
  const user = new mongoose.Types.ObjectId(String(userId));
  const own = storeId
    ? await db.MemoryStore.findOne({ _id: storeId, userId: user }).lean()
    : await db.MemoryStore.findOne({ userId: user, isDefault: true }).lean();
  if (own) {
    return { store: own, ownerId: String(userId), isOwner: true };
  }
  if (!storeId) {
    return null;
  }
  const store = await db.MemoryStore.findById(storeId).lean();
  if (!store) {
    return null;
  }
  const conn = await connectAppDb();
  const acl = await conn.collection('aclentries').findOne({
    resourceType: 'memoryStore',
    resourceId: new mongoose.Types.ObjectId(String(storeId)),
    permBits: { $bitsAllSet: 1 },
    $or: [
      { principalType: 'user', principalId: user },
      { principalType: 'public' },
    ],
  });
  if (!acl) {
    return null;
  }
  return { store, ownerId: String(store.userId), isOwner: String(store.userId) === String(userId) };
}

/** A store the caller can write: owner, or a shared grant with EDIT. */
export async function writableStore({ userId, storeId }) {
  const access = await readableStore({ userId, storeId });
  if (!access) {
    return null;
  }
  if (access.isOwner) {
    return access;
  }
  const conn = await connectAppDb();
  const entry = await conn.collection('aclentries').findOne({
    resourceType: 'memoryStore',
    resourceId: new mongoose.Types.ObjectId(String(access.store._id)),
    principalType: 'user',
    principalId: new mongoose.Types.ObjectId(String(userId)),
    permBits: { $bitsAllSet: 2 },
  });
  return entry == null ? null : access;
}
